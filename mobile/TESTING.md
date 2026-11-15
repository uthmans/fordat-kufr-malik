# Native pilot: two-phone test

Use the APK from the latest successful **Flutter mobile pilot** workflow for this
PR. Extract the downloaded artifact and install `app-debug.apk` on the Android
test phone. This is a test build. The unsigned iPhone artifact is **not** an
installable IPA; prepare a signed iPhone build after Apple signing is available.

Use a stationary driver for the initial steps. For a route test, let a passenger
operate the observer phone while the driver drives.

1. **Sign in on the driver's phone.** Select the real profile and enter its
   current private PIN. Close and reopen normally. The personal dashboard should
   restore without selecting the driver again, and GPS should remain off until
   the driver starts sharing.
2. **Start the shift.** Tap Start shift and share location. Respond to the OS
   location prompts. On Android check the ongoing location notification; on
   iPhone check the location indicator. A fresh position must arrive before the
   app claims a published live location. If another phone has different settings,
   review the conflict instead of blindly choosing a version.
3. **Watch from the passenger phone.** The existing website can serve as the
   observer during migration. Confirm the correct name, direction, position and
   seat count. Change the count once on the driver phone. It should show Sending
   until acknowledged, and then appear on the observer. Do not send a real
   WhatsApp request or make a call unless the driver expects it.
4. **Test background tracking.** Press Home, use WhatsApp, and lock the driver's
   screen in separate tests of at least five minutes. Do not force-stop the app
   for this test. Observe update timestamps from the other phone; they should
   continue to refresh. Record any stopped updates, battery-saver settings and
   permission choices. Passing a web-preview test does not count as passing this
   native background test.
5. **Test a network outage.** Turn off data/Wi-Fi for more than two minutes while
   GPS stays enabled. The observer should keep a labelled last-seen report, with
   no confirmed live seat count. Restore internet without tapping Share again.
   Updates should resume automatically, normally within about a minute when
   a fresh GPS fix and working connection are available.
6. **End the shift.** Tap End shift while online and wait for the off-duty
   acknowledgment. Check that the precise location is cleared on the observer
   and the native location indicator/service stops. Starting the next shift
   should take one Start shift tap. Separately test Stop sharing, sign-out and
   permission revocation: none should silently restart GPS.

Before wider distribution, also test:

- A second phone editing the same profile: publication must stop for a conflict,
  and a choice made against an older revision must not overwrite a newer update.
- Native phone unlock, cancellation, re-entry after backgrounding and PIN change.
  A PIN change affects that driver's real account; have the driver choose and
  enter the new PIN themselves. Keep private codes out of test reports.
- Turmusaya and an unmapped road: no marker should claim the driver is in Kufr
  Malik merely because the driver left the normal corridor.
- One, two and three-seat requests; saved name editing; correct driver dialler
  and WhatsApp destinations. WhatsApp confirmation remains required.
- Off-duty requests, full vehicles, repeated confirmation, trip archival and
  owner-only archive deletion. The current pilot's request/archive data is local.

For each failure record: phone model, OS version, build/run link, time, foreground
or background state, network state, location permission/accuracy, and what the
observer showed. Do not include PINs, session tokens or unnecessary coordinates.
