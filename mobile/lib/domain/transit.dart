import 'dart:convert';
import 'dart:math' as math;

typedef Json = Map<String, dynamic>;
const gpsFreshMs = 120000;
const seatsFreshMs = 600000;
const inactivityMs = 2700000;
const publicFields = <String>{
  'id',
  'nameEn',
  'nameAr',
  'phone',
  'isOnDuty',
  'isLateShift',
  'prayerShift',
  'departureCountdown',
  'departureCountdownSetAt',
  'lastActiveTime',
  'autoPausedForInactivity',
  'lastTripLabelEn',
  'lastTripLabelAr',
  'status',
  'passengers',
  'seatCountUpdatedAt',
  'maxCapacity',
  'lastUpdated',
  'departureNoteEn',
  'departureNoteAr',
  'currentStopEn',
  'currentStopAr',
  'proximityStatusEn',
  'proximityStatusAr',
  'currentLocation',
  'detectedNodeId',
  'isDetour',
  'detourNameEn',
  'detourNameAr',
  'gpsMode',
  'bearing',
};

int epoch() => DateTime.now().millisecondsSinceEpoch;
bool recent(num? time, int now, int age) =>
    time != null && time > 0 && time <= now && now - time < age;
String normalizePin(String value) => value.trim().split('').map((c) {
  final n = c.codeUnitAt(0);
  return n >= 0x660 && n <= 0x669
      ? '${n - 0x660}'
      : n >= 0x6f0 && n <= 0x6f9
      ? '${n - 0x6f0}'
      : c;
}).join();
String? phoneDigits(String value) {
  var digits = normalizePin(value).replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.startsWith('00')) digits = digits.substring(2);
  if (digits.startsWith('+')) digits = digits.substring(1);
  if (RegExp(r'^05[0-9]{8}$').hasMatch(digits)) {
    digits = '970${digits.substring(1)}';
  }
  return RegExp(r'^(970|972)5[0-9]{8}$').hasMatch(digits) ? digits : null;
}

class Driver {
  final Json data;
  Driver(Json source)
    : data = Map.unmodifiable({
        for (final key in publicFields)
          if (source.containsKey(key)) key: source[key],
      });
  String get id => data['id'] as String;
  String name(bool ar) => data[ar ? 'nameAr' : 'nameEn'] as String;
  String get phone => data['phone'] as String;
  bool get duty => data['isOnDuty'] == true;
  int get passengers => data['passengers'] as int;
  int get capacity => data['maxCapacity'] as int;
  String get status => data['status'] as String;
  Json get location =>
      Map<String, dynamic>.from(data['currentLocation'] as Map);
  int get fixTime => (location['timestamp'] as num).toInt();
  bool fresh(int now) =>
      data['gpsMode'] == 'live' && recent(fixTime, now, gpsFreshMs);
  bool seatsKnown(int now) =>
      duty &&
      fresh(now) &&
      recent(data['seatCountUpdatedAt'] as num?, now, seatsFreshMs);
  Driver copy(Json patch) => Driver({...data, ...patch});
  Json get snapshot => Map<String, dynamic>.from(data);
  Driver? publishable(int now) {
    if (data['gpsMode'] == 'simulation') return null;
    if (!duty) {
      return copy({
        'gpsMode': 'idle',
        'bearing': 'stationary',
        'currentLocation': {'lat': 0, 'lng': 0, 'timestamp': 0},
      });
    }
    return fresh(now) ? this : null;
  }

