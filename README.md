# Kufr Malik Transit

React and Vite app for Kufr Malik–Ramallah transit.

## Local development

Use Node.js 24 and Bun. Install dependencies with `bun install --frozen-lockfile`,
then run `bun run dev`. Open the URL printed by Vite with `/fordat-kufr-malik/`.

## GitHub Pages

In this repository's **Settings → Pages → Build and deployment**, set **Source**
to **GitHub Actions**. The workflow builds the app and deploys only `dist/` when
changes reach `main`. Pull requests run the build without publishing.
Each build attempt uses a distinct Pages artifact name and passes that name to
deployment, so retrying a cancelled build cannot create ambiguous duplicate
`github-pages` packages. Retrying only deployment reuses the build job's output.

The published URL is https://uthmans.github.io/fordat-kufr-malik/.
Vite's base path and the PWA manifest must all use `/fordat-kufr-malik/`.
Publishing the source directory directly will leave an empty page because
browsers cannot execute the unbuilt React TypeScript entry point.

To verify a production build locally, run `bun run build` followed by
`bun run preview`, then open the printed URL with `/fordat-kufr-malik/`.

## WhatsApp reservations

Submitting a valid reservation saves one local request and opens the pre-filled
WhatsApp draft directly from the submit tap. The prepared-message screen stays
open with a native retry link, so a blocked popup or a return from WhatsApp does
not require another reservation submission. Retrying that link does not create
another saved request. The passenger still needs to send the message in WhatsApp
and wait for the driver's confirmation; preparing a draft does not confirm seats.

## App updates

Production builds check for updates when the app returns to the foreground,
reconnects, and every five minutes while visible and online. A downloaded update
shows an Arabic or English notice without reloading an open booking or edit.
Choose **Update now** after finishing your work, or **Later** to dismiss the notice
for that session. **Settings & GPS → App updates** also provides a manual check
and keeps a deferred update available. Updating does not clear saved identities
or other local app data.

## Driver access codes (no email or SMS)

Drivers select their roster name and enter a private eight-digit access code.
The server verifies a bcrypt hash and issues a random 256-bit session lasting
up to 90 days. The browser remembers only the opaque session, never the code.
Restoration checks the server before opening the dashboard. Switch Driver clears
the local session immediately and revokes it server-side when reachable.

Five incorrect attempts lock the selected driver's code for 15 minutes. A
separate source limit allows at most 30 attempts in a 15-minute window. Existing
valid sessions remain usable during a code lock, and code rotation/disablement
invalidates sessions through a credential version check. No Supabase Auth user,
email address, SMS or third-party login is required for a driver.

Legacy local PINs are no longer displayed or edited in the app. Private driver
codes stay in their handover file and are never copied into the roster UI.
The former public administrator PIN and saved local admin flag grant no access.
Administration uses a separate server-verified 12-digit owner code and seven-day
session. Driver sessions cannot authenticate as administrator, and an admin
session cannot publish as a driver. Admin controls for local logs/profiles remain
local; server access-code rotation remains a separate trusted operation.

The owner opens `/#/admin` to sign in. That URL is an entry point, not a secret or
an authorization check. No administration link is shown on driver login or normal
Settings. Only a verified administrator sees demo controls, simulation tools and
prototype reset. Saved demo preferences cannot activate these tools for normal
users. Admin logout disables demo preview, stops simulation and invalidates stale
demo controls immediately.

`scripts/prepare-admin-code.ts` prepares a private owner handover file outside the
repository at `../outputs/private-transit/admin-access.json`; it never rotates an
existing code. The private admin migration and SQL rollback tests are in
`supabase/migrations/20261105205913_private_admin_sessions.sql` and
`supabase/tests/private_admin_sessions.sql`. The schema is applied, its SQL role
isolation/lockout tests passed, and the private owner code and updated Edge Function
are activated. HTTP checks verified administrator login/restoration/logout while
driver login remained working. The browser check verified protected roster access,
no PIN displays, owner-only demo controls and their removal on admin logout.

