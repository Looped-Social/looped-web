# API Contract (client-facing)

This document is a consolidated, client-facing API contract for Looped. It’s written for `looped-web` implementers, but it mirrors how iOS works today.

Authoritative backend references:
- Security / auth gates: `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`
- Controllers (routes): `looped-services/apps/api/src/main/java/com/looped/**/**/*Controller.java`

Authoritative iOS references:
- iOS API doc: `looped-iOS/looped-iOS/Docs/API_REFERENCE.md`
- iOS service usage: `looped-iOS/looped-iOS/Services/*.swift`

## Global conventions

### Base URL
- Prod/stage (iOS default): `https://api.mylooped.app`
- Local dev: `http://localhost:8080`

### Auth
- Firebase ID token:
  - `Authorization: Bearer <Firebase ID token>`
- Most `/v1/**` and `/anon/**` routes require auth, except a small allow-list (media presign/callback/resolve, feedback, and anon-capable actions). See `SecurityConfig.java`.

### Anonymous actor (no JWT)
For anon-capable endpoints, there are two mutually exclusive modes:

1) **User actor**
   - Send `Authorization`
   - Do **not** send anon proof fields

2) **Anon actor**
   - Do **not** send `Authorization` (backend returns `400 anon_jwt_not_allowed`)
   - Provide anon proof fields (`asAnon=true` + `anonProfileId/anonCert/anonCertKid/anonSig`, and sometimes `anonTimestamp`)
   - Some endpoints also require `X-Actor: anon`

Deep details are in `ANON_PROTOCOL.md`.

### JSON casing
- Responses are primarily `snake_case`.
- Some responses include camelCase aliases for backward compatibility (examples: `nextCursor`, `viewerHasReposted`).
- Request bodies often accept either casing via `@JsonAlias` on the backend.

### Pagination
- Cursor-based pagination.
- Common envelope:
  - `{ items: [...], next_cursor: "opaque" }`
- Treat `next_cursor` as opaque; only pass it back as `cursor`.

### Errors
- Typical non-2xx body:
  - `{ "error": "string", "message": "optional detail" }`
- Common auth errors:
  - `401 { error: "unauthorized" }`
  - `409 { error: "user_not_provisioned" }` (onboarding incomplete)

### Idempotency
- `POST /v1/posts` (user actor) requires `Idempotency-Key: <uuid>`.
- Some endpoints reserve idempotency headers but are already effectively idempotent server-side (e.g., devices are unique by token).

## Health

- `GET /health` → `ok` (no auth)
- `GET /actuator/health` → `{ status: "UP" }` (no auth)

Backend: `looped-services/apps/api/src/main/java/com/looped/web/HealthController.java`

## App config

- `GET /v1/app-config` (no auth)
  - Used for client placeholders like a default profile image URL.
  - Response example:
    - `{ "default_profile_image_url": "https://..." }`

Backend: `looped-services/apps/api/src/main/java/com/looped/settings/AppConfigController.java`

## Identity / Me

- `GET /v1/me` (auth required)
  - Includes:
    - Firebase token identity (`sub`, `iss`, `aud`, `email?`)
    - Onboarding state (`onboarding_complete`, `onboarding_step`)
    - Provisioning state (`provisioned`)
    - `user` payload when provisioned
  - Special cases:
    - `account_deleted: true` can be returned after retention purge logic.

Backend: `looped-services/apps/api/src/main/java/com/looped/auth/MeController.java`
Used by iOS: `looped-iOS/looped-iOS/Services/UserService.swift`

## Users (onboarding, profile, content)

### Onboarding
- `POST /v1/users/onboard` (auth required)
  - Body: `{ username, firstName, lastName, dateOfBirth: "YYYY-MM-DD" }`
  - Responses:
    - `201` on success
    - `409` for conflicts (e.g., username taken)
    - `422` for invalid inputs
- `PUT /v1/users/me/onboarding` (auth required)
  - Body: `{ step: "profile_setup|select_company|verification|verification_notifications" }`
  - Response: `{ onboarding_complete, onboarding_step }`
- `GET /v1/users/username/availability?username=...` (auth required)
  - Response: `{ username, available, owned_by_me? }`

Backend: `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`

### Profile read
- `GET /v1/users/{id}` (auth required)
  - Same-company scoped.
