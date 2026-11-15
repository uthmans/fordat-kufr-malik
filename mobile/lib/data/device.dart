import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/transit.dart';
import 'backend.dart';

class DeviceStore {
  final FlutterSecureStorage vault;
  SharedPreferencesAsync? preferences;
  SharedPreferencesAsync get _prefs => preferences ??= SharedPreferencesAsync();
  DeviceStore({FlutterSecureStorage? vault, this.preferences})
    : vault = vault ?? const FlutterSecureStorage();
  Future<DriverSession?> session() async {
    final value = await vault.read(key: 'driver_session');
    if (value == null) return null;
    try {
      return DriverSession.parse(
        Map<String, dynamic>.from(jsonDecode(value) as Map),
      );
    } catch (_) {
      await vault.delete(key: 'driver_session');
      return null;
    }
  }

  Future<void> saveSession(DriverSession? session) => session == null
      ? vault.delete(key: 'driver_session')
      : vault.write(
          key: 'driver_session',
          value: jsonEncode(session.serialize()),
        );
  Future<Json?> ownerSession() async {
    try {
      final raw = await vault.read(key: 'owner_session');
      return raw == null
          ? null
          : Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveOwner(Json? session) => session == null
      ? vault.delete(key: 'owner_session')
      : vault.write(key: 'owner_session', value: jsonEncode(session));
  Future<Json> load() async {
    try {
      return Map<String, dynamic>.from(
        jsonDecode(await _prefs.getString('transit_settings') ?? '{}') as Map,
      );
    } catch (_) {
      return {};
    }
  }

  Future<void> save(Json data) =>
      _prefs.setString('transit_settings', jsonEncode(data));
}

class PhoneLocation {
  Future<void> requestAccess() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const ApiFailure('location_disabled');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw const ApiFailure('location_denied');
    }
  }

  Stream<Json> positions() {
    final LocationSettings settings;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      settings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
        intervalDuration: const Duration(seconds: 10),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'سرفيس كفر مالك · Kufr Malik Transit',
          notificationText:
              'مشاركة موقع السائق مفعّلة · Driver location sharing is on',
          enableWakeLock: true,
        ),
      );
    } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      settings = AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
        activityType: ActivityType.automotiveNavigation,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    } else {
      settings = const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      );
    }
    return Geolocator.getPositionStream(locationSettings: settings).map(
      (p) => {
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracy': p.accuracy,
        'timestamp': p.timestamp.millisecondsSinceEpoch,
        if (p.heading.isFinite && p.heading >= 0 && p.heading <= 360)
          'heading': p.heading,
        if (p.speed.isFinite && p.speed >= 0) 'speed': p.speed,
      },
    );
  }
}

class PhoneUnlock {
  final LocalAuthentication authentication = LocalAuthentication();
  Future<bool> supported() async {
    if (kIsWeb) return false;
    try {
      return await authentication.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> unlock(bool ar) async {
    try {
      return await authentication.authenticate(
        localizedReason: ar ? 'افتح ملف السائق' : 'Unlock your driver profile',
        biometricOnly: false,
      );
    } catch (_) {
      return false;
    }
  }
}
