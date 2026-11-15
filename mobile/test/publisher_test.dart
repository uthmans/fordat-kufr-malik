import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kufr_malik_transit/domain/transit.dart';
import 'package:kufr_malik_transit/domain/publisher.dart';
import 'package:kufr_malik_transit/data/backend.dart';

import 'fixtures.dart';

void main() {
  test(
    'seat changes remain pending until their own server acknowledgment',
    () async {
      final responses = <Completer<Report>>[];
      String status = '';
      final p = ReliablePublisher(
        read: (_) async => null,
        send: (driver, revision) {
          final response = Completer<Report>();
          responses.add(response);
          return response.future;
        },
        saved: (_) {},
        state: (next, _) => status = next,
      );
      p.start('driver-1', report(fixture(passengers: 5)));
      final six = fixture(passengers: 6), seven = fixture(passengers: 7);
      p.queue(six);
      expect(status, 'pending');
      final first = p.flush();
      p.queue(seven);
      responses[0].complete(report(six, revision: 2));
      await first;
      expect(status, 'pending');
      final second = p.flush();
      responses[1].complete(report(seven, revision: 3));
      await second;
      expect(status, 'live');
    },
  );
  test(
    'temporary outage resumes the latest state without another share tap',
    () async {
      var now = epoch(), sends = 0, reads = 0;
      Driver? sent;
      final p = ReliablePublisher(
        read: (_) async {
          reads++;
          return null;
        },
        send: (d, _) async {
          sends++;
          if (sends == 1) throw const ApiFailure('unavailable');
          sent = d;
          return report(d);
        },
        saved: (_) {},
        state: (_, _) {},
        clock: () => now,
      );
      p.start('driver-1', null);
      p.queue(fixture());
      await p.flush();
      p.queue(fixture(passengers: 6));
      await p.flush();
      expect(sends, 1);
      now += 2000;
      await p.flush();
      expect(sends, 2);
      expect(reads, 1);
      expect(sent!.passengers, 6);
    },
  );
  test(
    'a committed upload with a lost reply is recognised, not duplicated',
    () async {
      var now = epoch(), sends = 0;
      Report? remote;
      final p = ReliablePublisher(
        read: (_) async => remote,
        send: (d, _) async {
          sends++;
          remote = report(d, revision: 7);
          throw const ApiFailure('unavailable');
        },
        saved: (_) {},
        state: (_, _) {},
        clock: () => now,
      );
      p.start('driver-1', null);
      p.queue(fixture());
      await p.flush();
      now += 2000;
      await p.flush();
      expect(sends, 1);
    },
  );
  test('a competing phone never gets overwritten during recovery', () async {
    var now = epoch(), sends = 0;
    String state = '';
    final initial = report(fixture(), revision: 2),
        competing = report(fixture(passengers: 1), revision: 3);
    final p = ReliablePublisher(
      read: (_) async => competing,
      send: (d, _) async {
        sends++;
        throw const ApiFailure('conflict');
      },
      saved: (_) {},
      state: (s, _) => state = s,
      clock: () => now,
    );
    p.start('driver-1', initial);
    p.queue(fixture(passengers: 6));
    await p.flush();
    now += 2000;
    await p.flush();
    expect(state, 'conflict');
    expect(p.active, isFalse);
    expect(sends, 1);
  });
  test(
    'logout and stop ignore a late response and cannot be revived by reconnect',
    () async {
      var saved = 0;
      final response = Completer<Report>();
      final p = ReliablePublisher(
        read: (_) async => null,
        send: (d, _) => response.future,
        saved: (_) => saved++,
        state: (_, _) {},
      );
      p.start('driver-1', null);
      p.queue(fixture());
      final pending = p.flush();
      p.stop();
      response.complete(report(fixture()));
      await pending;
      p.reconnect();
      await p.flush();
      expect(saved, 0);
      expect(p.active, isFalse);
    },
  );
  test('revoked sessions are terminal and stale GPS never publishes', () async {
    var sends = 0;
    final p = ReliablePublisher(
      read: (_) async => null,
      send: (d, _) async {
        sends++;
        throw const ApiFailure('invalid_session');
      },
      saved: (_) {},
      state: (_, _) {},
    );
    p.start('driver-1', null);
    p.queue(fixture(timestamp: epoch() - 120000));
    await p.flush();
    expect(sends, 0);
    p.queue(fixture());
    await p.flush();
    p.reconnect();
    await p.flush();
    expect(sends, 1);
    expect(p.active, isFalse);
  });
}
