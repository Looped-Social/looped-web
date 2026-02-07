# System Overview (repos + runtime)

Looped is an iOS-first, workplace-verified social app. The backend is a Spring Boot modular monolith; the web app is a UI-only client that consumes the same HTTP APIs as iOS.

## Repos in this workspace

- `looped-iOS/`
  - SwiftUI app (MVVM).
  - Pure client: UI + state + API calls.
  - API usage reference lives in `looped-iOS/looped-iOS/Docs/API_REFERENCE.md`.
- `looped-services/`
  - Spring Boot API (`apps/api`) + optional workers.
  - Owns business rules, auth, persistence, and media presign/callback.
  - Route/security source of truth: `looped-services/apps/api/src/main/java/com/looped/**`.
- `looped-web/`
  - Marketing + authenticated web app (React Router v7 + Vite + Tailwind v4).
  - Shared design tokens live in `looped-web/packages/config/src/theme.css`.

## Runtime architecture (prod/stage)

High level:

```
Clients (iOS, Web)
    |
    v
API (Spring Boot, ECS Fargate behind ALB)
    |
    +--> Postgres (Neon)
    +--> Redis (cache/rate limits/idempotency)
    +--> S3 (uploads via presigned URLs)
    +--> CloudFront (media delivery)
    +--> Firebase JWKS (JWT verification)
    +--> (optional) SQS -> notif-worker -> APNs
```

Backend overview docs:
- `looped-services/AGENTS.md`
- `looped-services/docs/ARCHITECTURE.md`

## Client/server responsibility split

Clients (iOS + web):
- Display UI + local UI state.
- Call HTTP APIs.
- Upload media to S3 using server-issued presigned URLs.
- Never own business rules (permissions, verification requirements, community scoping, moderation, etc.).

Backend (Spring Boot API):
- Auth + authorization (Firebase JWT verification).
- Company scoping + onboarding gating.
- Feed ranking, post visibility rules, moderation decisions.
- Anonymous mode enrollment and verification of anon “action proofs”.
- Media presign/callback, and media URL resolution.
- Messaging, message requests, and notifications.

## Naming conventions and JSON

- Most API payloads are `snake_case`.
- Some endpoints also return camelCase aliases for specific fields (`nextCursor`, `viewerHasReposted`) for backward compatibility.
- iOS decodes server JSON with `convertFromSnakeCase` (see `looped-iOS/looped-iOS/Services/APIClient.swift`).

## Key “gotchas” you must know

- Anonymous mode is **JWT-free** for actions:
  - Many endpoints accept either (A) JWT auth, or (B) anon proofs — but not both.
  - If you send `Authorization` with `asAnon=true`, the backend intentionally returns `400 { error: "anon_jwt_not_allowed" }`.
  - See `ANON_PROTOCOL.md`.
- Some endpoints can return `204 No Content` (notably preference updates on some deployments). Your web fetch layer must tolerate empty bodies.
- Pagination is cursor-based (`next_cursor`) and opaque; don’t parse the cursor.

