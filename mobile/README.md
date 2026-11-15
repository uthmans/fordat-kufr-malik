# Kufr Malik Transit — Flutter pilot

Native Android and iPhone implementation alongside the existing React website.
Use Flutter **3.50.0** / Dart **3.14.0**. Direct dependencies and pubspec.lock are pinned.

```sh
flutter pub get --enforce-lockfile
flutter analyze
flutter test
flutter build apk --debug
# On macOS with Xcode:
flutter build ios --release --no-codesign
```

The GitHub `Flutter mobile pilot` workflow runs analysis/tests and separate Android
and iOS builds. The Android artifact is a debug pilot APK. The iPhone artifact is
unsigned and cannot be installed through TestFlight until Apple signing is set up.
No signing certificates, passwords, private handover files or service-role keys
belong in this repository.

The public Supabase URL/key default to the existing project; optional overrides
use BACKEND_URL and BACKEND_PUBLIC_KEY Dart defines. The native app reuses the
existing driver-session and driver-security Edge Functions. It does not use
Supabase email authentication or send driver tokens to the public database API.

For a read-only contract check:

```sh
dart run tool/verify_backend.dart
```

Read MIGRATION.md for implemented features, known gaps and release gates.
This is a pilot: native background tracking and OS unlock need real-device tests.
The current website remains available during migration. A Flutter web preview is
only for checking the UI and API contract, not background GPS.