- `GET /v1/users/{id}/posts?limit&cursor` (auth required)
- `GET /v1/users/{id}/content?limit&cursor&include_post_preview=false|true` (auth required)
- `GET /v1/users/{id}/comments?limit&cursor` (auth required)
- `GET /v1/users/{id}/replies?limit&cursor`
  - Supports anon-proof query params when acting as anon (see `ANON_PROTOCOL.md`).

Backend: `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`

### Follows

- Follow/unfollow a user
  - User actor:
    - `POST /v1/users/{id}/follow` (auth required)
    - `DELETE /v1/users/{id}/follow` (auth required)
  - Anon actor:
    - Same routes, but require anon proofs and must omit `Authorization`.
- Followers/following lists (auth required):
  - `GET /v1/users/{id}/followers?query&limit&cursor`
  - `GET /v1/users/{id}/following?query&limit&cursor`

Backend: `looped-services/apps/api/src/main/java/com/looped/users/FollowsController.java`

### Blocks

- List blocked users (auth required):
  - `GET /v1/users/blocked?limit&cursor`
- Block/unblock a user (supports anon proofs; anon must omit JWT):
  - `POST /v1/users/{id}/block`
  - `DELETE /v1/users/{id}/block`
- Block/unblock a principal (supports anon proofs; anon must omit JWT):
  - `POST /v1/principals/{id}/block`
  - `DELETE /v1/principals/{id}/block`

Backend:
- User blocks: `looped-services/apps/api/src/main/java/com/looped/users/BlocksController.java`
- Principal blocks: `looped-services/apps/api/src/main/java/com/looped/users/PrincipalBlocksController.java`

### Profile update
- `PUT /v1/users/me` (auth required)
  - Body supports:
    - `displayName?: string|null`
    - `bio?: string|null`
    - `isAnonymous?: boolean`
    - `showFollowerCount?: boolean|null`
    - `messagePermission?: string|null`
    - `profileMediaAssetId?: number|null`
- Legacy alias:
  - `PUT /users/me` (auth required)

Backend:
- `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`
- `looped-services/apps/api/src/main/java/com/looped/users/UserAliasController.java`

### Profile display community/specialization
- `PUT /v1/users/me/display-community` (auth required)
  - Body: `{ communityId: number|null }`
- `PUT /v1/users/me/display-specialization` (auth required)
  - Body: `{ specializationId: number|null }`

Backend: `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`

### Account deletion/deactivation
- Soft delete (hide profile):
  - `POST /v1/users/me/deactivate` → `204`
- Hard delete:
  - `POST /v1/users/me/delete` → `{ status:"deleted", firebase_status, firebase_deleted }`
- Alternate (HTTP DELETE):
  - `DELETE /v1/users/me?mode=soft|hard`

Backend: `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`
Used by web today: `looped-web/apps/web/src/lib/userApi.ts`

## Directory / People search

- `GET /v1/users/search?query=...&limit=...&cursor=...` (auth required)
  - `query` is required.
  - Response envelope: `{ items: [...], next_cursor }`

Backend: `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`

## Content preferences

- `GET /v1/content/preferences` (auth required)
  - Response: `{ content: { hide_anonymous_posts: boolean } }`
- `PUT /v1/content/preferences` (auth required)
  - Body: `{ hideAnonymousPosts: boolean }`
  - Response: `{ content: { hide_anonymous_posts: boolean } }`

Backend: `looped-services/apps/api/src/main/java/com/looped/content/ContentPreferencesController.java`

## Feed + posts

### Feed
- `GET /v1/feed?limit&cursor&mode=for_you|new&communityId=...`
  - Response: `{ items: [post...], next_cursor? }`
- `GET /v1/feed/trending?limit&communityId?`
  - Response: `{ items: [trending_post...] }`
- `GET /v1/feed/hashtags?communityId&limit&cursor`

Backend: `looped-services/apps/api/src/main/java/com/looped/posts/FeedController.java`

### Post search
- `GET /v1/posts/search?query&limit&cursor` (auth required)
  - Returns `{ items, next_cursor }` and may also include `nextCursor` as an alias.

Backend: `looped-services/apps/api/src/main/java/com/looped/posts/PostsController.java`

