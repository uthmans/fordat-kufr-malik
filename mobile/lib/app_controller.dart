import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'data/backend.dart';
import 'data/device.dart';
import 'domain/transit.dart';
import 'domain/publisher.dart';

class AppController extends ChangeNotifier {
  final TransitApi api;
  final DeviceStore store;
  final PhoneLocation gps;
  final PhoneUnlock unlock;
  late final ReliablePublisher publisher;
  List<Driver> roster = [];
  List<Report> reports = [];
  List<Json> requests = [], archives = [], confirmedLogs = [];
  Json localSettings = {};
  DriverSession? _session;
  Driver? owner;
  Report? conflict;
  String villagerName = '', sharingState = 'stopped', error = '';
  bool ar = true,
      dark = false,
      ready = false,
      busy = false,
      online = true,
      lockEnabled = false,
      hasSavedSession = false;
  bool adminAuthenticated = false, demo = false;
  bool profileLocked = false;
  int? _backgroundAt;
  double demoProgress = 0;
  String? _adminToken;
  bool _disposed = false, _reading = false, _starting = false;
  int _generation = 0,
      _trackingGeneration = 0,
      _adminGeneration = 0,
      _lastRead = 0;
  int _nextRestore = 0;
  StreamSubscription<Json>? _positions;
  Json? _movementAnchor;
  Timer? _timer;
  Future<void> _writes = Future.value();
  AppController({
    TransitApi? api,
    DeviceStore? store,
    PhoneLocation? gps,
    PhoneUnlock? unlock,
  }) : api = api ?? TransitApi(),
       store = store ?? DeviceStore(),
       gps = gps ?? PhoneLocation(),
       unlock = unlock ?? PhoneUnlock() {
    publisher = ReliablePublisher(
      read: this.api.one,
      send: (driver, revision) async {
        final session = _session;
        if (session == null || session.driverId != driver.id) {
          throw const ApiFailure('invalid_session');
        }
        return this.api.publish(session, driver, revision);
      },
      saved: (report) {
        reports = [
          ...reports.where((r) => r.driver.id != report.driver.id),
          report,
        ];
        online = true;
        _emit();
      },
      state: (state, remote) {
        sharingState = state;
        if (state == 'conflict') conflict = remote;
        if (state == 'invalid_session') {
          _session = null;
          owner = null;
          hasSavedSession = false;
          unawaited(this.store.saveSession(null));
          unawaited(_positions?.cancel());
          _positions = null;
        }
        _emit();
      },
    );
  }
  String t(String arabic, String english) => ar ? arabic : english;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void initializationFailed() {
    error = 'unavailable';
    ready = true;
    _emit();
  }

