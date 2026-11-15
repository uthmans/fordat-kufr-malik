import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kufr_malik_transit/app_controller.dart';
import 'package:kufr_malik_transit/data/backend.dart';
import 'package:kufr_malik_transit/data/device.dart';
import 'package:kufr_malik_transit/domain/transit.dart';

import 'fixtures.dart';

class MemoryStore extends DeviceStore {
  DriverSession? saved;
  Json? admin;
  Json settings = {};
  @override
  Future<DriverSession?> session() async => saved;
  @override
  Future<void> saveSession(DriverSession? session) async {
    saved = session;
  }

  @override
  Future<Json?> ownerSession() async => admin;
  @override
  Future<void> saveOwner(Json? session) async {
    admin = session;
  }

  @override
  Future<Json> load() async => settings;
  @override
  Future<void> save(Json data) async {
    settings = data;
  }
}

class FakeApi extends TransitApi {
  Report? remote;
  bool revoked = false;
  Completer<Json>? adminLogin;
  @override
  Future<List<Report>> feed({String? driverId}) async =>
      remote == null ? [] : [remote!];
  @override
  Future<Report?> one(String id) async => remote;
  @override
  void subscribe(void Function() refresh) {}
  @override
  Future<DriverSession> login(String id, String pin) async =>
      DriverSession(id, 'a' * 64, DateTime.now().add(const Duration(days: 90)));
  @override
  Future<void> restore(DriverSession session) async {
    if (revoked) throw const ApiFailure('invalid_session');
  }

  @override
  Future<Report> publish(
    DriverSession session,
    Driver d,
    int? revision,
  ) async => remote = report(d, revision: (revision ?? 0) + 1);
  @override
  Future<Json> action(
    Json body, {
    String? token,
    String endpoint = 'driver-session',
  }) async {
    if (body['action'] == 'admin_login' && adminLogin != null) {
      return adminLogin!.future;
    }
    if (body['action'] == 'admin_restore') {
      return {'ok': false, 'role': 'driver'};
    }
    return {'ok': true};
  }
}

class FakeGps extends PhoneLocation {
  final fixes = StreamController<Json>.broadcast(sync: true);
  Completer<void>? permission;
  int streams = 0;
  @override
  Future<void> requestAccess() async {
    await permission?.future;
  }

  @override
  Stream<Json> positions() {
    streams++;
    return fixes.stream;
  }
}

