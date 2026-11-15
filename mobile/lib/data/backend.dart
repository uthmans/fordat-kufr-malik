import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/transit.dart';
import 'config.dart';

// These are public client identifiers. Driver tokens are sent only to the
// existing self-authenticating Edge Functions, never as database JWTs.

class ApiFailure implements Exception {
  final String code;
  const ApiFailure(this.code);
  bool get retryable => ['unavailable', 'rate_limited'].contains(code);
  @override
  String toString() => code;
}

class DriverSession {
  final String driverId, token;
  final DateTime expires;
  DriverSession(this.driverId, this.token, this.expires);
  factory DriverSession.parse(Json value) {
    final id = value['driver_id'] as String, token = value['token'] as String;
    final expiry = DateTime.parse(value['expires_at'] as String);
    if (!RegExp(r'^driver-[1-8]$').hasMatch(id) ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(token) ||
        !expiry.isAfter(DateTime.now())) {
      throw const FormatException('Invalid session');
    }
    return DriverSession(id, token, expiry);
  }
  Json serialize() => {
    'driver_id': driverId,
    'token': token,
    'expires_at': expires.toUtc().toIso8601String(),
  };
}

class TransitApi {
  final http.Client client;
  SupabaseClient? _realtime;
  RealtimeChannel? _channel;
  TransitApi({http.Client? client}) : client = client ?? http.Client();
  Future<Json> action(
    Json body, {
    String? token,
    String endpoint = 'driver-session',
  }) async {
    try {
      final reply = await client
          .post(
            Uri.parse('$backendUrl/functions/v1/$endpoint'),
            headers: {
              'Content-Type': 'application/json',
              'apikey': publicKey,
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
      if (reply.statusCode >= 500) throw const ApiFailure('unavailable');
      final data = Map<String, dynamic>.from(
        jsonDecode(utf8.decode(reply.bodyBytes)) as Map,
      );
      if (data['ok'] != true) {
        throw ApiFailure(data['error'] as String? ?? 'unavailable');
      }
      return data;
    } on ApiFailure {
      rethrow;
    } catch (_) {
      throw const ApiFailure('unavailable');
    }
  }

  Future<List<Report>> feed({String? driverId}) async {
    try {
      final uri = Uri.parse('$backendUrl/rest/v1/transit_driver_live').replace(
        queryParameters: {
          'select': 'driver_id,revision,received_at,snapshot',
          if (driverId != null) 'driver_id': 'eq.$driverId',
        },
      );
      final response = await client
          .get(uri, headers: {'apikey': publicKey})
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) throw const ApiFailure('unavailable');
      final reports = (jsonDecode(utf8.decode(response.bodyBytes)) as List)
          .map(Report.parse)
          .toList();
      if (reports.map((r) => r.driver.id).toSet().length != reports.length ||
          (driverId != null && reports.any((r) => r.driver.id != driverId))) {
        throw const FormatException('Invalid feed');
      }
      return reports;
    } catch (_) {
      throw const ApiFailure('unavailable');
    }
  }

  Future<Report?> one(String id) async {
    final rows = await feed(driverId: id);
    return rows.isEmpty ? null : rows.single;
  }

  Future<DriverSession> login(String id, String pin) async {
    final code = normalizePin(pin);
    if (!RegExp(r'^\d{6,8}$').hasMatch(code)) {
      throw const ApiFailure('invalid_code');
    }
    final session = DriverSession.parse(
      await action({'action': 'login', 'driver_id': id, 'code': code}),
    );
    if (session.driverId != id) throw const ApiFailure('invalid_session');
    return session;
  }

  Future<void> restore(DriverSession session) async {
    final result = await action({'action': 'restore'}, token: session.token);
    if (result['driver_id'] != session.driverId ||
        !DateTime.parse(result['expires_at'] as String)
            .isAfter(DateTime.now())) {
      throw const ApiFailure('invalid_session');
    }
  }

  Future<Report> publish(
    DriverSession session,
    Driver driver,
    int? revision,
  ) async {
    if (session.driverId != driver.id ||
        !session.expires.isAfter(DateTime.now())) {
      throw const ApiFailure('invalid_session');
    }
    final result = await action({
      'action': 'publish',
      'driver_id': driver.id,
      'snapshot': driver.snapshot,
      'revision': revision,
    }, token: session.token);
    final report = Report.parse(result['row']);
    if (report.driver.id != session.driverId) {
      throw const ApiFailure('invalid_session');
    }
    return report;
  }

  Future<DriverSession> changePin(
    DriverSession session,
    String current,
    String next,
  ) async {
    if (!RegExp(r'^\d{6,8}$').hasMatch(normalizePin(next))) {
      throw const ApiFailure('invalid_code');
    }
    final replacement = DriverSession.parse(
      await action(
        {
          'action': 'change_pin',
          'code': normalizePin(current),
          'new_code': normalizePin(next),
        },
        token: session.token,
        endpoint: 'driver-security',
      ),
    );
    if (replacement.driverId != session.driverId) {
      throw const ApiFailure('invalid_session');
    }
    return replacement;
  }

  void subscribe(void Function() refresh) {
    _realtime ??= SupabaseClient(
      backendUrl,
      publicKey,
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    _channel = _realtime!
        .channel('native-driver-feed')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'transit_driver_live',
          callback: (_) => refresh(),
        )
        .subscribe((status, [_]) {
          if (status == RealtimeSubscribeStatus.subscribed) refresh();
        });
  }

  Future<void> dispose() async {
    if (_channel != null) await _realtime?.removeChannel(_channel!);
    await _realtime?.dispose();
    client.close();
  }
}
