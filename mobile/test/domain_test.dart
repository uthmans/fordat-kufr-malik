import 'package:flutter_test/flutter_test.dart';
import 'package:kufr_malik_transit/domain/transit.dart';

import 'fixtures.dart';

void main() {
  test('Arabic and Persian PINs preserve leading zeroes', () {
    expect(normalizePin(' ٠۱۲٣٤۵٦٧ '), '01234567');
  });
  test('regional call and WhatsApp destinations normalize identically', () {
    for (final number in ['+972597073155', '00972597073155', '+٩٧٢٥٩٧٠٧٣١٥٥']) {
      expect(phoneDigits(number), '972597073155');
    }
    expect(phoneDigits('0597073155'), '970597073155');
    expect(phoneDigits('1234'), isNull);
  });
  test('public snapshots drop all private fields', () {
    final d = Driver({
      ...fixture().snapshot,
      'pinCode': 'never-upload',
      'token': 'secret',
      'bookingNames': ['private'],
    });
    expect(d.snapshot.containsKey('pinCode'), isFalse);
    expect(d.snapshot.containsKey('token'), isFalse);
    expect(d.snapshot.containsKey('bookingNames'), isFalse);
  });
  test(
    'live availability requires server freshness, duty and real fresh GPS',
    () {
      final now = epoch(), d = fixture();
      expect(report(d).live(now), isTrue);
      expect(report(d, received: now - gpsFreshMs).live(now), isFalse);
      expect(report(d, received: now - gpsFreshMs).lastSeen(now), isTrue);
      expect(report(fixture(duty: false)).live(now), isFalse);
      expect(report(fixture(duty: false)).lastSeen(now), isFalse);
    },
  );
  test(
    'expired seats and location are never confirmed or republished as live',
    () {
      final now = epoch();
      expect(fixture(timestamp: now - 120000).publishable(now), isNull);
      expect(fixture(timestamp: now + 1).publishable(now), isNull);
      expect(
        fixture()
            .copy({'seatCountUpdatedAt': now - seatsFreshMs})
            .seatsKnown(now),
        isFalse,
      );
      final off = fixture(duty: false).publishable(now)!;
      expect(off.location, {'lat': 0, 'lng': 0, 'timestamp': 0});
      expect(off.data['gpsMode'], 'idle');
    },
  );
  test('Turmusaya keeps an alternative place and never becomes Kufr Malik', () {
    final now = epoch();
    final d = applyFix(fixture(), {
      'lat': 32.036,
      'lng': 35.286,
      'accuracy': 10,
      'timestamp': now,
    }, now);
    expect(d.status, 'detour');
    expect(d.data['detectedNodeId'], 'turmusaya');
    expect(d.data['currentStopEn'], 'Turmusaya / Sinjil');
    expect(d.data['currentStopEn'], isNot('Kufr Malik'));
  });
  test('an unknown road does not get an invented named detour', () {
    final now = epoch();
    final d = applyFix(fixture(), {
      'lat': 32.2,
      'lng': 35.4,
      'accuracy': 10,
      'timestamp': now,
    }, now);
    expect(d.data['detectedNodeId'], 'outside_route');
    expect(d.data['currentStopEn'], 'Outside mapped route');
  });
  test('poor accuracy and stale fixes do not alter a driver', () {
    final now = epoch(), d = fixture();
    for (final fix in [
      {'lat': 32.036, 'lng': 35.286, 'accuracy': 300, 'timestamp': now},
      {'lat': 32.036, 'lng': 35.286, 'accuracy': 10, 'timestamp': now - 120000},
    ]) {
      expect(identical(applyFix(d, fix, now), d), isTrue);
    }
  });
  test('stationary noise does not invent a new trip direction', () {
    final now = epoch();
    final d = fixture().copy({
      'status': 'to_kufr_malik',
      'bearing': 'northbound',
      'currentLocation': {
        'lat': 31.95,
        'lng': 35.22,
        'accuracy': 10,
        'timestamp': now - 1000,
      },
    });
    final fixed = applyFix(d, {
      'lat': 31.95001,
      'lng': 35.22001,
      'accuracy': 10,
      'timestamp': now,
    }, now);
    expect(fixed.data['bearing'], 'northbound');
  });
  test('departure announcements expire without asserting departure', () {
    final now = epoch();
    final d = fixture().copy({
      'departureCountdown': 'leaving_now',
      'departureCountdownSetAt': now - 120000,
    });
    expect(departureLabel(d, now, false), isNull);
    expect(
      departureLabel(d.copy({'departureCountdownSetAt': now}), now, false),
      'Leaving now',
    );
  });
  test('last-seen ages handle minutes, hours and days without showing future locations', () {
    final now = epoch();
    expect(lastSeenLabel(now - 180000, now, false), 'Last seen 3 minutes ago');
    expect(lastSeenLabel(now - 7200000, now, true), contains('ساعة'));
    expect(lastSeenLabel(now + 1, now, false), 'No reported location');
  });
}