### Post CRUD
- `POST /v1/posts`
  - User actor:
    - Requires `Authorization`
    - Requires `Idempotency-Key`
  - Anon actor:
    - Requires anon proof fields in body + `isAnon: true`
    - Must NOT send `Authorization`
  - Body (high-level; details vary by feature):
    - `{ content, communityId, mediaAssetId?, mediaAssetIds?, poll?, isAnon?, anonProfileId?, anonCert?, anonCertKid?, anonSig?, anonTimestamp? }`
- `GET /v1/posts/{id}` (auth required)
- `PUT /v1/posts/{id}`
  - User actor: auth required
  - Anon actor: anon proof required; no JWT
- `DELETE /v1/posts/{id}`
  - User actor: auth required
  - Anon actor: anon proof required; no JWT (anon delete uses body)

Backend: `looped-services/apps/api/src/main/java/com/looped/posts/PostsController.java`

### Post interactions
- Likes (supports anon):
  - `POST /v1/posts/{id}/like`
  - `DELETE /v1/posts/{id}/like` (anon uses delete-with-body)
- Saves (supports anon):
  - `POST /v1/posts/{id}/save`
  - `DELETE /v1/posts/{id}/save`
- Reposts (supports anon; anon requires `X-Actor: anon`):
  - `PUT /v1/posts/{id}/repost`
  - `DELETE /v1/posts/{id}/repost`
- Shares (JWT only):
  - `POST /v1/posts/{id}/share`

Backend:
- Likes: `looped-services/apps/api/src/main/java/com/looped/posts/LikesController.java`
- Saves + collections: `looped-services/apps/api/src/main/java/com/looped/posts/PostCollectionsController.java`
- Reposts: `looped-services/apps/api/src/main/java/com/looped/posts/RepostsController.java`
- Shares: `looped-services/apps/api/src/main/java/com/looped/posts/PostSharesController.java`

### Collections
- `GET /v1/posts/liked?limit&cursor` (auth required)
- `GET /v1/posts/saved?limit&cursor` (auth required)
- `GET /v1/posts/reposted?limit&cursor` (auth required)

Backend: `looped-services/apps/api/src/main/java/com/looped/posts/PostCollectionsController.java`

## Comments

Comments support both user actor and anon actor.

- List:
  - `GET /v1/posts/{postId}/comments?limit&cursor`
  - `GET /v1/comments/{commentId}/replies?limit&cursor`
  - In anon actor mode, anon proof is provided as query params:
    - `asAnon=true&anonProfileId=...&anonCert=...&anonCertKid=...&anonSig=...`
- Create/edit/delete:
  - `POST /v1/posts/{postId}/comments` (supports anon proof body)
  - `PUT /v1/comments/{id}` (supports anon proof body)
  - `DELETE /v1/comments/{id}` (supports anon proof body)
- Like/unlike:
  - `POST /v1/comments/{id}/like` (supports anon proof body)
  - `DELETE /v1/comments/{id}/like` (supports anon proof body)

Backend: `looped-services/apps/api/src/main/java/com/looped/comments/CommentsController.java`

## Communities + verification

### Discovery
- `GET /v1/communities/search?query&kind&limit&cursor`
- `GET /v1/communities/recommended?kind&limit&cursor`
- `GET /v1/communities/{id}`
- `GET /v1/communities/{id}/domains`
- Followed communities (feed filter chips):
  - `GET /v1/me/followed/communities?limit&cursor&order=relevant|...`
  - Backward-compatible alias: `GET /v1/me/followed/loops`
- Follow/unfollow:
  - `POST /v1/communities/{id}/follow`
  - `DELETE /v1/communities/{id}/follow`
- Join/unjoin:
  - `POST /v1/communities/{id}/join`
  - `DELETE /v1/communities/{id}/join`
  - For non-specialization communities, join delegates to follow/unfollow.

