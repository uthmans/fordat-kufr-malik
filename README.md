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

## Local driver PINs

Driver login requires the selected profile's exact assigned PIN (4–6 digits,
including leading zeroes). There is no default or master-PIN override and no
PIN-free Quick Access button. Existing remembered sessions and Switch Driver
continue to work. Profile and admin edits reject empty or malformed PINs instead
of silently resetting them to a default.

This is a browser-only prototype: PINs and remembered IDs remain in client-side
data, and the admin portal uses a public demo PIN. These controls are a local
profile gate, not secure authentication or authorization. Shared production
accounts need server-side identity, permission checks, and session management.

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
