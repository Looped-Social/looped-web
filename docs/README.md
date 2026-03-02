# Looped Web — System + API Reference (for agents)

Last updated: 2026-03-02

This `docs/` folder exists so an AI agent (or new engineer) working in `looped-web/` can implement the web UI without re-scanning `looped-iOS/` and `looped-services/` every time.

Scope:
- Web app is UI-only; backend owns all business rules.
- The current requirement is **no posting on web** (creating/editing/deleting posts). Everything else can be built as needed.

Current web auth/onboarding state (keep docs aligned to this):
- Web supports unified auth entry with sign in + sign up (Google/Apple/email-password).
- Web onboarding runs on onboarding-v2 server state (`onboarding_stage_v2` + `onboarding_context`).
- Web onboarding verification is email-only; photo ID onboarding is not supported on web.
- Finish-profile prompt is post-onboarding only, driven by `profile_completion.should_prompt` from `GET /v1/me`.
- Community-request onboarding side flow completes via `POST /v1/users/me/onboarding-v2/complete-after-community-request`.

## Start here
- `SYSTEM_OVERVIEW.md` — architecture + repo map
- `AUTH_AND_ENV.md` — Firebase auth + environment configuration
- `API_CONTRACT.md` — endpoints, payloads, errors, pagination (client-facing contract)
- `ANON_PROTOCOL.md` — anonymous mode: enrollment + action proofs (critical)
- `DESIGN_SYSTEM.md` — fonts, colors, spacing, radii (iOS → web mapping)
- `POST_CARD_SPEC.md` — feed post card + skeleton spec (iOS reference)
- `IOS_CLIENT_PATTERNS.md` — how the iOS app actually calls the API (quirks, polling, pagination)
- `IOS_SCREEN_MAP.md` — what screens exist in iOS + what backs them
- `MEDIA_AND_UPLOADS.md` — presign/upload/callback + message media keys/resolve
- `MESSAGING_AND_NOTIFICATIONS.md` — conversations/channels/message-requests + notification payloads/deeplinks
- `BACKEND_CODEMAP.md` — where endpoints live in `looped-services` (controllers + security rules)
- `WEB_IMPLEMENTATION_NOTES.md` — existing `looped-web` API helpers + routing/auth expectations

## Primary source files (when in doubt)
- Backend security + auth rules: `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`
- Backend controllers (routes): `looped-services/apps/api/src/main/java/com/looped/**/**/*Controller.java`
- iOS API reference: `looped-iOS/looped-iOS/Docs/API_REFERENCE.md`
- iOS wiring status: `looped-iOS/looped-iOS/Docs/CODEX_HANDOFF.md`
- iOS networking + services: `looped-iOS/looped-iOS/Services/*.swift`
