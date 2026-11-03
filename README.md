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