  static Driver parse(dynamic value) {
    if (value is! Map) throw const FormatException('Invalid driver');
    final d = Driver(Map<String, dynamic>.from(value));
    final loc = d.location;
    for (final key in ['isOnDuty', 'isLateShift', 'isDetour']) {
      if (d.data[key] is! bool) {
        throw const FormatException('Invalid driver flags');
      }
    }
    for (final key in [
      'phone',
      'lastUpdated',
      'departureNoteEn',
      'departureNoteAr',
      'currentStopEn',
      'currentStopAr',
      'proximityStatusEn',
      'proximityStatusAr',
      'detectedNodeId',
    ]) {
      if (d.data[key] is! String) {
        throw const FormatException('Invalid driver text');
      }
    }
    if (!['idle', 'live'].contains(d.data['gpsMode']) ||
        DateTime.tryParse(d.data['lastUpdated'] as String) == null) {
      throw const FormatException('Invalid driver mode');
    }
    for (final key in [
      'seatCountUpdatedAt',
      'lastActiveTime',
      'departureCountdownSetAt',
    ]) {
      final v = d.data[key];
      if (v != null && (v is! num || !v.isFinite || v < 0)) {
        throw const FormatException('Invalid driver time');
      }
    }
    if (!RegExp(r'^driver-[1-8]$').hasMatch(d.id) ||
        d.name(true).isEmpty ||
        d.name(false).isEmpty ||
        d.capacity < 1 ||
        d.capacity > 20 ||
        d.passengers < 0 ||
        d.passengers > d.capacity ||
        ![
          'in_kufr_malik',
          'to_ramallah',
          'in_ramallah',
          'to_kufr_malik',
          'detour',
        ].contains(d.status) ||
        loc['lat'] is! num ||
        loc['lng'] is! num ||
        loc['timestamp'] is! num ||
        !(loc['lat'] as num).isFinite ||
        !(loc['lng'] as num).isFinite ||
        !(loc['timestamp'] as num).isFinite ||
        (loc['lat'] as num).abs() > 90 ||
        (loc['lng'] as num).abs() > 180 ||
        d.fixTime < 0) {
      throw const FormatException('Invalid driver fields');
    }
    return d;
  }
}

List<Json> validRecords(dynamic source, bool Function(Json) valid) {
  if (source is! List) {
    return [];
  }
  final result = <Json>[];
  for (final value in source) {
    try {
      final record = Map<String, dynamic>.from(value as Map);
      if (valid(record)) {
        result.add(record);
      }
    } catch (_) {
      /* Keep valid neighbouring records. */
    }
  }
  return result;
}

bool validLocalRecord(Json row) =>
    row['id'] is String &&
    row['driverId'] is String &&
    RegExp(r'^driver-[1-8]$').hasMatch(row['driverId'] as String) &&
    row['timestamp'] is int &&
    (row['timestamp'] as int) > 0;

class Report {
  final Driver driver;
  final int revision;
  final DateTime received;
  Report(this.driver, this.revision, this.received);
  factory Report.parse(dynamic raw) {
    final value = Map<String, dynamic>.from(raw as Map);
    final driver = Driver.parse(value['snapshot']);
    if (driver.id != value['driver_id'] ||
        value['revision'] is! int ||
        (value['revision'] as int) < 1) {
      throw const FormatException('Invalid report identity');
    }
    return Report(
      driver,
      value['revision'] as int,
      DateTime.parse(value['received_at'] as String),
    );
  }
  bool live(int now) =>
      driver.duty &&
      driver.fresh(now) &&
      recent(received.millisecondsSinceEpoch, now, gpsFreshMs);
  bool lastSeen(int now) =>
      !live(now) &&
      driver.duty &&
      driver.data['gpsMode'] == 'live' &&
      driver.fixTime > 0 &&
      driver.fixTime <= now &&
      received.millisecondsSinceEpoch <= now;
}

String lastSeenLabel(int timestamp, int now, bool ar) {
  if (timestamp <= 0 || timestamp > now) {
    return ar ? 'لا يوجد موقع مُبلغ عنه' : 'No reported location';
  }
  final minutes = (now - timestamp) ~/ 60000;
  if (minutes < 1) return ar ? 'آخر ظهور الآن' : 'Last seen just now';
  if (minutes < 60) {
    return ar
        ? 'آخر ظهور قبل $minutes دقيقة'
        : 'Last seen $minutes minute${minutes == 1 ? '' : 's'} ago';
  }
  final hours = minutes ~/ 60;
  if (hours < 24) {
    return ar
        ? 'آخر ظهور قبل $hours ساعة'
        : 'Last seen $hours hour${hours == 1 ? '' : 's'} ago';
  }
  final days = hours ~/ 24;
  return ar
      ? 'آخر ظهور قبل $days يوم'
      : 'Last seen $days day${days == 1 ? '' : 's'} ago';
}