Backend:
- Search/recommended/loops/hashtags: `looped-services/apps/api/src/main/java/com/looped/discovery/DiscoveryController.java`
- Details: `looped-services/apps/api/src/main/java/com/looped/communities/CommunitiesController.java`
- Domains: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityDomainsController.java`
- Followed/follow: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityFollowsController.java`
- Join/unjoin: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityJoinsController.java`

### Community permissions + verification
- Permissions:
  - `GET /v1/communities/{id}/permissions` → `{ can_post, requires_verification, requires_join }`
- Verification:
  - `POST /v1/communities/{id}/verification/start`
  - `POST /v1/communities/{id}/verification/finish`
  - `DELETE /v1/communities/{id}/verification` (unverify)
  - `GET /v1/communities/verifications` (list)

Backend: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityVerificationController.java`

### Community requests (request a new company/school/etc)
- `POST /v1/community-requests` (auth required)
- `GET /v1/community-requests?status=...` (auth required)

Backend: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityRequestsController.java`
Used by web today: `looped-web/apps/web/src/lib/communityApi.ts`

## Specializations (majors/fields)

- Recommended:
  - `GET /v1/specializations/recommended?type=major|field|all&limit=...`
- Browse:
  - `GET /v1/specializations/browse?type=major|field&limit&cursor`
- Follow/unfollow (majors/fields only):
  - `POST /v1/specializations/{id}/follow`
  - `DELETE /v1/specializations/{id}/follow`
- Join/unjoin (majors/fields only):
  - `POST /v1/specializations/{id}/join`
  - `DELETE /v1/specializations/{id}/join`
- Join limits:
  - `GET /v1/me/specializations/join-limits?type=major|field|all`
- Joined list:
  - `GET /v1/me/joined/specializations?type=major|field|all&limit&cursor`

Backend:
- Recommended/browse: `looped-services/apps/api/src/main/java/com/looped/discovery/DiscoveryController.java`
- Follow/join/joined/limits: `looped-services/apps/api/src/main/java/com/looped/communities/SpecializationsController.java`

## Photo ID verification

Global photo ID verification:
- `POST /v1/verification/photo-id/start`
- `POST /v1/verification/photo-id/presign`
- `POST /v1/verification/photo-id/submit`
- `GET /v1/verification/photo-id/status`

Community-scoped photo ID verification:
- `POST /v1/communities/{communityId}/verification/photo-id/start`
- `POST /v1/communities/{communityId}/verification/photo-id/presign`
- `POST /v1/communities/{communityId}/verification/photo-id/submit`
- `GET /v1/communities/{communityId}/verification/photo-id/status`

Backend:
- Global: `looped-services/apps/api/src/main/java/com/looped/verification/PhotoIdVerificationController.java`
- Community: `looped-services/apps/api/src/main/java/com/looped/communities/CommunityPhotoIdVerificationController.java`

## Media

Public media (posts/profile/channel photos):
- `POST /v1/media/presign` (no auth required)
- Upload (usually PUT) to the returned `uploadUrl`
- `POST /v1/media/callback` (no auth *route*, but request rules differ by actor)
  - User upload: requires `Authorization`
  - Anon upload: requires `X-Actor: anon` and no JWT
  - Optional header: `X-Media-Signature` if `callbackSignature` was returned from presign and backend has `MEDIA_CALLBACK_SECRET` set.
- `POST /v1/media/resolve` (no auth required)

Backend: `looped-services/apps/api/src/main/java/com/looped/media/MediaController.java`
Details: `MEDIA_AND_UPLOADS.md`

Message media (DM/channel attachments):
- `POST /v1/message-media/presign` (auth required; anonymous profiles blocked)
- `POST /v1/message-media/resolve` (auth required; keys must be accessible and typically start with `dm/`)

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/MessageMediaController.java`

## Messaging

Anonymous profiles are blocked from messaging endpoints with:
- `403 { error: "anonymous_not_allowed" }`

Conversations:
- `GET /v1/conversations?limit&cursor`
- `POST /v1/conversations` (start DM)
- `GET /v1/conversations/{id}/messages?limit&cursor`
- `POST /v1/conversations/{id}/messages`
- `PUT /v1/conversations/{id}/preferences` (muted)

Channels:
- `GET /v1/channels?limit&cursor`
- `POST /v1/channels`
- `PATCH /v1/channels/{id}`
- `DELETE /v1/channels/{id}`
- `GET /v1/channels/{id}/members?limit&cursor`
- `POST /v1/channels/{id}/members`
- `PUT /v1/channels/{id}/members/{userId}`
- `DELETE /v1/channels/{id}/members/{userId}`
- `GET /v1/channels/{id}/messages?limit&cursor`
- `POST /v1/channels/{id}/messages`
- `PUT /v1/channels/{id}/preferences` (muted)

