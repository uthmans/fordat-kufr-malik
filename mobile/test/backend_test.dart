import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kufr_malik_transit/data/backend.dart';

import 'fixtures.dart';

void main() {
  test(
    'native sign-in sends normalized PIN only to the private login endpoint',
    () async {
      final api = TransitApi(
        client: MockClient((request) async {
          expect(request.url.path, '/functions/v1/driver-session');
          expect(jsonDecode(request.body)['code'], '01234567');
          expect(request.headers.containsKey('authorization'), isFalse);
          return http.Response(
            jsonEncode({
              'ok': true,
              'driver_id': 'driver-1',
              'token': 'a' * 64,
              'expires_at': DateTime.now()
                  .add(const Duration(days: 90))
                  .toIso8601String(),
            }),
            200,
          );
        }),
      );
      final session = await api.login('driver-1', '٠١٢٣٤٥٦٧');
      expect(session.driverId, 'driver-1');
      await api.dispose();
    },
  );
  test('public feed requests never contain driver session tokens', () async {
    final driver = fixture();
    final api = TransitApi(
      client: MockClient((request) async {
        expect(request.url.path, '/rest/v1/transit_driver_live');
        expect(request.headers.containsKey('authorization'), isFalse);
        return http.Response(
          jsonEncode([
            {
              'driver_id': driver.id,
              'snapshot': driver.snapshot,
              'revision': 1,
              'received_at': DateTime.now().toIso8601String(),
            },
          ]),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    expect((await api.feed()).length, 1);
    await api.dispose();
  });
  test(
    'a login for the wrong profile cannot become a remembered session',
    () async {
      final api = TransitApi(
        client: MockClient(
          (_) async => http.Response(
            jsonEncode({
              'ok': true,
              'driver_id': 'driver-2',
              'token': 'a' * 64,
              'expires_at': DateTime.now()
                  .add(const Duration(days: 1))
                  .toIso8601String(),
            }),
            200,
          ),
        ),
      );
      await expectLater(
        api.login('driver-1', '123456'),
        throwsA(isA<ApiFailure>()),
      );
      await api.dispose();
    },
  );
}
