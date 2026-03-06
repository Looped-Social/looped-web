# iOS Client Patterns (MVVM + Service → Endpoint map)

This document summarizes how the iOS app (`looped-iOS/looped-iOS`) is structured and how it calls the backend. It’s intended to prevent the web client from re-discovering conventions (auth headers, anonymous mode, pagination quirks, polling, etc.).

Key folders:
- Views: `looped-iOS/looped-iOS/Views`
- ViewModels: `looped-iOS/looped-iOS/ViewModels`
- Services (API integration): `looped-iOS/looped-iOS/Services`
- DTOs (request/response shapes): `looped-iOS/looped-iOS/Models/API`

## App entry + navigation (high level)

- Root gating: `looped-iOS/looped-iOS/ContentView.swift`
  - If authenticated and identity not loaded → bootstrap splash
  - If authenticated but onboarding incomplete → onboarding/auth flow
  - If authenticated + onboarding complete → `MainTabView`
- Tabs are defined in `looped-iOS/looped-iOS/Views/Shared/Core/CustomTabBar.swift`:
  - Home, Messages, Search, Notifications, Profile
  - Messages tab is hidden when anonymous mode is enabled

## Networking conventions (iOS)

### Base URL
- Default: `https://api.looped-social.com`
- Override via iOS Info.plist key `API_BASE_URL`
- Source: `looped-iOS/looped-iOS/Services/LoopedEnvironment.swift`

### Auth (Firebase ID token)
- iOS uses Firebase Auth; API calls add:
  - `Authorization: Bearer <Firebase ID token>`
- Implementation:
  - `looped-iOS/looped-iOS/Services/APIClient.swift`
  - `looped-iOS/looped-iOS/Services/AuthTokenProvider.swift`

### JSON decoding + dates
- Server uses `snake_case`; iOS decodes via `convertFromSnakeCase`.
- Dates: ISO-8601, with and without fractional seconds.
- Source: `looped-iOS/looped-iOS/Services/APIClient.swift`

### Error shape
- iOS expects non-2xx bodies like:
  - `{ "error": "string", "message": "optional" }`
- 401 is treated specially (`APIError.unauthorized`).
- Source: `looped-iOS/looped-iOS/Services/APIClient.swift`

### 204 No Content
- Some endpoints respond `204` (notably preference updates on some deployments).
- iOS handles this in two ways:
  - `APIClient` returns `EmptyResponse` for empty bodies when the caller expects it.
  - `MessageService.updateConversationPreferences` and `updateChannelPreferences` treat empty as success.

### Pagination
- Cursor-based; responses typically:
  - `{ items: [...], next_cursor: "opaque" }`
- iOS stores `nextCursor` per list ViewModel and appends when needed.

## Anonymous mode: *critical calling rules*

Anonymous mode is not “JWT + isAnonymous=true”. For most anonymous actions:
- **Do not send `Authorization` at all** (backend returns `400 anon_jwt_not_allowed`).
- Use `X-Actor: anon` where required.
- Provide anon proof fields:
  - `asAnon: true`
  - `anonProfileId`, `anonCert`, `anonCertKid`, `anonSig`
  - Some actions require `anonTimestamp` (anonymous post create).

iOS anon proof + enrollment implementation:
- `looped-iOS/looped-iOS/Services/AnonService.swift`

Canonical action strings used for signatures (selected):
- `like|v1|{postId}`, `unlike|v1|{postId}`
- `save|v1|{postId}`, `unsave|v1|{postId}`
- `repost|v1|{postId}`, `unrepost|v1|{postId}`
- `post_edit|v1|{postId}`, `post_delete|v1|{postId}`
- `comment|v1|{postId}`, `comment_like|v1|{commentId}`, `comment_unlike|v1|{commentId}`
- `comment_edit|v1|{commentId}`, `comment_delete|v1|{commentId}`
- `comment_list|v1|{postId}`, `comment_replies|v1|{commentId}`
- `follow|v1|{userId}`, `unfollow|v1|{userId}`
- `block|v1|{id}`, `unblock|v1|{id}`
- Anon profile lists:
  - `anon_posts_liked|v1|{anonProfileId}`
  - `anon_posts_saved|v1|{anonProfileId}`
  - `comment_anon_replies|v1|{anonProfileId}`
- Anon profile display:
  - `anon_display_community|v1|{anonProfileId}`
  - `anon_display_specialization|v1|{anonProfileId}`

Anonymous post creation uses a different canonical format:
- `v2|{communityId}|{sha256Hex(content)}|{timestamp}`

## iOS Service → Endpoint map

This is the quickest way to answer “how does iOS call X?”.