Message requests:
- `GET /v1/message-requests?limit&cursor`
- `POST /v1/message-requests/{id}/approve`
- `POST /v1/message-requests/{id}/reject`

Search:
- `GET /v1/messages/search?query&limit&cursor`

Backend:
- Conversations: `looped-services/apps/api/src/main/java/com/looped/messaging/ConversationsController.java`
- Channels: `looped-services/apps/api/src/main/java/com/looped/messaging/ChannelsController.java`
- Message requests: `looped-services/apps/api/src/main/java/com/looped/messaging/MessageRequestsController.java`
- Search: `looped-services/apps/api/src/main/java/com/looped/messaging/MessagingSearchController.java`

Details: `MESSAGING_AND_NOTIFICATIONS.md`

## Notifications

- `GET /v1/notifications?limit&cursor`
- `POST /v1/notifications/{id}/read`
- Preferences:
  - `GET /v1/notifications/preferences`
  - `PUT /v1/notifications/preferences`

Backend:
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationsController.java`
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationPreferencesController.java`

Details: `MESSAGING_AND_NOTIFICATIONS.md`

## Moderation

- Reports:
  - `POST /v1/reports`
  - `GET /v1/reports?status=...`
  - `PUT /v1/reports/{id}/resolve`
- Appeals:
  - `POST /v1/appeals`
  - `GET /v1/appeals?status=...`
- Violations:
  - `GET /v1/violations?limit&cursor`

Backend:
- Reports: `looped-services/apps/api/src/main/java/com/looped/moderation/ModerationController.java`
- Appeals: `looped-services/apps/api/src/main/java/com/looped/moderation/AppealsController.java`
- Violations: `looped-services/apps/api/src/main/java/com/looped/moderation/ViolationsController.java`

## Feedback

- `POST /v1/feedback`
  - Auth optional; backend will attach subject/email if present.

Backend: `looped-services/apps/api/src/main/java/com/looped/feedback/FeedbackController.java`

## Devices (push registration)

- `POST /v1/devices`
  - Body: `{ apnsToken, platform: "ios" }`
  - `Idempotency-Key` header is accepted but currently not required; functional idempotency is enforced by unique APNs token.

Backend: `looped-services/apps/api/src/main/java/com/looped/devices/DevicesController.java`

## Polls

- `PUT /v1/polls/{pollId}/vote`
  - Body: `{ selectedOptionIds: number[] }`

Backend: `looped-services/apps/api/src/main/java/com/looped/polls/PollsController.java`

## Anonymous protocol (enrollment + profiles)

This is large enough to deserve its own doc:
- `ANON_PROTOCOL.md`

Entry points (selected):
- Enrollment:
  - `GET /anon/issuer?communityId=...` (JWT required)
  - `POST /anon/issue` (JWT required)
  - `POST /anon/register` (NO JWT)
  - `POST /anon/revoke` (NO JWT)
- Anon profiles:
  - `GET /v1/anon/{id}` (JWT required)
  - `PUT /v1/anon/{id}/display-community` (NO JWT + proof)
  - `PUT /v1/anon/{id}/display-specialization` (NO JWT + proof + `X-Actor: anon`)
  - Follow/unfollow anon profiles:
    - `POST /v1/anon/{id}/follow` / `DELETE /v1/anon/{id}/follow`
    - Supports user-actor follows (JWT) and anon-actor follows (proof + `X-Actor: anon`, no JWT).
  - Followers/following (JWT required):
    - `GET /v1/anon/{id}/followers?query&limit&cursor`
    - `GET /v1/anon/{id}/following?query&limit&cursor`
  - `GET /v1/anon/{id}/posts/liked` (NO JWT + proof query)
  - `GET /v1/anon/{id}/posts/saved` (NO JWT + proof query)
  - `GET /v1/anon/{id}/replies` (NO JWT + proof query)

Backend:
- Enrollment: `looped-services/apps/api/src/main/java/com/looped/anon/AnonController.java`
- Profiles: `looped-services/apps/api/src/main/java/com/looped/anon/AnonProfilesController.java`
