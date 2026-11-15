import 'dart:convert';
import 'dart:io';

import 'package:kufr_malik_transit/data/config.dart';
import 'package:http/http.dart' as http;
import 'package:kufr_malik_transit/domain/transit.dart';

// Read-only compatibility check. No sign-in, GPS publication, duty or booking writes.
Future<void> main() async {
  final client = http.Client();
  try {
    final response = await client
        .get(
          Uri.parse(
            '$backendUrl/rest/v1/transit_driver_live?select=driver_id,revision,received_at,snapshot',
          ),
          headers: {'apikey': publicKey},
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw StateError('Feed check failed: ${response.statusCode}');
    }
    final reports = (jsonDecode(utf8.decode(response.bodyBytes)) as List)
        .map(Report.parse)
        .toList();
    stdout.writeln(
      jsonEncode({
        'reports': reports.length,
        'live': reports.where((r) => r.live(epoch())).length,
        'lastSeen': reports.where((r) => r.lastSeen(epoch())).length,
      }),
    );
  } finally {
    client.close();
  }
}
