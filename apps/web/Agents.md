# Looped Web Frontend

## Project Overview
**Looped** is a workplace-verified social iOS app built with SwiftUI. It's a pseudonymous social platform where employees verify their employment and then post/message within their company's channels. Think "YikYak for any employer."

This repository currently contains the marketing/landing experience for Looped and the authenticated web client for the Looped social platform. Both live in `apps/web` and are served from the same domain (`mylooped.app`).

All backend business logic and data persistence live in a separately deployed Spring Boot application. This frontend never owns backend business rules or server-side rendering logic; it should only consume APIs exposed by the Spring Boot service.

## Monorepo Context
- This app lives in `apps/web` within the Looped web monorepo.
- Shared UI should go in `packages/ui` (Tailwind-only React components like Button, Input, Card); shared theme tokens live in `packages/config/src/theme.css`.
- Before duplicating UI or hooks, look up one level (`../..`) to check `packages/ui` and `packages/config` for shared components and theme utilities.
- Install dependencies from the repo root using npm workspaces; run dev from the root or with `npm run -w apps/web dev`.
- **App vs Marketing Split**: marketing UI lives in `apps/web/src/marketing`, app UI lives in `apps/web/src/app`. Route modules are split under `apps/web/app/routes/marketing` and `apps/web/app/routes/app`.

## Brand & Design
- **Primary Color**: #ea404a 
- **App Platform**: iOS only
- **Target Audience**: Working professionals looking for workplace social interaction

## Public Marketing Requirements

### Core Functionality
- Single page MVP with minimal complexity
- Hero section with app download link
- Focus on conversion optimization and user retention

## Routing & Auth Model
- **Public routes**: `/`, `/privacy`, `/terms`, `/about`, `/download`, etc. stay accessible without auth.
- **App routes**: everything under `/app/*` is gated and requires auth.
- **Root behavior**: signed-in users visiting `/` should be redirected to `/app`; unauthenticated users visiting `/app/*` should be redirected to `/` (or `/signin` if added later).



## Development Best Practices

### Code Quality
- ESLint configuration for consistent code style
- Component-based architecture
- Modern React patterns (hooks, functional components)

### Styling & Architecture
- **Styling Framework**: Tailwind CSS v4+ (no CSS-in-JS or other CSS frameworks)
- **Tailwind Versioning**: Use Tailwind 4 and beyond only; avoid patterns that rely on Tailwind 3-specific tooling.
- **Component Organization**: Prefer a folder-per-component structure (e.g., `ComponentName/ComponentName.tsx`) and keep styling primarily in Tailwind utility classes within the JSX/TSX. Promote reusable UI (post cards, buttons, headers, profile screens, tab bars) into shared components to keep continuity across routes and speed up iteration.
- **Global Styles & Theme**:
  - Define design tokens (colors, typography, spacing) primarily via the Tailwind theme configuration in `packages/config/src/theme.css`.
  - Keep the primary brand color as `#ea404a`.
  - Use CSS variables at the `:root` level only when necessary, and integrate them with Tailwind (e.g., via theme extensions).
- **Typography**: Use Google Fonts Poppins as the primary font family, wired through Tailwind's font family utilities in the shared theme so changes are centralized and reusable. Avoid hard-coded font families and colors inside components.
- **Responsive Design** (mobile-first):
  - Follow Tailwind's mobile-first responsive design: base/unprefixed classes target mobile, with `sm:`, `md:`, `lg:`, `xl:` prefixes for larger breakpoints.
  - Support all device sizes (mobile, tablet, desktop) using Tailwind's responsive utilities instead of hand-written media queries where possible.
  - Ensure touch-friendly interactions on mobile devices (tap targets, spacing, etc.).
  - Optimize images and assets for different screen sizes and densities.

### Routing
- **React Router**: Version 7 (NOT version 6)
- Follow React Router v7 patterns and conventions
