# Kufr Malik Transit

React and Vite app for Kufr Malik–Ramallah transit.

## Local development

Use Node.js 24 and Bun. Install dependencies with `bun install --frozen-lockfile`,
then run `bun run dev`. Open the URL printed by Vite with `/fordat-kufr-malik/`.

## GitHub Pages

In this repository's **Settings → Pages → Build and deployment**, set **Source**
to **GitHub Actions**. The workflow builds the app and deploys only `dist/` when
changes reach `main`. Pull requests run the build without publishing.

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