### `FeedService.swift`
- Feed:
  - `GET /v1/feed?limit&cursor&mode&communityId`
  - `GET /v1/feed/trending?limit&communityId`
  - `GET /v1/feed/hashtags?communityId&limit&cursor`
- Posts:
  - `GET /v1/posts/{id}`
  - `GET /v1/posts/search?query&limit&cursor`
  - `POST /v1/posts` (user: requires `Idempotency-Key`; anon: no JWT + `X-Actor: anon` + anon proof)
  - `PUT /v1/posts/{id}` (supports anon proof)
  - `DELETE /v1/posts/{id}` (supports anon proof; iOS uses delete-with-body for anon)
- Post interactions:
  - `POST /v1/posts/{id}/like` / `DELETE /v1/posts/{id}/like` (supports anon proof)
  - `POST /v1/posts/{id}/save` / `DELETE /v1/posts/{id}/save` (supports anon proof)
  - `POST /v1/posts/{id}/share` (JWT only)
  - `PUT /v1/posts/{id}/repost` / `DELETE /v1/posts/{id}/repost` (supports anon proof + requires `X-Actor: anon` for anon)
- Collections:
  - `GET /v1/posts/liked?limit&cursor`
  - `GET /v1/posts/saved?limit&cursor`
  - `GET /v1/posts/reposted?limit&cursor`
  - `GET /v1/users/{id}/reposts?limit&cursor`
  - `GET /v1/users/me/reposts?limit&cursor`
  - `GET /v1/anon/{id}/reposts?limit&cursor`
- User content feeds:
  - `GET /v1/users/me/content?limit&cursor`
  - `GET /v1/users/{id}/content?limit&cursor`
  - `GET /v1/anon/{id}/content?limit&cursor`
- Anon profile posts lists (where supported):
  - `GET /v1/anon/{id}/posts?limit&cursor`
  - `GET /v1/anon/{id}/posts/liked?...anon proof query...`
  - `GET /v1/anon/{id}/posts/saved?...anon proof query...`

Notable iOS behavior:
- Post create may return a full post *or* `{id}`; iOS falls back to fetching `GET /v1/posts/{id}`.

### `CommentsService.swift`
- List:
  - `GET /v1/posts/{postId}/comments?limit&cursor`
  - `GET /v1/comments/{commentId}/replies?limit&cursor`
  - When anonymous mode is active, iOS attaches anon proof as **query params** (`asAnon=true&anonProfileId=...` etc) so the backend can compute `user_liked` for the anon profile.
- Create/edit/delete:
  - `POST /v1/posts/{postId}/comments` (supports anon proof)
  - `PUT /v1/comments/{id}` (supports anon proof)
  - `DELETE /v1/comments/{id}` (supports anon proof; anon uses delete-with-body)
- Like/unlike:
  - `POST /v1/comments/{id}/like` / `DELETE /v1/comments/{id}/like` (supports anon proof)

### `UserService.swift`
- Identity:
  - `GET /v1/me`
- Profiles:
  - `GET /v1/users/{id}`
  - `PUT /v1/users/me` (and legacy alias `PUT /users/me`)
- Onboarding:
  - `POST /v1/users/onboard`
  - `PUT /v1/users/me/onboarding`
  - `GET /v1/users/username/availability?username=...`
- Directory / people search:
  - `GET /v1/users/search?query&limit&cursor`
- User-authored content:
  - `GET /v1/users/{id}/posts?limit&cursor`
  - `GET /v1/users/{id}/comments?limit&cursor`
  - `GET /v1/users/{id}/replies?limit&cursor` (supports anon-proof query when acting as anon)
- Follows:
  - `POST /v1/users/{id}/follow` / `DELETE /v1/users/{id}/follow` (supports anon proof)
- Blocks:
  - `POST /v1/users/{id}/block` / `DELETE /v1/users/{id}/block` (supports anon proof)
  - `POST /v1/principals/{id}/block` / `DELETE /v1/principals/{id}/block` (supports anon proof)
- Display community/specialization:
  - `PUT /v1/users/me/display-community`
  - `PUT /v1/users/me/display-specialization`
- Account actions:
  - `POST /v1/users/me/deactivate` (soft delete)
  - `POST /v1/users/me/delete` (hard delete)

### `CommunityService.swift`
- Followed communities (feed filter):
  - `GET /v1/me/followed/communities?limit&cursor&order=...`
- Community search + discovery:
  - `GET /v1/communities/search?query&kind&limit&cursor`
  - `GET /v1/communities/recommended?kind&limit&cursor`
  - `GET /v1/communities/{id}`
- Domains (for email verification UX):
  - `GET /v1/communities/{id}/domains`
