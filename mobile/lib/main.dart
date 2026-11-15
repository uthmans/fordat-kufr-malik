import 'package:material_ui/material_ui.dart';

import 'app_controller.dart';
import 'ui/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = AppController();
  runApp(TransitApp(controller: controller));
  controller.initialize().catchError((Object error) {
    controller.initializationFailed();
  });
}
