# Looped Web

## Repo Overview
This repository contains the Looped web experience served from `mylooped.app` (marketing/landing + authenticated web app). Shared UI and design tokens live in `packages/` and are consumed by the app.

## Structure
- `apps/web` – marketing/landing + authenticated web app (React Router v7 + Vite + Tailwind v4)
- `packages/ui` – shared UI components (Tailwind-only React components like Button, Input, Card)
- `packages/config` – shared theme tokens (Tailwind v4 `@theme` CSS, brand colors, typography)

## Brand & Design
- **Primary Color**: #ea404a
- **Typography**: Poppins (via Tailwind v4 `@theme` in `packages/config/src/theme.css`)
- **App Platform**: iOS only
- **Target Audience**: Working professionals looking for workplace social interaction

## Development Conventions
- **Workspaces**: Use npm workspaces at repo root. Install deps from the root.
- **Shared Code**: Put cross-app UI in `packages/ui`; keep app-specific UI in each app’s `app/components`. Prefer reusable components for post cards, buttons, headers, profile screens, and tab bars to keep UI consistent and easy to extend.
- **Styling**: Tailwind CSS v4+ only; no CSS-in-JS. Use `@import "@looped/config/theme.css"` in each app’s `app.css`. Typography and color tokens live in `packages/config/src/theme.css` and are the single source of truth so visual changes are centralized and reusable. Avoid hard-coded hex values or font names in components.
- **Routing**: React Router v7 only.
- **Public vs App Routes**: keep public routes like `/`, `/privacy`, `/terms`, etc. accessible without auth; the app lives under `/app/*` and is auth-gated. Signed-in users hitting `/` should be routed to `/app`.
- **Web App Split**: marketing UI lives in `apps/web/src/marketing`, app UI lives in `apps/web/src/app`. Route modules are split under `apps/web/app/routes/marketing` and `apps/web/app/routes/app`.

## Deployment Model
- `apps/web` serves both marketing + app routes on `mylooped.app` (public routes at `/`, `/privacy`, `/terms`, etc., app routes under `/app/*`).

## Notes
- This frontend never owns backend business rules or server-side rendering logic; it only consumes APIs from the Spring Boot service.
