# Auth + Environment Configuration

This doc covers how clients authenticate to the API and which environment variables matter for local dev and deployments. Do **not** place real secret values in docs or commits.

## Auth model: Firebase ID token

Backend auth:
- The API verifies Firebase ID tokens via JWKS on requests that require auth.
- Header:
  - `Authorization: Bearer <Firebase ID token>`

iOS:
- Obtains the token from Firebase Auth and injects it in `APIClient`:
  - `looped-iOS/looped-iOS/Services/APIClient.swift`

Web:
- Uses Firebase Web SDK.
- Implementation helpers:
  - Token: `looped-web/apps/web/src/lib/firebaseClient.ts` (`getFirebaseIdToken()`)
  - Base URL: `looped-web/apps/web/src/lib/apiBase.ts` (`getApiBase()`)

## Web env vars (Vite)

Source-of-truth examples:
- `looped-web/apps/web/.env.example`
- `looped-web/apps/web/.env.staging.example`

Required:
- Firebase web config:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`
  - (optional depending on features) `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
- API base:
  - `VITE_API_BASE_URL` (example: `http://localhost:8080` in dev)

Optional:
- `VITE_FORCE_NOT_FOUND=true` to force a site-wide 404 (ops toggle).

## Backend env vars (high level)

Canonical list + setup guidance:
- `looped-services/docs/SETUP.md`

Most relevant categories (names only; do not commit values):
- Auth (Firebase):
  - `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URI`
- Database:
  - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- Redis:
  - `REDIS_URL`
- Media:
  - `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DOMAIN`
  - `MEDIA_CALLBACK_SECRET` (HMAC for `/v1/media/callback` signature validation)
- Verification dev toggle:
  - `VERIFICATION_ECHO_CODE`

## CORS notes (web client)

Backend CORS and auth allow-lists live in:
- `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`

Notable defaults:
- Allowed origins default includes `http://localhost:5173` (Vite dev).
- Allowed headers include:
  - `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Actor`, `X-Media-Signature`

If the web app needs to send additional headers, add them there.

## Anonymous actor (no JWT)

Some endpoints are intentionally callable without JWT because they support anonymous proofs.

Rule of thumb:
- If you are sending `asAnon: true` + anon proof fields → **omit** `Authorization` header entirely.
- Some endpoints also require `X-Actor: anon`.

See:
- `ANON_PROTOCOL.md`
- Backend enforcement list: `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`