String? departureLabel(Driver d, int now, bool ar) {
  final key = d.data['departureCountdown'];
  final start = d.data['departureCountdownSetAt'];
  if (!d.duty || start is! num || start <= 0 || start > now) return null;
  final duration = switch (key) {
    'leaving_now' => 120000,
    'in_5_mins' => 300000,
    'in_10_mins' => 600000,
    _ => 0,
  };
  final left = duration - (now - start);
  if (left <= 0) return null;
  if (key == 'leaving_now') return ar ? 'طالع الآن' : 'Leaving now';
  final minutes = (left / 60000).ceil();
  return ar ? 'طالع بعد $minutes دقيقة' : 'Departing in $minutes min';
}

class Place {
  final String id, en, ar;
  final double lat, lng, progress;
  const Place(this.id, this.en, this.ar, this.lat, this.lng, this.progress);
}

const route = [
  Place('kufr_malik', 'Kufr Malik', 'كفر مالك', 31.9840, 35.3115, 0),
  Place('silwad', 'Silwad', 'سلواد', 31.9790, 35.2630, 22.6),
  Place(
    'yabroud_checkpoint',
    'Yabroud Checkpoint',
    'حاجز يبرود',
    31.9670,
    35.2440,
    37,
  ),
  Place('ein_sinia', 'Ein Sinia', 'عين سينيا', 31.9610, 35.2280, 52.6),
  Place('al_jalazon', 'Al Jalazon', 'الجلزون', 31.9390, 35.2150, 75.6),
  Place('ramallah', 'Ramallah', 'الموقف', 31.9038, 35.2034, 100),
];
const alternatives = [
  Place(
    'turmusaya',
    'Turmusaya / Sinjil',
    'ترمسعيا / سنجل',
    32.0360,
    35.2860,
    0,
  ),
  Place(
    'deir_dibwan',
    'Deir Dibwan / Burqa',
    'دير دبوان / برقة',
    31.9420,
    35.2810,
    0,
  ),
];
double distance(double lat1, double lng1, double lat2, double lng2) {
  const radians = math.pi / 180;
  final a =
      math.pow(math.sin((lat2 - lat1) * radians / 2), 2) +
      math.cos(lat1 * radians) *
          math.cos(lat2 * radians) *
          math.pow(math.sin((lng2 - lng1) * radians / 2), 2);
  return 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

({double progress, double distance}) project(double lat, double lng) {
  var closest = double.infinity, progress = 0.0;
  final scale = math.cos(lat * math.pi / 180);
  for (var i = 0; i < route.length - 1; i++) {
    final a = route[i], b = route[i + 1];
    final dx = (b.lng - a.lng) * scale, dy = b.lat - a.lat;
    final t =
        (((lng - a.lng) * scale * dx + (lat - a.lat) * dy) /
                (dx * dx + dy * dy))
            .clamp(0.0, 1.0);
    final meters = distance(
      lat,
      lng,
      a.lat + t * (b.lat - a.lat),
      a.lng + t * (b.lng - a.lng),
    );
    if (meters < closest) {
      closest = meters;
      progress = a.progress + t * (b.progress - a.progress);
    }
  }
  return (progress: progress, distance: closest);
}

// Off-corridor fixes keep their actual place and never get a main-route marker.
Driver applyFix(Driver driver, Json fix, int now, {Json? movementAnchor}) {
  final lat = (fix['lat'] as num).toDouble(),
      lng = (fix['lng'] as num).toDouble();
  final time = (fix['timestamp'] as num).toInt();
  final accuracy = (fix['accuracy'] as num?)?.toDouble() ?? double.infinity;
  if (!lat.isFinite ||
      !lng.isFinite ||
      lat.abs() > 90 ||
      lng.abs() > 180 ||
      !recent(time, now, gpsFreshMs) ||
      !accuracy.isFinite ||
      accuracy < 0 ||
      accuracy > 100) {
    return driver;
  }
  final projection = project(lat, lng);
  final nearest = [...route]
    ..sort(
      (a, b) => distance(
        lat,
        lng,
        a.lat,
        a.lng,
      ).compareTo(distance(lat, lng, b.lat, b.lng)),
    );
  final nearestAlt = [...alternatives]
    ..sort(
      (a, b) => distance(
        lat,
        lng,
        a.lat,
        a.lng,
      ).compareTo(distance(lat, lng, b.lat, b.lng)),
    );
  var bearing = driver.data['bearing'] as String? ?? 'stationary';
  final old = movementAnchor ?? driver.location;
  final moved =
      driver.data['gpsMode'] == 'live' &&
      recent(old['timestamp'] as num?, time, gpsFreshMs) &&
      distance(
            lat,
            lng,
            (old['lat'] as num).toDouble(),
            (old['lng'] as num).toDouble(),
          ) >
          math.max(
            50,
            accuracy + ((old['accuracy'] as num?)?.toDouble() ?? 100),
          );
  if (moved && projection.distance < 1600) {
    final change =
        projection.progress -
        project(
          (old['lat'] as num).toDouble(),
          (old['lng'] as num).toDouble(),
        ).progress;
    if (change.abs() > 0.2) bearing = change > 0 ? 'southbound' : 'northbound';
  }
  var place = nearest.first;
  final offRoute = projection.distance > 1600;
  final knownAlternative =
      distance(lat, lng, nearestAlt.first.lat, nearestAlt.first.lng) < 1500;
  String stopEn = place.en, stopAr = place.ar;
  if (offRoute) {
    place = knownAlternative
        ? nearestAlt.first
        : const Place(
            'outside_route',
            'Outside mapped route',
            'خارج المسار المرسوم',
            0,
            0,
            0,
          );
    stopEn = place.en;
    stopAr = place.ar;
  }
  final atVillage =
      !offRoute && distance(lat, lng, route.first.lat, route.first.lng) < 750;
  final atStation =
      !offRoute && distance(lat, lng, route.last.lat, route.last.lng) < 450;
  final status = offRoute
      ? 'detour'
      : atVillage
      ? 'in_kufr_malik'
      : atStation
      ? 'in_ramallah'
      : bearing == 'northbound'
      ? 'to_kufr_malik'
      : bearing == 'southbound'
      ? 'to_ramallah'
      : driver.status == 'to_kufr_malik'
      ? 'to_kufr_malik'
      : 'to_ramallah';
  return driver.copy({
    'currentLocation': fix,
    'gpsMode': 'live',
    'status': status,
    'bearing': bearing,
    'isDetour': offRoute,
    'detectedNodeId': place.id,
    'currentStopEn': stopEn,
    'currentStopAr': stopAr,
    'detourNameEn': offRoute ? stopEn : '',
    'detourNameAr': offRoute ? stopAr : '',
    'proximityStatusEn': '${driver.name(false)} · $stopEn',
    'proximityStatusAr': '${driver.name(true)} · $stopAr',
    'lastActiveTime': moved ? now : driver.data['lastActiveTime'] ?? now,
    'lastUpdated': DateTime.fromMillisecondsSinceEpoch(now)
        .toUtc()
        .toIso8601String(),
  });
}

String canonical(dynamic value) {
  dynamic sort(dynamic v) {
    if (v is Map) {
      final keys = v.keys.cast<String>().toList()..sort();
      return {for (final k in keys) k: sort(v[k])};
    }
    if (v is List) return v.map(sort).toList();
    return v;
  }

  return jsonEncode(sort(value));
}

Json operationalSettings(Driver driver) => {
  for (final key in [
    'isOnDuty',
    'passengers',
    'maxCapacity',
    'seatCountUpdatedAt',
    'autoPausedForInactivity',
    'prayerShift',
    'isLateShift',
    'departureCountdown',
    'departureCountdownSetAt',
    'departureNoteEn',
    'departureNoteAr',
    'lastTripLabelEn',
    'lastTripLabelAr',
  ])
    key: driver.data[key],
};

String destinationLabel(Driver d, bool ar) {
  if (d.status == 'in_kufr_malik' ||
      d.status == 'to_ramallah' ||
      (d.status == 'detour' && d.data['bearing'] == 'southbound')) {
    return ar ? 'إلى الموقف' : 'To Ramallah';
  }
  if (d.status == 'in_ramallah' ||
      d.status == 'to_kufr_malik' ||
      (d.status == 'detour' && d.data['bearing'] == 'northbound')) {
    return ar ? 'إلى كفر مالك' : 'To Kufr Malik';
  }
  return ar ? 'الاتجاه غير مؤكد' : 'Direction unconfirmed';
}