Phone-feedback releases are intentionally separated: (1) admin/privacy and private
demo tools; (2) one-button live GPS sharing with a real-fix wait; (3) responsive
departure announcements and passenger Call/WhatsApp actions.
All three phone-feedback releases are implemented. Announcement buttons stack on
narrow phones and wrap full labels on wider screens. Driver cards and the contact
directory offer separate Call and WhatsApp actions. Call opens the phone dialer
with the normalized international number; WhatsApp retains the name/seat booking
flow. Invalid phone numbers disable both contact actions. No booking is created
by choosing Call. Real phone-to-phone GPS still requires a driver trial.

## Shared availability and delivery status

The public active list requires both a server report and real GPS less than two
minutes old. Expired on-duty records move to the contact directory with an
availability warning, rather than remaining active indefinitely. Phone and
WhatsApp contact actions remain available. Off-duty notices require a recent
server report too; unknown availability is not labelled off duty.

The driver dashboard distinguishes locally enabled duty from confirmed shared
updates. Sharing enabled alone does not mean delivery succeeded: the status
requires an acknowledged publication for this driver, current report/GPS and
matching duty, passenger count, shift and announcement settings. Pending changes,
offline state, location errors, stale reports and confirmed off-duty publication
have separate Arabic/English messages. A newer local GPS fix alone does not mark
normal minute-spaced location publishing as an unsent operational change.

## Damaged browser data

Saved driver, booking, log, and archive records are validated before use. Valid
records survive alongside damaged records, with duplicate IDs ignored. If no
usable driver roster remains, the app falls back to the legacy roster or initial
demo roster. Recovery reads do not clear or rewrite the original browser data;
normal edits continue to save the current recovered state.

Incoming BroadcastChannel snapshots are accepted only when the entire collection
is valid, so a malformed tab message cannot replace working state. Empty booking,
log, and archive snapshots still support normal clearing. GPS simulation messages
must contain finite progress between 0 and 100. A browser that blocks channel
creation can still run locally without tab sync.

## Departure announcements

Five- and ten-minute announcements display the remaining minutes from their
original saved timestamp, then disappear at the deadline. They never turn into
an automatic claim that the vehicle departed. “Leaving now” expires after two
minutes. Both dashboards use the same clock, refreshed every 15 seconds and on
return to the app. Reopening the app, GPS fixes, and profile edits do not restart
a timer. Expired buttons can be tapped again to post a new announcement.
Going off duty clears the announcement; off-duty drivers cannot post a new one.

## Archiving a trip

Archive & New Trip uses the latest booking state, saves one archive, and clears
that driver's current log, passenger count, and previous departure notice. A
repeated tap after this reset does not create an empty duplicate archive. Other
drivers' logs and previous archives are retained.

The archive total is the sum of included confirmed booking entries, without a
hard-coded seven-seat cap. If there are no named bookings (such as station
boarding), it records the current passenger count instead. This preserves the
recorded total, including trips with passenger turnover; it does not estimate
unrecorded boardings. Demo entries follow the existing preview setting.

## Off-duty booking requests

Pending requests stay available while a driver is off duty, but acceptance is
blocked until duty is resumed. The same check runs in the booking transition,
so an inactivity pause or duty change cannot be bypassed by a stale enabled
button. A blocked acceptance changes no passenger count, request status or trip
log and never resumes duty automatically. Arabic and English request cards show
the reason, while existing seat-capacity checks still apply after resuming.

Decline uses the latest request snapshot and requires the signed-in driver to own
a still-pending request. A late decline cannot overwrite an accepted request or
its confirmed log; repeated declines do nothing. Other requests, passenger counts
and trip logs are unchanged. Drivers may decline while off duty, and a rejected
action explains that the request may already have been handled.

## Resetting prototype data

Reset asks for confirmation before restoring demo driver profiles/PINs and
clearing bookings, active logs, archives, and remembered driver/admin sessions.
It sends one validated reset snapshot to other open tabs, where tracking,
simulation, sessions, and current booking/history refs are also reset. Receivers
do not rebroadcast the reset. Saved villager names and display/language
preferences are retained.

Every reset write and session removal is attempted even if browser storage is
restricted. The current app state still resets; Settings warns if saving any
part failed and old data could return on reopening. Tabs must be running this
version and support BroadcastChannel to receive the reset signal.

## Passenger counter consistency

