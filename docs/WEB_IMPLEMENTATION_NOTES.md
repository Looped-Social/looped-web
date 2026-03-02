# Web implementation notes (what already exists in `looped-web`)

This doc is a pragmatic guide for implementing the authenticated web client in this repo with consistent patterns.

Primary repo instructions:
- `looped-web/AGENTS.md`
- `looped-web/apps/web/Agents.md`

## Routing model

- Public marketing routes live at `/` (and `/privacy`, `/terms`, etc).
- Authenticated app routes live under `/app/*` and should be auth-gated.
- Tech: React Router v7 + Vite + Tailwind v4.
- Signed-in users who hit `/` should be redirected into `/app`.

## Current auth + onboarding model (web)

- Auth is Firebase in-browser (Google/Apple/email-password); backend does not expose a separate web login endpoint.
- Always bootstrap session with `GET /v1/me` after auth token acquisition.
- Treat onboarding as server-driven FSM, not as local page index.
- Primary server fields:
  - `onboarding_complete`
  - `onboarding_stage_v2`
  - `onboarding_context`
  - `allowed_next_stages_v2` (when returned on conflict/error)
  - `profile_completion.should_prompt`
- Resume priority:
  - server stage/context
  - `allowed_next_stages_v2`
  - legacy `onboarding_step`
  - sanitized local persisted step
- Web onboarding verification policy:
  - email verification only
  - no photo ID onboarding flow on web
  - onboarding path must still set `verification_path=email` via onboarding-v2 endpoint

## Environment variables

See:
- `looped-web/apps/web/.env.example`

The web app expects:
- `VITE_API_BASE_URL`
- Firebase web config `VITE_FIREBASE_*`

## Auth + API helpers

### Base URL and error type
- `looped-web/apps/web/src/lib/apiBase.ts`
  - `getApiBase()` strips trailing slash.
  - `ApiError` carries `status` and optional `details`.

### Firebase token
- `looped-web/apps/web/src/lib/firebaseClient.ts`
  - `getFirebaseIdToken()` returns the current user’s Firebase ID token.

### Existing typed API wrappers

- Account/identity:
  - `looped-web/apps/web/src/lib/userApi.ts`
    - `GET /v1/me`
    - `POST /v1/users/me/deactivate`
    - `POST /v1/users/me/delete`
- Community requests + image upload:
  - `looped-web/apps/web/src/lib/communityApi.ts`
    - Uses `/v1/media/presign` + S3 upload + `/v1/media/callback`
    - `POST /v1/community-requests`
- Feedback:
  - `looped-web/apps/web/src/lib/feedbackApi.ts`
    - Calls `POST /v1/feedback` with optional auth

## Onboarding-v2 endpoint usage (web)

- Profile bootstrap:
  - `POST /v1/users/onboard`
  - `GET /v1/users/username/availability?username=...`
- Onboarding-v2 progression:
  - `POST /v1/users/me/onboarding-v2/info-screen/viewed`
  - `PUT /v1/users/me/onboarding-v2/org`
  - `PUT /v1/users/me/onboarding-v2/verification-choice`
  - `POST /v1/users/me/onboarding-v2/email-verification/success`
  - `POST /v1/users/me/onboarding-v2/specialization`
  - `POST /v1/users/me/onboarding-v2/skip-explainer/ack`
  - `POST /v1/users/me/onboarding-v2/finalize`
  - `POST /v1/users/me/onboarding-v2/complete-after-community-request`

## Email verification reuse rules

- Reuse one email verification engine for both onboarding and community/profile verification.
- Shared endpoints in both modes:
  - `GET /v1/communities/{id}/domains`
  - `POST /v1/communities/{id}/verification/start`
  - `POST /v1/communities/{id}/verification/finish`
- Onboarding mode only:
  - ensure `verification-choice=email`
  - call `email-verification/success` after verify success
- Profile/settings mode:
  - never call onboarding-v2 progression endpoints
  - refresh community/user state after finish success

## Community request flow modes

- Onboarding org-selection side flow:
  - `POST /v1/community-requests`
  - then `POST /v1/users/me/onboarding-v2/complete-after-community-request`
- Regular app/settings flow:
  - `POST /v1/community-requests` only (no onboarding completion endpoint)
- For request payloads:
  - if `notifyWhenAvailable=true`, `contactEmail` must be provided
  - onboarding mode request type options are restricted to `company|school`

### Session hook
- `looped-web/apps/web/src/hooks/useUserSession.ts`
  - Centralizes “who is logged in” state for the web UI.

## API conventions to keep consistent on web

- Handle `204 No Content` gracefully.
  - Some endpoints respond with empty bodies (preference updates in particular).
- Expect server responses to be `snake_case`.
  - Decide once whether you convert to camelCase or keep snake_case throughout.
  - iOS converts from snake_case at decode time; web can do the equivalent or keep as-is.
- Cursor pagination:
  - Use `next_cursor` and pass it back as `cursor` without parsing.

## Anonymous mode on web (future)

If/when the web app supports anon mode:
- You must support a JWT-free request path for anon actions (no `Authorization` header).
- Centralize this logic in your API layer so callers can’t accidentally send JWT + anon proofs together.

See `ANON_PROTOCOL.md`.

## Product constraint: no posting on web (for now)

The current requirement is:
- Do not implement:
  - `POST /v1/posts`
  - `PUT /v1/posts/{id}`
  - `DELETE /v1/posts/{id}`
  - (and any “composer/draft” UI)

Reading + interactions (like/save/comment/follow/messaging/notifications) can be implemented as needed.
