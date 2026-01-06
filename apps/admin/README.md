Looped Admin
===========

Admin dashboard for Looped, built with React Router v7, Vite, TypeScript, and Tailwind CSS v4. This app is deployed separately from the main `mylooped.app` web experience (landing + app routes) and lives inside the Looped web monorepo.

Repo Context
------------
- Monorepo root: `looped-web`
- Marketing app: `apps/web`
- Shared UI: `packages/ui`
- Shared theme tokens: `packages/config/src/theme.css`

Getting Started
---------------
1) Install deps at repo root: `npm install`
2) Start admin dev server: `npm run -w apps/admin dev`

Scripts
-------
- `npm run -w apps/admin dev` – admin dev server
- `npm run -w apps/admin build` – production build
- `npm run -w apps/admin start` – serve the built app

Notes
-----
- Styling is Tailwind CSS v4; no Tailwind 3-era config or CSS-in-JS.
- Import shared tokens in `app/app.css` with `@import "@looped/config/theme.css"`.
- Shared UI components should live in `packages/ui`.

Environment
-----------
Required Firebase client config (set in `apps/admin/.env`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET` (optional)
- `VITE_FIREBASE_MESSAGING_SENDER_ID` (optional)
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

API base (optional; defaults to same origin):
- `VITE_ADMIN_API_BASE_URL`