Plus/minus changes, seat presets and Confirm current count use the latest driver
snapshot before saving, so rapid taps accumulate and a just-accepted booking or
other driver/GPS update is retained. Confirmation refreshes the current count
without writing an older displayed value. Counts stay within the configured
capacity, and a tap beyond zero/full does not refresh confirmation timestamps.
Editing the count never resumes duty or removes an inactivity pause.

## Driver profile edits

Driver and admin forms submit only editable fields changed from the snapshot
taken when the form opened. Saves merge into the latest driver state, retaining
newer GPS, booking counts, duty state, other drivers, and untouched phone/PIN
changes. Profile writes cannot replace operational fields such as IDs or GPS.
Invalid names, WhatsApp numbers, PINs or capacities reject the save; capacity
cannot be reduced below current occupancy. Failed saves keep the form open and
show an error rather than reporting success. A save with no changes writes nothing.

Duty toggles, prayer/late-shift controls, departure announcements, duty resume and
driver notes also use the latest driver snapshot. Consecutive actions retain
each other's updates, newer profile edits and just-accepted bookings. Editing a
note does not clear an inactivity pause; explicit duty resume is still required.
GPS fixes, login activation and inactivity checks commit to the same current
snapshot immediately, so later controls do not wait for React to rerender before
seeing those updates.

New seat requests append to the latest request collection, retaining arrivals and
accepted/declined statuses from earlier actions. Creation rechecks the current
driver and vehicle capacity before saving the primary name. The modal uses the
current rendered driver phone/capacity at submission; a rejected or throwing
save keeps the draft retryable and does not open WhatsApp. Successful handoffs
remain synchronous and deduplicate repeated taps within the same modal session.

WhatsApp numbers support English, Arabic-Indic and Persian digits, including
mixed input, copied RTL formatting marks and `00` international dial-out prefixes.
For example, `٠٥٩٩١١١٢٢٢` and `00970 599 111 222` both target `970599111222`.
Explicit `+972`/`00972` prefixes remain `972`; saved profile text and its LTR
display are preserved. All booking, confirmation and contact links use the same
normalizer, while existing empty/incomplete-number validation still applies.

Sign-in checks the latest assigned PIN, including profile changes made since the
screen rendered. Booking acceptance checks the current session immediately, so
handlers captured before logout or a driver switch cannot accept the previous
driver's requests. Session changes stop real GPS and simulation synchronously;
queued simulation ticks are invalidated rather than reassigned to the next
driver. These remain browser-local profile controls, not server authentication.

Archive deletion requires an explicit Arabic/English confirmation. Clear All
captures the visible trip IDs when that dialog opens and removes only those IDs
from the latest archive state, preserving new arrivals. Repeated or unknown-ID
deletions do nothing; stale handlers after admin logout are rejected. Current
bookings, active logs and passenger counts are unaffected by archive deletion.

Passenger shortcuts follow configured capacity. Smaller vehicles do not show
out-of-range presets, and FULL reads the current capacity when tapped instead of
assuming seven seats. Larger vehicles retain compact zero-to-six shortcuts plus
FULL; intermediate counts remain available through the stepper or seat diagram.
On phones the shortcuts wrap into four columns with at least 44px button height.

Passenger count edits and confirmations require the currently signed-in driver
to own the target profile. Old plus/minus, preset, seat and FULL handlers become
inert immediately after logout or switching drivers, including before React
rerenders. Rejected actions do not write counts or refresh their timestamps.
Signing back in restores the controls for that driver. These are browser-local
session checks; the prototype still requires server-side authorization for shared
production accounts.

## Shared driver updates (first backend stage)

The first shared-data stage is a public driver feed, separate from private
booking requests, trip logs, credentials and archives. `sharedDriver.ts` defines
the allowlisted public payload and validates server revisions, so a late response
cannot replace a newer driver update. Unknown payload fields are rejected.

