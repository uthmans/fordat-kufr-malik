# Flutter migration status

Started 15 November 2026. Target: Android **and** iPhone. Existing React website
and Supabase service remain operational during the migration. This directory is
a native pilot, not a declaration of production readiness.

## Implemented in the pilot

- Arabic/English, native RTL layout, light/dark appearance and accessible controls.
- Eight real roster identities and the existing self-authenticating driver API.
  No default PINs, private handover codes, email requirement or service-role key.
- Opaque driver sessions in platform secure storage; server-verified restoration;
  explicit switch/sign-out; self-service 6–8 digit PIN changes.
- Optional local fingerprint/face/device-passcode gate for a remembered session.
  This is local authentication, not a replacement for server authorization and
  not a server-side WebAuthn PIN-reset proof. Forgotten PIN recovery remains the
  existing owner procedure. Enabling phone unlock needs a successful OS prompt.
- Driver-initiated native GPS. Android foreground notification/wake-lock settings
  and iOS Core Location background mode/indicator are configured. Stop, sign-out,
  denied permissions and cancelled startup cannot start a late GPS subscription.
- Realtime public feed with polling fallback; last-seen reports; stale seat and
  departure expiry; revision-checked network recovery with latest queued data.
- Route drawing, alternate-route area and GPS-accuracy rejection. Off-corridor
  locations are not assigned to Kufr Malik; an unknown road is not assigned an
  invented named detour. Existing route coordinates are approximate and need
  validation on the actual roads before rollout.
- Passenger counts, departure announcements, prayer shifts, inactivity timeout,
  profile editing, Call, direct WhatsApp and separate reservation actions.
- Locally remembered primary reservation name and multiple seats. WhatsApp
  requests still require driver confirmation; they are not cloud reservations.
- Local request decisions, trip entries and archives; server-authenticated owner
  screen; owner-only unpublished simulation; confirmed archive deletion.

## Release gates still open

1. Native Android and iOS compilation must pass in the mobile workflow. An
   unsigned iPhone build is not an installable TestFlight/App Store release.
2. The owner has no Apple Developer account yet. Signed iPhone distribution is
   blocked until an account/team and signing setup exist. No enrollment or
   purchase has been performed. Apple eligibility/fee waivers must be checked
   with Apple; a charitable purpose alone is not an eligibility claim.
3. Real Android/iPhone tests: screen locked, app backgrounded, WhatsApp open,
   network outage/recovery, revoked permission, approximate GPS, battery saver,
   off-duty transition, and force termination. No simulator/unit test can certify
   unattended location delivery. Force-stopping an app may require reopening it.
4. Sign-in, PIN rotation and phone-unlock prompts need real-device acceptance.
   Tests use synthetic sessions and never rotate real driver codes.
5. Browser local histories/reservation drafts do not automatically transfer into
   an installed native app. An explicit validated export/import process is still
   needed if those histories must be retained. Existing cloud reports are reused.
6. Local pilot preferences are serialized to prevent older writes replacing newer
   state. Important long-term trip archives should move to a transactional local
   database with export/backup before full rollout.
7. Owner credential provisioning/recovery and some legacy local roster tools
   continue through the existing secured owner workflow. No new privileged reset
   endpoint has been added or exposed in the native app.
8. Replace generated launcher/store artwork, complete bilingual store metadata,
   privacy/contact information, background-location disclosures, signing,
   distribution channels and final accessibility checks.

## Rollout

Keep the existing website available. Install a pilot Android build on one driver's
phone, prepare a signed iPhone pilot once Apple setup exists, and observe both
against a passenger phone. Record timestamps, app foreground/background state,
network state and permission state for each test. Never publish simulated GPS to
the production feed to demonstrate a passing test.

The Flutter web build is for visual/contract verification during development. It
has the same browser background-location limits as any website and is not proof
that native background tracking works.
