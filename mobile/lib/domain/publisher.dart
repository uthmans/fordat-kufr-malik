import 'transit.dart';
import '../data/backend.dart';

Json publicationOperations(Driver driver) => {
  for (final entry in driver.snapshot.entries)
    if (![
      'currentLocation',
      'lastUpdated',
      'lastActiveTime',
      'proximityStatusEn',
      'proximityStatusAr',
      'currentStopEn',
      'currentStopAr',
      'detectedNodeId',
      'bearing',
    ].contains(entry.key))
      entry.key: entry.value,
};

class ReliablePublisher {
  final Future<Report?> Function(String) read;
  final Future<Report> Function(Driver, int?) send;
  final void Function(Report) saved;
  final void Function(String, Report?) state;
  final int Function() clock;
  ReliablePublisher({
    required this.read,
    required this.send,
    required this.saved,
    required this.state,
    int Function()? clock,
  }) : clock = clock ?? epoch;
  int _generation = 0, _retryAt = 0, _failures = 0, _lastSent = 0;
  String? _owner;
  Report? _baseline;
  Driver? _pending, _attempt;
  bool _busy = false, _recover = false;
  bool get active => _owner != null;
  void start(String id, Report? baseline) {
    stop();
    _owner = id;
    _baseline = baseline;
    _retryAt = 0;
    _failures = 0;
    _lastSent = 0;
    _attempt = null;
    _recover = false;
    state('waiting', null);
  }

  void stop() {
    _generation++;
    _owner = null;
    _pending = null;
    _busy = false;
    state('stopped', null);
  }

  void queue(Driver driver) {
    if (driver.id == _owner) {
      _pending = driver;
      if (!_recover &&
          (_baseline == null ||
              canonical(publicationOperations(driver)) !=
                  canonical(publicationOperations(_baseline!.driver)))) {
        state('pending', null);
      }
    }
  }

  void reconnect() {
    if (active) {
      _recover = true;
      _retryAt = 0;
      state('recovering', null);
    }
  }

  Future<void> flush() async {
    if (!active ||
        _busy ||
        (_pending == null && !_recover) ||
        clock() < _retryAt) {
      return;
    }
    final generation = _generation;
    _busy = true;
    try {
      if (_recover) {
        final remote = await read(_owner!);
        if (generation != _generation) return;
        if (remote != null && remote.driver.id != _owner) {
          throw const ApiFailure('invalid_request');
        }
        if (remote?.revision != _baseline?.revision) {
          if (remote == null ||
              _attempt == null ||
              canonical(remote.driver.snapshot) !=
                  canonical(_attempt!.snapshot)) {
            stop();
            state('conflict', remote);
            return;
          }
          _baseline = remote;
          saved(remote);
        }
        _recover = false;
      }
      final pending = _pending;
      if (pending == null) {
        state('waiting', null);
        return;
      }
      final snapshot = pending.publishable(clock());
      if (snapshot == null) {
        state('gps_stale', null);
        return;
      }
      if (_baseline != null &&
          canonical(snapshot.snapshot) ==
              canonical(_baseline!.driver.snapshot)) {
        _pending = null;
        state(snapshot.duty ? 'live' : 'off_duty', null);
        return;
      }
      if (_baseline != null &&
          canonical(publicationOperations(snapshot)) ==
              canonical(publicationOperations(_baseline!.driver)) &&
          clock() - _lastSent < 60000) {
        return;
      }
      _attempt = snapshot;
      final result = await send(snapshot, _baseline?.revision);
      if (generation != _generation) return;
      if (result.driver.id != _owner) throw const ApiFailure('invalid_session');
      _baseline = result;
      _lastSent = clock();
      _failures = 0;
      if (identical(_pending, pending)) _pending = null;
      saved(result);
      final hasUnsentSettings =
          _pending != null &&
          canonical(publicationOperations(_pending!)) !=
              canonical(publicationOperations(result.driver));
      state(
        hasUnsentSettings
            ? 'pending'
            : snapshot.duty
            ? 'live'
            : 'off_duty',
        null,
      );
    } catch (error) {
      if (generation != _generation) return;
      if (error is ApiFailure && !error.retryable && error.code != 'conflict') {
        stop();
        state(error.code, null);
        return;
      }
      _recover = true;
      _retryAt =
          clock() + (2000 * (1 << _failures.clamp(0, 5))).clamp(2000, 60000);
      _failures++;
      state('recovering', null);
    } finally {
      if (generation == _generation) _busy = false;
    }
  }
}