The migrations in `supabase/migrations` are applied to the Free
Kufr Malik Transit project (`pwrsxqlunxntvqholhiz`) in the Salama organization.
The current public feed is `transit_driver_live`. Its database grants allow
browser roles to read only. An Edge Function checks private code sessions before
calling a service-role-only SQL gateway, which validates ownership and revision
inside the same transaction as the write. Browsers cannot read credential hashes,
session hashes or login-limit records, call the privileged RPC, or write the feed
directly. The former email-authenticated feed is retained unused for migration
history; the frontend neither reads nor writes it. No existing records were deleted.
Publishers must update using both driver ID and the last acknowledged revision;
a zero-row update is a conflict and must trigger a refresh, not a blind overwrite.

The frontend reads this feed using the public URL and publishable key in
`src/config/sharedBackend.ts`. No database password or secret/service-role key
belongs in the browser. Viewers subscribe only while the app is visible and
online; reconnect refetches the database snapshot. A five-minute reconciliation
also recovers missed events. Local/demo GPS is excluded from the public view.

Driver Mode verifies the selected driver's private code. Local PINs, the demo
admin PIN, and saved local driver IDs cannot authorize cloud publishing.
Driver Mode and Settings provide a single **Share my location now** button.
It stops simulation, hides demo data, starts phone GPS, waits for a fresh valid
fix, then compares saved phone settings with the latest published settings.
Different duty, passenger counts, shifts or departure settings require an explicit
choice: use this phone or use published settings. Settings are not replaced and
publishing does not start while waiting for that choice. Both sources are rechecked before proceeding;
a newer server revision or local edit invalidates an old confirmation. Every write
still requires the matching server revision, so a later update from another phone
stops publication rather than being overwritten. This phone retains its own GPS
and recent duty activity even when published settings are selected.
Finding-location and connecting states can be cancelled;
late GPS callbacks and server reads cannot restart a cancelled publication.
GPS-only publications are limited to one per minute, while seat/duty changes
publish on the next two-second flush. Unchanged snapshots are skipped. Simulation
and old GPS are not uploaded. Going off duty removes precise GPS from the
published snapshot. A failed/conflicting save stops publication and requires
starting again to reconcile; old data is never automatically replayed.

Sharing must be started after each app launch. A restored cloud account is not
permission to silently restart GPS publication. Stopping sharing leaves the last
snapshot subject to existing freshness checks; it does not change duty. Driver
logout, switching local profiles, reset and cloud sign-out stop the publisher.
The Stop sharing button also stops this phone's GPS watch. Permission denial,
signal failure and offline startup have plain Arabic/English recovery messages.
Ordinary drivers no longer have a separate GPS toggle or simulation panel.
The install banner explains that live updates and WhatsApp messages need internet.
The driver's booking panel explicitly states that requests from other phones
arrive through WhatsApp and do not automatically appear in the local request list.

### Private code handover

Eight unique access codes have been provisioned for the existing roster. Their
plaintext handover copy is outside the repository at
`../outputs/private-transit/driver-access-codes.json`; each driver should receive
only their own code. Never commit that file. `scripts/prepare-driver-codes.ts`
creates a handover file only when absent and does not rotate server credentials.
`scripts/verify-driver-code-login.ts` tests deployed login, restoration and logout
without printing credentials or uploading locations. To rotate a code, a trusted
administrator must update its bcrypt hash and increment `version` atomically.

On the driver's phone: select the matching roster profile, enter its private
code, then tap **Share my location now** on the dashboard and allow location
access when the phone asks. Subsequent launches
restore the remembered session. GPS sharing still requires an explicit start;
restoring a login never silently starts location publication. Check an independent
viewer phone before expanding the trial.

Current database regression SQL is `supabase/tests/driver_access_codes.sql` and
must run on a clean test database before provisioning real codes. It verifies
browser isolation, hashed secrets, lockouts, expiry, revocation, ownership,
revision conflicts and off-duty location redaction; all fixtures roll back.
The private tables intentionally have RLS enabled with no browser policies: the
advisor's informational "RLS Enabled No Policy" finding reflects deny-by-default
access. They are accessible only through the service-role gateway.
All eight real codes passed deployed HTTP login/restore/revocation checks. Arabic
mobile sign-in, remembered restoration after reload and Switch Driver were checked
in the browser. Actual two-phone GPS behavior still needs a real driver trial.

Keep local demo data, identities and archives on-device during the first stage.
Do not automatically upload stored collections. Private shared bookings require
a separate migration and server transaction for acceptance/capacity changes.
