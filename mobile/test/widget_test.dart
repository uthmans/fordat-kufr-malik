import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kufr_malik_transit/app_controller.dart';
import 'package:kufr_malik_transit/ui/app.dart';

import 'fixtures.dart';

void main() {
  for (final ar in [true, false]) {
    testWidgets(
      'Passenger screen keeps old drivers visible at phone width, Arabic=$ar',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final c = AppController();
        c.ready = true;
        c.ar = ar;
        c.roster = [fixture()];
        c.reports = [
          report(
            fixture(timestamp: DateTime.now().millisecondsSinceEpoch - 180000),
          ),
        ];
        await tester.pumpWidget(TransitApp(controller: c));
        await tester.pump();
        expect(
          find.text(
            ar
                ? 'آخر ظهور — التوفر غير مؤكد'
                : 'Last seen — availability unconfirmed',
          ),
          findsOneWidget,
        );
        expect(find.text(ar ? 'اتصال' : 'Call'), findsWidgets);
        expect(tester.takeException(), isNull);
        await tester.tap(find.text(ar ? 'السائق' : 'Driver').last);
        await tester.pumpAndSettle();
        expect(
          find.text(ar ? 'دخول السائق' : 'Driver sign-in'),
          findsOneWidget,
        );
        expect(find.text(ar ? 'علاء حمايل' : 'Alaa Hamayel'), findsWidgets);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        c.dispose();
      },
    );
  }
}
