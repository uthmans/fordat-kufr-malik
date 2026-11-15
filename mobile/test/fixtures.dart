import 'dart:convert';
import 'dart:io';

import 'package:kufr_malik_transit/domain/transit.dart';

Driver fixture({int? timestamp, int passengers = 5, bool duty = true}) {
  final value = Map<String, dynamic>.from(
    (jsonDecode(File('assets/roster.json').readAsStringSync()) as List).first
        as Map,
  );
  return Driver.parse({
    ...value,
    'isOnDuty': duty,
    'gpsMode': 'live',
    'passengers': passengers,
    'seatCountUpdatedAt': timestamp ?? epoch() - 1000,
    'currentLocation': {
      'lat': 31.984,
      'lng': 35.3115,
      'accuracy': 10,
      'timestamp': timestamp ?? epoch() - 1000,
    },
    'lastActiveTime': timestamp ?? epoch() - 1000,
  });
}

Report report(Driver driver, {int revision = 1, int? received}) => Report(
  driver,
  revision,
  DateTime.fromMillisecondsSinceEpoch(received ?? epoch() - 1000),
);