- Follow/join:
  - `POST /v1/communities/{id}/follow` / `DELETE /v1/communities/{id}/follow`
  - `POST /v1/communities/{id}/join` / `DELETE /v1/communities/{id}/join` (specialization join rules when applicable)
- Permissions (UI gating for “can post”):
  - `GET /v1/communities/{id}/permissions`
- Specializations:
  - `GET /v1/me/joined/specializations?type=...`
  - `GET /v1/me/specializations/join-limits?type=...`

### `CommunityVerificationService.swift`
- `GET /v1/communities/verifications`
- `POST /v1/communities/{id}/verification/start`
- `POST /v1/communities/{id}/verification/finish`
- `DELETE /v1/communities/{id}/verification`

### `DiscoveryService.swift`
- Loops + hashtags search:
  - `GET /v1/loops/search?query&limit&cursor`
  - `GET /v1/hashtags/search?query&limit&cursor`
- Hashtag feed:
  - `GET /v1/hashtags/{name}/posts?limit&cursor`
- Majors/fields indices:
  - `GET /v1/majors`
  - `GET /v1/fields`
- Recommended/browse specializations:
  - `GET /v1/specializations/recommended?type=major|field|all&limit=...`
  - `GET /v1/specializations/browse?type=major|field&limit&cursor`

### `MessageService.swift` + `MessageMediaService.swift`
- Conversations:
  - `GET /v1/conversations?limit&cursor`
  - `POST /v1/conversations` (start DM)
  - `GET /v1/conversations/{id}/messages?limit&cursor`
  - `POST /v1/conversations/{id}/messages`
  - `PUT /v1/conversations/{id}/preferences` (muted; iOS tolerates 204)
- Channels:
  - `GET /v1/channels?limit&cursor`
  - `POST /v1/channels` (create group)
  - `PATCH /v1/channels/{id}` (rename / photo media asset id)
  - `DELETE /v1/channels/{id}`
  - `GET /v1/channels/{id}/members?limit&cursor`
  - `POST /v1/channels/{id}/members` (add members)
  - `PUT /v1/channels/{id}/members/{userId}` (permissions)
  - `DELETE /v1/channels/{id}/members/{userId}`
  - `GET /v1/channels/{id}/messages?limit&cursor`
  - `POST /v1/channels/{id}/messages`
  - `PUT /v1/channels/{id}/preferences` (muted; iOS tolerates 204)
- Message requests:
  - `GET /v1/message-requests?limit&cursor`
  - `POST /v1/message-requests/{id}/approve`
  - `POST /v1/message-requests/{id}/reject`
- Search:
  - `GET /v1/messages/search?query&limit&cursor`
- Message media:
  - `POST /v1/message-media/presign`
  - `POST /v1/message-media/resolve`

Notable iOS behavior:
- Chat polling: `ChatViewModel` polls every ~2.5s while chat is open (messages + some state).
- Backend blocks anonymous profiles from messaging (`403 anonymous_not_allowed`).

### `NotificationService.swift`
- `GET /v1/notifications?limit&cursor`
- `POST /v1/notifications/{id}/read`
- Preferences:
  - `GET /v1/notifications/preferences`
  - `PUT /v1/notifications/preferences`

### `MediaService.swift`
- Public media upload:
  - `POST /v1/media/presign` (no auth required)
  - Upload to S3 via returned `uploadUrl` (usually PUT)
  - `POST /v1/media/callback` (JWT for user uploads; `X-Actor: anon` for anon uploads)
  - Optional: `X-Media-Signature` header for callback if backend provides `callbackSignature`
- Resolve IDs to URLs:
  - `POST /v1/media/resolve`
    - iOS tries with auth; if 401, retries without auth (some media is public)

### `DeviceService.swift`
- `POST /v1/devices` with `{ apnsToken, platform:"ios" }`

### `ContentPreferencesService.swift`
- `GET /v1/content/preferences`
- `PUT /v1/content/preferences` with `{ hideAnonymousPosts: boolean }`

### `ModerationService.swift`
- `POST /v1/reports`
- `GET /v1/violations?limit&cursor`
- `POST /v1/appeals`
- `GET /v1/appeals?status=...`

### `PollsService.swift`
- `PUT /v1/polls/{pollId}/vote` with `{ selectedOptionIds: [...] }`

## Takeaways for the web client

- Treat backend as authoritative; avoid duplicating business rules client-side.
- Always implement:
  - Cursor pagination (`next_cursor`)
  - 204 handling for some endpoints
  - Snake_case response decoding (or a consistent conversion layer)
- Anonymous mode is a distinct “actor”:
  - Never send JWT + anon proof together.
  - Many “anon capable” endpoints accept JWT or anon proof, but not both.
