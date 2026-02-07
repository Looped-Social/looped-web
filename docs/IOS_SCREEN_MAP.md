# iOS screen map (views + flows)

This is a high-level map of the SwiftUI screens in `looped-iOS` so a web agent can understand “what exists” and which backend surfaces back each screen.

Primary references:
- Screens: `looped-iOS/looped-iOS/Views`
- State: `looped-iOS/looped-iOS/ViewModels`
- API calls: `looped-iOS/looped-iOS/Services`
- Wiring status: `looped-iOS/looped-iOS/Docs/CODEX_HANDOFF.md`

## App entry + gating

- `ContentView.swift`
  - Instantiates and injects `AuthViewModel` + `FeedViewModel` as environment objects.
  - Routes:
    - unauthenticated → `AuthView`
    - authenticated + onboarding incomplete → `AuthView` (onboarding flow)
    - authenticated + onboarded → `MainTabView`
  - Also fetches `GET /v1/app-config` (best-effort) for `default_profile_image_url`.

## Auth + onboarding flow

Entry:
- `Views/AuthView.swift` (wrapper that renders login/signup/onboarding steps)

Auth screens (`Views/AuthViews/*`):
- `LoginView.swift` / `SignUpView.swift`
  - Firebase email/password auth; on success calls `GET /v1/me` to bootstrap identity.
- `ForgotPasswordView.swift`
- `TwoFactorChallengeView.swift` (Firebase MFA handling)

Onboarding (`Views/AuthViews/OnboardingView.swift` and related):
- `ProfileSetupView.swift`
  - Calls `POST /v1/users/onboard` (username + name + DOB).
  - May call `GET /v1/users/username/availability`.
- Organization/community selection:
  - `OrganizationSelectionView.swift`
  - `OrganizationDetailSelectionView.swift`
  - `CommunitySelectionView.swift`
  - Uses community search/recommended endpoints (see `DiscoveryService`/`CommunityService`).
- Verification:
  - `WaysToVerifyView.swift`, `VerificationIntroView.swift`, `EmailVerificationView.swift`
  - Uses:
    - `GET /v1/communities/{id}/domains`
    - `POST /v1/communities/{id}/verification/start`
    - `POST /v1/communities/{id}/verification/finish`
  - Photo ID flow (when required):
    - `PhotoIdVerificationView.swift` (uses `/v1/verification/photo-id/*` and/or community-scoped variants)
- `VerificationNotificationsView.swift`
  - Sets notification preferences via `PUT /v1/notifications/preferences`
- Onboarding progress is also reported to backend via:
  - `PUT /v1/users/me/onboarding`

## Main tabs (post-onboarding)

Tabs are defined in `Views/Shared/Core/CustomTabBar.swift`:
- Home, Messages, Search, Notifications, Profile

### Home / Feed

- `Views/FeedView.swift`
  - State: `FeedViewModel`
  - Calls:
    - `GET /v1/feed` (cursor paging)
    - `GET /v1/me/followed/communities` (feed filter chips)
    - `GET /v1/communities/search` (community filter search)
  - Post card component: `Views/Shared/Feed/PostCard.swift`
  - Actions from the feed UI:
    - Like: `POST/DELETE /v1/posts/{id}/like` (supports anon)
    - Save: `POST/DELETE /v1/posts/{id}/save` (supports anon)
    - Repost: `PUT/DELETE /v1/posts/{id}/repost` (supports anon with `X-Actor: anon`)
    - Share count: `POST /v1/posts/{id}/share` (JWT only)

No-UI-for-web constraint:
- iOS has a composer sheet: `Views/CreatePostView.swift` calling `POST /v1/posts`.
- Web should not implement posting (per current requirement), but the endpoint behavior is documented in `API_CONTRACT.md`.

### Search

- `Views/SearchView.swift`
  - State: `SearchViewModel`
  - Aggregates results across:
    - People: `GET /v1/users/search`
    - Posts: `GET /v1/posts/search`
    - Loops: `GET /v1/loops/search`
    - Hashtags: `GET /v1/hashtags/search`
    - Trending posts: `GET /v1/feed/trending`
