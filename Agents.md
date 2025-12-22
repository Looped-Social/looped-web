# Looped Web Monorepo

## Repo Overview
This repository is a monorepo for Looped web properties. It currently contains the marketing/landing site and is set up to add a separate admin dashboard. Shared UI and design tokens live in `packages/` and are consumed by each app.

## Structure
- `apps/web` – marketing/landing experience (React Router v7 + Vite + Tailwind v4)
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

## Deployment Model
- Separate deploys per app.
- Example: marketing on `mylooped.app`, admin on `admin.mylooped.app`.

## Notes
- This frontend never owns backend business rules or server-side rendering logic; it only consumes APIs from the Spring Boot service.
