# Looped Admin Dashboard

## Project Overview
The Looped admin dashboard is a separate web app for internal/admin workflows. It is deployed independently from the main `mylooped.app` web experience (landing + app routes) and runs on a dedicated subdomain (e.g., `admin.mylooped.app`).

## Monorepo Context
- This app lives in `apps/admin` within the Looped web monorepo.
- Shared UI should go in `packages/ui` (Tailwind-only React components like Button, Input, Card).
- Shared theme tokens live in `packages/config/src/theme.css` and should be imported in `app/app.css`.
- Before duplicating UI or hooks, look up one level (`../..`) to check `packages/ui` and `packages/config` for shared components and theme utilities.
- Install dependencies from the repo root using npm workspaces; run dev with `npm run -w apps/admin dev`.

## Brand & Design
- **Primary Color**: #ea404a
- **Typography**: Poppins (via Tailwind v4 `@theme` in `packages/config/src/theme.css`)
- **App Platform**: iOS only (admin is web for internal use)
- **Target Audience**: Looped internal/admin users

## Development Best Practices
- **Styling**: Tailwind CSS v4+ only; no CSS-in-JS.
- **Component Organization**: Prefer folder-per-component (`ComponentName/ComponentName.tsx`).
- **Routing**: React Router v7 only.
- **Shared Code**: App-specific components stay in `app/components`; reusable UI goes in `packages/ui`.

## Notes
- This frontend never owns backend business rules or server-side rendering logic; it only consumes APIs from the Spring Boot service.
