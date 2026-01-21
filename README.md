Looped Web
==========

Repo for the Looped web experience served from `mylooped.app` (marketing/landing + authenticated web app). Shared components and design tokens live under `packages/`.

Repo Layout
-----------
- `apps/web` – marketing/landing + authenticated web app (React Router v7 + Vite + Tailwind v4)
- `packages/ui` – shared UI components (Tailwind-only React components like Button, Input, Card)
- `packages/config` – shared theme tokens (Tailwind v4 `@theme` CSS, brand colors, typography)

Getting Started
---------------
1) Install deps: `npm install`
2) Start web dev server (landing + app routes): `npm run dev`

Scripts
-------
- `npm run dev` – web dev server (landing + app routes)
- `npm run build` – web production build
- `npm run start` – serve the web build
- `npm run lint` / `npm run typecheck` – all workspaces (where present)
- `npm run format` / `npm run format:check` – Prettier across apps/packages

Notes
-----
- Styling is Tailwind CSS v4; no Tailwind 3-era config or CSS-in-JS.
- Shared theme tokens live in `packages/config/src/theme.css` and are imported by each app.
- Shared components live in `packages/ui/src` and are exported via `packages/ui/src/index.ts`.
- Dark mode toggles via `data-theme="dark"` on the `html` element; theme preference is stored in `localStorage` under `looped-theme`.