class FakeUnlock extends PhoneUnlock {
  bool allowed = true;
  @override
  Future<bool> supported() async => true;
  @override
  Future<bool> unlock(bool ar) async => allowed;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('remembered login restores the personal profile without silently starting GPS', () async {
    final api = FakeApi(), store = MemoryStore(), gps = FakeGps();
    store.saved = DriverSession(
      'driver-1',
      'a' * 64,
      DateTime.now().add(const Duration(days: 1)),
    );
    final c = AppController(
      api: api,
      store: store,
      gps: gps,
      unlock: FakeUnlock(),
    );
    try {
      await c.initialize();
      expect(c.owner!.id, 'driver-1');
      expect(c.publisher.active, isFalse);
      expect(gps.streams, 0);
    } finally {
      c.dispose();
      await gps.fixes.close();
    }
  });
  test(
    'revoked remembered sessions clear identity and secure storage',
    () async {
      final store = MemoryStore()
        ..saved = DriverSession(
          'driver-1',
          'a' * 64,
          DateTime.now().add(const Duration(days: 1)),
        );
      final c = AppController(
        api: FakeApi()..revoked = true,
        store: store,
        gps: FakeGps(),
        unlock: FakeUnlock(),
      );
      try {
        await c.initialize();
        expect(c.owner, isNull);
        expect(store.saved, isNull);
        expect(c.publisher.active, isFalse);
      } finally {
        c.dispose();
      }
    },
  );
  test('phone unlock cancellation cannot expose a remembered driver', () async {
    final store = MemoryStore()
      ..settings = {'lockEnabled': true}
      ..saved = DriverSession(
        'driver-1',
        'a' * 64,
        DateTime.now().add(const Duration(days: 1)),
      );
    final c = AppController(
      api: FakeApi(),
      store: store,
      gps: FakeGps(),
      unlock: FakeUnlock()..allowed = false,
    );
    try {
      await c.initialize();
      await c.restore();
      expect(c.owner, isNull);
      expect(c.hasSavedSession, isTrue);
    } finally {
      c.dispose();
    }
  });
  test(
    'cancelling a pending permission request cannot start GPS afterward',
    () async {
      final gps = FakeGps()..permission = Completer<void>();
      final c = AppController(
        api: FakeApi(),
        store: MemoryStore(),
        gps: gps,
        unlock: FakeUnlock(),
      );
      try {
        await c.initialize();
        await c.login('driver-1', '123456');
        final start = c.startSharing();
        await Future<void>.delayed(Duration.zero);
        await c.stopSharing();
        gps.permission!.complete();
        await start;
        expect(c.publisher.active, isFalse);
        expect(gps.streams, 0);
      } finally {
        c.dispose();
        await gps.fixes.close();
      }
    },
  );
  test('a newer conflicting revision needs a new explicit choice before GPS starts', () async {
    final api = FakeApi(),
        gps = FakeGps(),
        c = AppController(
          api: FakeApi(),
          store: MemoryStore(),
          gps: FakeGps(),
          unlock: FakeUnlock(),
        );
    c.dispose();
    final actual = AppController(
      api: api,
      store: MemoryStore(),
      gps: gps,
      unlock: FakeUnlock(),
    );
    try {
      await actual.initialize();
      await actual.login('driver-1', '123456');
      api.remote = report(fixture(passengers: 1), revision: 2);
      await actual.startSharing();
      expect(actual.conflict!.revision, 2);
      expect(gps.streams, 0);
      final signature = canonical(operationalSettings(actual.owner!));
      api.remote = report(fixture(passengers: 2), revision: 3);
      await actual.startSharing(
        usePhone: true,
        confirmedRevision: 2,
        confirmedSignature: signature,
      );
      expect(actual.conflict!.revision, 3);
      expect(gps.streams, 0);
    } finally {
      actual.dispose();
      await gps.fixes.close();
    }
  });
  test('request decisions are single-use, respect capacity and preserve archived passenger totals', () async {
    final c = AppController(
      api: FakeApi(),
      store: MemoryStore(),
      gps: FakeGps(),
      unlock: FakeUnlock(),
    );
    try {
      await c.initialize();
      await c.login('driver-1', '123456');
      c.owner = fixture(passengers: 6);
      c.requests = [
        {
          'id': 'one',
          'driverId': 'driver-1',
          'passengerName': 'Family',
          'seatCount': 2,
          'status': 'pending',
        },
      ];
      expect(c.decideRequest('one', true), isFalse);
      expect(c.requests.single['status'], 'pending');
      c.owner = fixture(passengers: 5);
      expect(c.decideRequest('one', true), isTrue);
      expect(c.owner!.passengers, 7);
      expect(c.decideRequest('one', true), isFalse);
      c.confirmedLogs.add({
        'driverId': 'driver-1',
        'seatCount': 7,
        'passengerName': 'Earlier passengers',
      });
      c.archiveTrip();
      expect(c.archives.single['passengersCount'], 9);
      expect(c.owner!.passengers, 0);
      c.archiveTrip();
      expect(c.archives.length, 1);
    } finally {
      c.dispose();
    }
  });
  test(
    'only server-verified owners can preview demo or delete archive entries',
    () async {
      final c = AppController(
        api: FakeApi(),
        store: MemoryStore(),
        gps: FakeGps(),
        unlock: FakeUnlock(),
      );
      try {
        await c.initialize();
        c.setDemo(true);
        expect(c.demo, isFalse);
        c.archives = [
          {'id': 'trip'},
        ];
        await c.deleteArchives({'trip'});
        expect(c.archives.length, 1);
        c.adminAuthenticated = true;
        c.setDemo(true);
        expect(c.visibleReports.length, 1);
        await c.logoutAdmin();
        expect(c.demo, isFalse);
        expect(c.adminAuthenticated, isFalse);
      } finally {
        c.dispose();
      }
    },
  );
  test(
    'an owner login arriving after logout cannot restore administration',
    () async {
      final api = FakeApi()..adminLogin = Completer<Json>();
      final c = AppController(
        api: api,
        store: MemoryStore(),
        gps: FakeGps(),
        unlock: FakeUnlock(),
      );
      try {
        await c.initialize();
        final login = c.loginAdmin('123456789012');
        await Future<void>.delayed(Duration.zero);
        await c.logoutAdmin();
        api.adminLogin!.complete({
          'ok': true,
          'role': 'admin',
          'token': 'b' * 64,
          'expires_at': DateTime.now()
              .add(const Duration(days: 1))
              .toIso8601String(),
        });
        await login;
        expect(c.adminAuthenticated, isFalse);
      } finally {
        c.dispose();
      }
    },
  );
}