- Results list/detail:
  - `Views/SearchResultsView.swift` + `SearchResultsViewModel`
  - `Views/SearchPostsFeedView.swift` + `SearchPostsFeedViewModel`
  - `Views/HashtagFeedView.swift` + `HashtagFeedViewModel`

### Messages

- `Views/MessagesView.swift`
  - State: `MessagesViewModel`
  - Calls:
    - `GET /v1/conversations`
    - `GET /v1/channels`
    - `GET /v1/message-requests`
- `Views/ChatView.swift`
  - State: `ChatViewModel`
  - Calls:
    - `GET /v1/conversations/{id}/messages` or `GET /v1/channels/{id}/messages`
    - `POST /v1/conversations/{id}/messages` or `POST /v1/channels/{id}/messages`
    - Message attachments:
      - `POST /v1/message-media/presign`
      - upload to S3
      - resolve:
        - `POST /v1/message-media/resolve`
  - Polling interval is ~2.5s while open.
- `Views/NewMessageView.swift`
  - Uses people search (`GET /v1/users/search`) to start DMs (`POST /v1/conversations`).
- `Views/MessageRequestsView.swift` supports request approve/reject endpoints.
- `Views/ChatDetailsView.swift` covers channel member management and preferences.

### Notifications

- `Views/NotificationsView.swift`
  - State: `NotificationsViewModel`
  - Calls:
    - `GET /v1/notifications`
    - `POST /v1/notifications/{id}/read`
  - Notification preferences (Settings) are backed by:
    - `GET/PUT /v1/notifications/preferences`

### Profile

- `Views/ProfileView.swift`
  - State: `ProfileViewModel` + content ViewModels for lists.
  - Reads identity/profile from `/v1/me` and loads:
    - My posts: `GET /v1/users/{id}/posts`
    - My content: `GET /v1/users/me/content`
    - Saved: `GET /v1/posts/saved`
    - Liked: `GET /v1/posts/liked`
    - Reposts: `GET /v1/posts/reposted` (and related endpoints)
- Edit profile:
  - `Views/EditProfileView.swift` → `PUT /v1/users/me`

Other user profiles:
- `Views/UserProfileView.swift`
- `Views/UserFollowListView.swift`
- Follow/unfollow endpoints:
  - `POST/DELETE /v1/users/{id}/follow` (supports anon)

## Comments (modal navigation)

- `Views/CommentsView.swift`
  - Lists and creates comments/replies:
    - `GET /v1/posts/{id}/comments`
    - `POST /v1/posts/{id}/comments`
    - `GET /v1/comments/{id}/replies`
    - Like/unlike comments: `POST/DELETE /v1/comments/{id}/like`
  - When anonymous mode is enabled, list endpoints add anon proof query params so the backend can compute “viewer liked” for the anon profile.

## Settings and account management

- `Views/SettingsView.swift` and `Views/Settings/*`
  - Notifications: `NotificationSettingsView.swift` → `/v1/notifications/preferences`
  - Blocked users: `BlockedUsersView.swift` → `/v1/users/blocked`, `/v1/users/{id}/block`
  - Messaging permissions: `MessagingPermissionsView.swift` → user profile update message permission
  - Anonymous recovery: `AnonymousRecoveryView.swift` → `/anon/backup` + `/anon/backup/{blobId}` + re-enrollment
  - Community verifications: `CommunityVerificationsView.swift` → `GET /v1/communities/verifications`
  - Delete account: `DeleteAccountIntroView.swift` / `DeleteAccountConfirmView.swift` → `POST /v1/users/me/deactivate` and `POST /v1/users/me/delete`
  - Violations/appeals:
    - `ViolationsView.swift` + `AppealsViewModel` → `/v1/violations`, `/v1/appeals`
  - Under review:
    - `UnderReviewView.swift` (uses moderation endpoints/state)

## Community profile + requests

- `Views/CommunityProfileView.swift`
  - Community details: `GET /v1/communities/{id}`
  - Follow/join: `/v1/communities/{id}/follow` and `/v1/communities/{id}/join`
  - Posting permission gating: `GET /v1/communities/{id}/permissions`

- `Views/CommunityRequest/CommunityRequestFlowView.swift`
  - Submits requests:
    - `POST /v1/community-requests`
  - Can attach an image via the public media upload flow (`/v1/media/presign` + callback).

