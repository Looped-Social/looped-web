Looped Web
==========

Marketing/landing experience for Looped, built with React Router v7, Vite, TypeScript, and Tailwind CSS v4. The brand primary color is `#ea404a` and typography uses Google Poppins.

Getting Started
---------------
1) Install deps: `npm install`
2) Start dev server: `npm run dev` (opens on http://localhost:5173)

Scripts
-------
- `npm run dev` – start the Vite dev server via React Router
- `npm run build` – production build
- `npm run start` – serve the built app
- `npm run typecheck` – generate router types and run TypeScript
- `npm run lint` – ESLint for app/src
- `npm run format` / `npm run format:check` – Prettier write/check for app/src/public

Notes
-----
- Styling is Tailwind CSS v4; no Tailwind 3-era config or CSS-in-JS.
- Dark mode toggles via `data-theme="dark"` on the `html` element; theme preference is stored in `localStorage` under `looped-theme`.
