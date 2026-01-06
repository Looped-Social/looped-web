# Looped Web Monorepo

## Repo Overview
This repository is a monorepo for Looped web properties. The marketing/landing experience and the authenticated web app live together in `apps/web` and are served from the same domain (`mylooped.app`). Shared UI and design tokens live in `packages/` and are consumed by each app. The admin dashboard remains a separate app with its own deploy.

## Structure
- `apps/web` – marketing/landing + authenticated web app (React Router v7 + Vite + Tailwind v4)
- `apps/admin` – admin dashboard (separate app and deploy)
- `packages/ui` – shared UI components (Tailwind-only React components like Button, Input, Card)
- `packages/config` – shared theme tokens (Tailwind v4 `@theme` CSS, brand colors, typography)

## Brand & Design
- **Primary Color**: #ea404a
- **Typography**: Poppins (via Tailwind v4 `@theme` in `packages/config/src/theme.css`)
- **App Platform**: iOS only
- **Target Audience**: Working professionals looking for workplace social interaction

## Development Conventions
- **Workspaces**: Use npm workspaces at repo root. Install deps from the root.
- **Shared Code**: Put cross-app UI in `packages/ui`; keep app-specific UI in each app’s `app/components`.
- **Styling**: Tailwind CSS v4+ only; no CSS-in-JS. Use `@import "@looped/config/theme.css"` in each app’s `app.css`.
- **Routing**: React Router v7 only.
- **Public vs App Routes**: keep public routes like `/`, `/privacy`, `/terms`, etc. accessible without auth; the app lives under `/app/*` and is auth-gated. Signed-in users hitting `/` should be routed to `/app`.

## Deployment Model
- Separate deploys per app.
- `apps/web` serves both marketing + app routes on `mylooped.app` (public routes at `/`, `/privacy`, `/terms`, etc., app routes under `/app/*`).
- `apps/admin` deploys separately on `admin.mylooped.app`.

## Notes
- This frontend never owns backend business rules or server-side rendering logic; it only consumes APIs from the Spring Boot service.
