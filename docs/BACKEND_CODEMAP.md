# Backend codemap (where endpoints live)

This is a “where do I look?” map for `looped-services` so web agents can quickly find the authoritative implementation for an endpoint.

Backend root:
- `looped-services/apps/api/src/main/java/com/looped`

## Security + auth gates

Start here whenever an endpoint behaves unexpectedly:
- `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`

It defines:
- Which routes are `permitAll()` (notably anon-capable actions and media presign/callback/resolve).
- The default policy: `/v1/**` and `/anon/**` are authenticated unless allow-listed.
- CORS allowed headers/origins.

## Core controllers (by domain)

### Health
- `looped-services/apps/api/src/main/java/com/looped/web/HealthController.java`

### App config
- `looped-services/apps/api/src/main/java/com/looped/settings/AppConfigController.java`

### Auth / identity
- `looped-services/apps/api/src/main/java/com/looped/auth/MeController.java` (`GET /v1/me`)
- `looped-services/apps/api/src/main/java/com/looped/auth/MeAnalyticsController.java` (`GET /v1/me/analytics`)
- `looped-services/apps/api/src/main/java/com/looped/auth/MeProvidersController.java` (unlink provider via Firebase Admin)

### Users / profiles / onboarding
- `looped-services/apps/api/src/main/java/com/looped/users/UsersController.java`
- Legacy aliases:
  - `looped-services/apps/api/src/main/java/com/looped/users/UserAliasController.java` (e.g., `PUT /users/me`)
- Follow graph + follow/unfollow:
  - `looped-services/apps/api/src/main/java/com/looped/users/FollowsController.java`
- Blocks:
  - `looped-services/apps/api/src/main/java/com/looped/users/BlocksController.java`
  - `looped-services/apps/api/src/main/java/com/looped/users/PrincipalBlocksController.java`

### Feed + posts
- Feed:
  - `looped-services/apps/api/src/main/java/com/looped/posts/FeedController.java`
- Posts (search + CRUD):
  - `looped-services/apps/api/src/main/java/com/looped/posts/PostsController.java`
- Interactions:
  - Likes: `looped-services/apps/api/src/main/java/com/looped/posts/LikesController.java`
  - Saves + collections: `looped-services/apps/api/src/main/java/com/looped/posts/PostCollectionsController.java`
  - Reposts: `looped-services/apps/api/src/main/java/com/looped/posts/RepostsController.java`
  - Shares: `looped-services/apps/api/src/main/java/com/looped/posts/PostSharesController.java`
- Per-user repost lists:
  - `looped-services/apps/api/src/main/java/com/looped/posts/UserRepostsController.java`

### Comments
- `looped-services/apps/api/src/main/java/com/looped/comments/CommentsController.java`

### Content preferences
- `looped-services/apps/api/src/main/java/com/looped/content/ContentPreferencesController.java`

### Communities + discovery + verification
- Discovery/search endpoints (communities, loops, hashtags, specializations):
  - `looped-services/apps/api/src/main/java/com/looped/discovery/DiscoveryController.java`
- Community details:
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunitiesController.java`
- Specialization follow/join + joined lists/limits:
  - `looped-services/apps/api/src/main/java/com/looped/communities/SpecializationsController.java`
- Community domains:
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunityDomainsController.java`
- Community verification + permissions:
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunityVerificationController.java`
- Community requests:
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunityRequestsController.java`
- Follow/join:
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunityFollowsController.java`
  - `looped-services/apps/api/src/main/java/com/looped/communities/CommunityJoinsController.java`

### Media
- Public media:
  - `looped-services/apps/api/src/main/java/com/looped/media/MediaController.java`
- Message media:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/MessageMediaController.java`

### Messaging
- Conversations:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/ConversationsController.java`
- Channels:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/ChannelsController.java`
- Message requests:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/MessageRequestsController.java`
- Search:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/MessagingSearchController.java`

### Notifications
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationsController.java`
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationPreferencesController.java`

### Devices (push registration)
- `looped-services/apps/api/src/main/java/com/looped/devices/DevicesController.java`

### Moderation
- Reports:
  - `looped-services/apps/api/src/main/java/com/looped/moderation/ModerationController.java`
- Appeals:
  - `looped-services/apps/api/src/main/java/com/looped/moderation/AppealsController.java`
- Violations:
  - `looped-services/apps/api/src/main/java/com/looped/moderation/ViolationsController.java`

### Feedback
- `looped-services/apps/api/src/main/java/com/looped/feedback/FeedbackController.java` (`POST /v1/feedback`, auth optional)

### Polls
- `looped-services/apps/api/src/main/java/com/looped/polls/PollsController.java`

### Anonymous protocol
- Enrollment + backup + revoke:
  - `looped-services/apps/api/src/main/java/com/looped/anon/AnonController.java`
- Anon profile read/update + anon profile collections:
  - `looped-services/apps/api/src/main/java/com/looped/anon/AnonProfilesController.java`

## Admin endpoints (not for the consumer web client)

Admin controllers live under:
- `looped-services/apps/api/src/main/java/com/looped/admin`

They are typically protected by an edge secret filter:
- `looped-services/apps/api/src/main/java/com/looped/admin/AdminEdgeSecretFilter.java`

If you’re implementing user-facing web UI, you generally should not call these endpoints.