  Future<void> initialize() async {
    final source =
        jsonDecode(await rootBundle.loadString('assets/roster.json')) as List;
    roster = source.map(Driver.parse).toList();
    final saved = await store.load();
    ar = saved['ar'] != false;
    dark = saved['dark'] == true;
    villagerName = saved['villagerName'] is String
        ? saved['villagerName'] as String
        : '';
    lockEnabled = saved['lockEnabled'] == true;
    localSettings = Map<String, dynamic>.from(
      saved['driverSettings'] is Map ? saved['driverSettings'] as Map : {},
    );
    requests = validRecords(
      saved['requests'],
      (r) =>
          validLocalRecord(r) &&
          r['passengerName'] is String &&
          r['seatCount'] is int &&
          (r['seatCount'] as int) > 0 &&
          ['pending', 'accepted', 'declined'].contains(r['status']),
    );
    archives = validRecords(
      saved['archives'],
      (r) =>
          validLocalRecord(r) &&
          r['passengersCount'] is int &&
          (r['passengersCount'] as int) >= 0,
    );
    confirmedLogs = validRecords(
      saved['confirmedLogs'],
      (r) =>
          r['driverId'] is String &&
          r['seatCount'] is int &&
          (r['seatCount'] as int) > 0 &&
          r['passengerName'] is String,
    );
    try {
      hasSavedSession = await store.session() != null;
    } catch (_) {
      error = 'secure_storage';
    }
    ready = true;
    _emit();
    api.subscribe(() => unawaited(refresh()));
    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (hasSavedSession &&
          owner == null &&
          !lockEnabled &&
          !busy &&
          epoch() >= _nextRestore) {
        unawaited(restore());
      }
      if ((!online && epoch() - _lastRead >= 30000) ||
          epoch() - _lastRead >= 300000) {
        unawaited(refresh());
      }
      if (owner != null &&
          owner!.duty &&
          owner!.status == 'in_kufr_malik' &&
          epoch() - (owner!.data['lastActiveTime'] as num? ?? epoch()) >=
              inactivityMs) {
        update({'isOnDuty': false, 'autoPausedForInactivity': true});
      }
      unawaited(publisher.flush());
      _emit();
    });
    await refresh();
    if (hasSavedSession && !lockEnabled) await restore();
    await restoreAdmin();
  }

  Future<void> persist() async {
    final snapshot = Map<String, dynamic>.from(
      jsonDecode(
        jsonEncode({
          'ar': ar,
          'dark': dark,
          'villagerName': villagerName,
          'lockEnabled': lockEnabled,
          'driverSettings': localSettings,
          'requests': requests,
          'archives': archives,
          'confirmedLogs': confirmedLogs,
        }),
      ) as Map,
    );
    _writes = _writes.catchError((_) {}).then((_) => store.save(snapshot));
    try {
      await _writes;
    } catch (_) {
      error = 'storage';
      _emit();
    }
  }

  Future<void> refresh() async {
    if (_reading || _disposed) return;
    _reading = true;
    try {
      final next = await api.feed();
      if (_disposed) return;
      reports = next;
      online = true;
      _lastRead = epoch();
    } catch (_) {
      online = false;
      _lastRead = epoch();
    } finally {
      _reading = false;
      _emit();
    }
  }

  void backgrounded() {
    _backgroundAt = epoch();
  }

  void resumed() {
    if (lockEnabled &&
        owner != null &&
        _backgroundAt != null &&
        epoch() - _backgroundAt! >= 30000) {
      profileLocked = true;
    }
    _backgroundAt = null;
    publisher.reconnect();
    unawaited(refresh());
    if (hasSavedSession && owner == null && !lockEnabled && !busy) {
      unawaited(restore());
    }
    _emit();
  }

  Future<void> unlockProfile() async {
    if (await unlock.unlock(ar)) {
      profileLocked = false;
      _emit();
    }
  }

  Future<void> restore() async {
    if (busy) return;
    busy = true;
    _nextRestore = epoch() + 30000;
    error = '';
    final generation = ++_generation;
    _emit();
    try {
      final session = await store.session();
      if (session == null) {
        hasSavedSession = false;
        return;
      }
      if (lockEnabled && !await unlock.unlock(ar)) return;
      await api.restore(session);
      if (generation != _generation || _disposed) return;
      _session = session;
      profileLocked = false;
      hasSavedSession = true;
      _loadOwner(session.driverId);
    } on ApiFailure catch (e) {
      error = e.code;
      if (e.code == 'invalid_session') {
        await store.saveSession(null);
        hasSavedSession = false;
      }
    } catch (_) {
      error = 'unavailable';
    } finally {
      busy = false;
      _emit();
    }
  }

  void _loadOwner(String id) {
    final base = roster.firstWhere((d) => d.id == id);
    final shared = reports.where((r) => r.driver.id == id).firstOrNull;
    final local = localSettings[id];
    owner = shared?.driver ?? base;
    if (local is Map) {
      try {
        final stored = Driver.parse(Map<String, dynamic>.from(local));
        if (stored.id == id) owner = stored;
      } catch (_) {
        /* Ignore corrupt local settings. */
      }
    }
  }

  Future<void> login(String id, String pin) async {
    if (busy) return;
    busy = true;
    error = '';
    final generation = ++_generation;
    _emit();
    try {
      final session = await api.login(id, pin);
      if (generation != _generation || _disposed) return;
      await store.saveSession(session);
      if (generation != _generation || _disposed) {
        await store.saveSession(null);
        return;
      }
      _session = session;
      profileLocked = false;
      hasSavedSession = true;
      _loadOwner(id);
    } on ApiFailure catch (e) {
      error = e.code;
    } catch (_) {
      error = 'secure_storage';
    } finally {
      busy = false;
      _emit();
    }
  }

  Future<void> logout() async {
    final session = _session;
    ++_generation;
    await stopSharing();
    _session = null;
    profileLocked = false;
    owner = null;
    hasSavedSession = false;
    lockEnabled = false;
    await store.saveSession(null);
    await persist();
    _emit();
    if (session != null) {
      try {
        await api.action({'action': 'logout'}, token: session.token);
      } catch (_) {
        /* Local sign-out is immediate. */
      }
    }
  }

  void update(Json patch) {
    if (owner == null) return;
    owner = owner!.copy({
      ...patch,
      'lastUpdated': DateTime.now().toUtc().toIso8601String(),
    });
    localSettings[owner!.id] = owner!.snapshot;
    unawaited(persist());
    publisher.queue(owner!);
    unawaited(publisher.flush());
    _emit();
  }

  Future<void> startSharing({
    bool? usePhone,
    int? confirmedRevision,
    String? confirmedSignature,
  }) async {
    if (_starting || owner == null || _session == null) return;
    _starting = true;
    demo = false;
    error = '';
    sharingState = 'starting';
    _emit();
    final generation = _generation;
    final tracking = ++_trackingGeneration;
    try {
      final remote = await api.one(owner!.id);
      if (generation != _generation ||
          tracking != _trackingGeneration ||
          owner == null) {
        return;
      }
      final differs =
          remote != null &&
          canonical(operationalSettings(owner!)) !=
              canonical(operationalSettings(remote.driver));
      final confirmed =
          usePhone != null &&
          remote?.revision == confirmedRevision &&
          canonical(operationalSettings(owner!)) == confirmedSignature;
      if (remote != null &&
          ((differs && !confirmed) || (usePhone != null && !confirmed))) {
        conflict = remote;
        sharingState = 'conflict';
        return;
      }
      if (remote != null && usePhone == false) owner = remote.driver;
      conflict = null;
      await gps.requestAccess();
      if (generation != _generation ||
          tracking != _trackingGeneration ||
          owner == null) {
        return;
      }
      await _positions?.cancel();
      if (generation != _generation ||
          tracking != _trackingGeneration ||
          owner == null) {
        return;
      }
      final id = owner!.id;
      owner = owner!.copy({
        'isOnDuty': true,
        'autoPausedForInactivity': false,
        'lastActiveTime': epoch(),
      });
      publisher.start(id, remote);
      _movementAnchor = null;
      _positions = gps.positions().listen(
        (fix) {
          if (generation != _generation ||
              tracking != _trackingGeneration ||
              owner?.id != id) {
            return;
          }
          final before = owner!;
          owner = applyFix(
            before,
            fix,
            epoch(),
            movementAnchor: _movementAnchor,
          );
          if (!identical(before, owner) &&
              (_movementAnchor == null ||
                  !recent(
                    _movementAnchor!['timestamp'] as num?,
                    (fix['timestamp'] as num).toInt(),
                    gpsFreshMs,
                  ) ||
                  owner!.data['lastActiveTime'] !=
                      before.data['lastActiveTime'])) {
            _movementAnchor = fix;
          }
          publisher.queue(owner!);
          unawaited(publisher.flush());
          _emit();
        },
        onError: (_) {
          sharingState = 'location_error';
          _emit();
        },
      );
      // Fresh native fixes start publication; a cached location is not reused.
      sharingState = 'waiting_gps';
    } on ApiFailure catch (e) {
      error = e.code;
      sharingState = 'stopped';
    } catch (_) {
      error = 'unavailable';
      sharingState = 'stopped';
    } finally {
      _starting = false;
      _emit();
    }
  }

  Future<void> stopSharing() async {
    _trackingGeneration++;
    publisher.stop();
    await _positions?.cancel();
    _positions = null;
    conflict = null;
    _emit();
  }

  Future<void> endShift() async {
    if (owner == null) return;
    // Duty changes clear precise coordinates on the server via publishable().
    update({'isOnDuty': false});
    await publisher.flush();
    await _positions?.cancel();
    _positions = null;
    _emit();
  }

  Future<void> changePin(String current, String next) async {
    if (_session == null || busy) return;
    busy = true;
    error = '';
    _emit();
    final generation = _generation;
    try {
      await stopSharing();
      final replacement = await api.changePin(_session!, current, next);
      if (generation != _generation || _disposed) return;
      await store.saveSession(replacement);
      _session = replacement;
    } on ApiFailure catch (e) {
      error = e.code;
    } catch (_) {
      error = 'secure_storage';
    } finally {
      busy = false;
      _emit();
    }
  }

  Future<bool> enableUnlock(bool enabled) async {
    if (enabled && (!await unlock.supported() || !await unlock.unlock(ar))) {
      return false;
    }
    if (!enabled && lockEnabled && !await unlock.unlock(ar)) return false;
    lockEnabled = enabled;
    await persist();
    _emit();
    return true;
  }

  Future<void> rememberName(String name) async {
    villagerName = name.trim();
    await persist();
    _emit();
  }

  Future<void> saveRequest(Driver d, String name, int seats) async {
    if (name.trim().isEmpty || seats < 1 || seats > d.capacity) {
      throw const ApiFailure('invalid_request');
    }
    await rememberName(name);
    requests.add({
      'id': 'request-${epoch()}',
      'driverId': d.id,
      'passengerName': name.trim(),
      'seatCount': seats,
      'timestamp': epoch(),
      'status': 'pending',
    });
    await persist();
    _emit();
  }

  void archiveTrip() {
    if (owner == null) return;
    final entries = confirmedLogs
        .where((log) => log['driverId'] == owner!.id)
        .toList();
    final total = entries.fold<int>(
      0,
      (sum, log) => sum + (log['seatCount'] as int),
    );
    if (entries.isEmpty && owner!.passengers == 0) return;
    archives.add({
      'id': 'trip-${epoch()}',
      'driverId': owner!.id,
      'timestamp': epoch(),
      'passengersCount': entries.isEmpty ? owner!.passengers : total,
      'locationStatus': owner!.status,
      'entries': entries,
    });
    confirmedLogs.removeWhere((log) => log['driverId'] == owner!.id);
    update({
      'passengers': 0,
      'seatCountUpdatedAt': epoch(),
      'departureCountdown': null,
    });
  }

  bool decideRequest(String id, bool accept) {
    if (owner == null) return false;
    final request = requests
        .where(
          (r) =>
              r['id'] == id &&
              r['driverId'] == owner!.id &&
              r['status'] == 'pending',
        )
        .firstOrNull;
    if (request == null) return false;
    final seats = request['seatCount'];
    if (accept &&
        (!owner!.duty ||
            seats is! int ||
            seats < 1 ||
            owner!.passengers + seats > owner!.capacity)) {
      return false;
    }
    request['status'] = accept ? 'accepted' : 'declined';
    if (accept) {
      confirmedLogs.add({
        ...request,
        'status': 'confirmed',
        'confirmedAt': epoch(),
      });
      update({
        'passengers': owner!.passengers + (seats as int),
        'seatCountUpdatedAt': epoch(),
        'lastActiveTime': epoch(),
      });
    } else {
      unawaited(persist());
      _emit();
    }
    return true;
  }

  bool _validAdmin(Json data) =>
      data['role'] == 'admin' &&
      data['token'] is String &&
      RegExp(r'^[a-f0-9]{64}$').hasMatch(data['token'] as String) &&
      DateTime.tryParse(data['expires_at'] as String? ?? '')
              ?.isAfter(DateTime.now()) ==
          true;
  Future<void> loginAdmin(String pin) async {
    if (busy) return;
    busy = true;
    error = '';
    _emit();
    final generation = ++_adminGeneration;
    try {
      if (!RegExp(r'^\d{12}$').hasMatch(normalizePin(pin))) {
        throw const ApiFailure('invalid_code');
      }
      final data = await api.action({
        'action': 'admin_login',
        'code': normalizePin(pin),
      });
      if (generation != _adminGeneration || _disposed) return;
      if (!_validAdmin(data)) throw const ApiFailure('invalid_session');
      await store.saveOwner(data);
      if (generation != _adminGeneration || _disposed) {
        await store.saveOwner(null);
        return;
      }
      _adminToken = data['token'] as String;
      adminAuthenticated = true;
    } on ApiFailure catch (e) {
      error = e.code;
    } catch (_) {
      error = 'secure_storage';
    } finally {
      busy = false;
      _emit();
    }
  }

  Future<void> restoreAdmin() async {
    final generation = _adminGeneration;
    try {
      final saved = await store.ownerSession();
      if (saved == null || !_validAdmin(saved)) return;
      final result = await api.action({
        'action': 'admin_restore',
      }, token: saved['token'] as String);
      if (generation != _adminGeneration || _disposed) return;
      if (result['role'] != 'admin' ||
          DateTime.tryParse(result['expires_at'] as String? ?? '')
                  ?.isAfter(DateTime.now()) !=
              true) {
        return;
      }
      _adminToken = saved['token'] as String;
      adminAuthenticated = true;
      _emit();
    } catch (_) {
      /* A saved flag never authorizes the owner. */
    }
  }

  Future<void> logoutAdmin() async {
    _adminGeneration++;
    final token = _adminToken;
    _adminToken = null;
    adminAuthenticated = false;
    demo = false;
    await store.saveOwner(null);
    _emit();
    if (token != null) {
      try {
        await api.action({'action': 'admin_logout'}, token: token);
      } catch (_) {}
    }
  }

  void setDemo(bool enabled) {
    if (!adminAuthenticated) return;
    demo = enabled;
    _emit();
  }

  void setDemoProgress(double value) {
    if (!adminAuthenticated || !demo) return;
    demoProgress = value.clamp(0, 100);
    _emit();
  }

  List<Report> get visibleReports {
    if (!demo || !adminAuthenticated) return reports;
    final progress = demoProgress;
    final index = (progress / 100 * (route.length - 1)).floor().clamp(
      0,
      route.length - 2,
    );
    final a = route[index], b = route[index + 1];
    final fraction = (progress - a.progress) / (b.progress - a.progress);
    final lat = a.lat + (b.lat - a.lat) * fraction.clamp(0, 1),
        lng = a.lng + (b.lng - a.lng) * fraction.clamp(0, 1);
    final d = applyFix(
      roster.first.copy({
        'isOnDuty': true,
        'passengers': 3,
        'seatCountUpdatedAt': epoch(),
      }),
      {'lat': lat, 'lng': lng, 'accuracy': 10, 'timestamp': epoch()},
      epoch(),
    );
    return [Report(d, 1, DateTime.now())];
  }

  Future<void> deleteArchives(Set<String> ids) async {
    if (!adminAuthenticated) return;
    archives.removeWhere((a) => ids.contains(a['id']));
    await persist();
    _emit();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _timer?.cancel();
    publisher.stop();
    unawaited(_positions?.cancel());
    unawaited(api.dispose());
    super.dispose();
  }
}
