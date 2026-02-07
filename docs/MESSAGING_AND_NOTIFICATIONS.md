# Messaging + Notifications

This doc focuses on the “realtime-ish” surfaces: inbox, chats, message requests, and notifications. Today, iOS is **polling-based** (WebSockets are not relied upon yet).

Primary references:
- Backend controllers:
  - `looped-services/apps/api/src/main/java/com/looped/messaging/*Controller.java`
  - `looped-services/apps/api/src/main/java/com/looped/notifications/*Controller.java`
- iOS:
  - Messaging service: `looped-iOS/looped-iOS/Services/MessageService.swift`
  - Chat polling: `looped-iOS/looped-iOS/ViewModels/MessagesViewModel.swift` (`ChatViewModel`)
  - Notifications: `looped-iOS/looped-iOS/Services/NotificationService.swift`

## Messaging overview

There are two chat types:
- Conversations (DMs): `/v1/conversations/*`
- Channels (group chats): `/v1/channels/*`

Message attachments:
- Stored as message-media keys (usually starting with `dm/`)
- Must be resolved to download URLs via `/v1/message-media/resolve`
- See `MEDIA_AND_UPLOADS.md`

### Anonymous profiles are blocked

Messaging endpoints reject anonymous profiles with:
- `403 { "error": "anonymous_not_allowed" }`

This applies to conversations, channels, message requests, search, and message-media presign/resolve.

## iOS polling behavior (important for parity)

Chat screen polling:
- `ChatViewModel` polls every ~2.5 seconds while the chat view is open.
- Polling calls `GET /v1/conversations/{id}/messages` or `GET /v1/channels/{id}/messages` depending on context.

Inbox polling:
- iOS loads inbox on app start and on tab visits; it does not maintain a continuous inbox poll loop by default (it may refresh on user interactions).

If the web client wants parity, use:
- “pull-to-refresh” and/or short interval polling for open chats (not the entire inbox) to limit load.

## Conversations (DMs)

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/ConversationsController.java`

- List inbox DMs:
  - `GET /v1/conversations?limit=...&cursor=...`
  - Response envelope:
    - `{ items: [ { id, other_user_profile, last_message, last_message_timestamp, unread_count, muted, ... } ], next_cursor? }`
- Start a DM:
  - `POST /v1/conversations`
  - Body: `{ participantUserId: number }`
  - Response: conversation payload
- List messages:
  - `GET /v1/conversations/{id}/messages?limit=...&cursor=...`
  - Response: `{ items: [ { id, sender_id, content, attachments?, created_at } ], next_cursor? }`
  - Common errors:
    - `403 message_request_pending`
    - `403 message_request_rejected`
- Send message:
  - `POST /v1/conversations/{id}/messages`
  - Body: `{ content: string, attachments?: [...] }`
  - On invalid attachments: `400 invalid_attachments`
- Preferences:
  - `PUT /v1/conversations/{id}/preferences` with `{ muted: boolean }`
  - Some deployments may respond `204` for preference updates; handle empty bodies as success.

## Channels (group chats)

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/ChannelsController.java`

- List channels:
  - `GET /v1/channels?limit=...&cursor=...`
- Create:
  - `POST /v1/channels`
  - Body: `{ name: string, memberUserIds?: number[] }`
- Update channel metadata:
  - `PATCH /v1/channels/{id}`
  - Supports updating `name` and/or `photoMediaAssetId` (snake_case alias supported).
- Delete:
  - `DELETE /v1/channels/{id}`
- Members:
  - `GET /v1/channels/{id}/members?limit&cursor`
  - `POST /v1/channels/{id}/members` with `{ userIds: number[] }`
  - `PUT /v1/channels/{id}/members/{userId}` with `{ canManageMembers: boolean }`
  - `DELETE /v1/channels/{id}/members/{userId}`
- Messages:
  - `GET /v1/channels/{id}/messages?limit&cursor`
  - `POST /v1/channels/{id}/messages`
- Preferences:
  - `PUT /v1/channels/{id}/preferences` with `{ muted: boolean }`
  - Some deployments may respond `204`.

## Message requests

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/MessageRequestsController.java`

- List:
  - `GET /v1/message-requests?limit&cursor`
- Approve:
  - `POST /v1/message-requests/{id}/approve`
- Reject:
  - `POST /v1/message-requests/{id}/reject`

## Message search

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/MessagingSearchController.java`

- `GET /v1/messages/search?query=...&limit=...&cursor=...`
  - `query` must be at least 2 chars
  - Response: `{ items: [...], next_cursor? }`

iOS behavior:
- Resolves any matched-message attachment keys with `/v1/message-media/resolve` for rendering.

## Notifications

Notifications are **not** delivered via WebSockets today; iOS loads on app start and refreshes on user interaction. Push exists for iOS, but the web client primarily uses in-app notifications.

Backend:
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationsController.java`
- `looped-services/apps/api/src/main/java/com/looped/notifications/NotificationPreferencesController.java`

- List:
  - `GET /v1/notifications?limit&cursor`
  - Response: `{ items: [{ id, type, created_at, unread, payload? }], next_cursor? }`
  - Backend normalizes deeplinks:
    - If `payload.deeplink` exists but `payload.action_deeplink` is missing, it is copied (and vice-versa).
- Mark read:
  - `POST /v1/notifications/{id}/read` → `{ read: true }`

### Notification payloads + deeplinks

Payload fields vary by type (see `looped-services/docs/API_EXTENSIONS.md` for a full list), but common keys include:
- actor identifiers:
  - `actor_user_id`, `actor_anon_profile_id`, `actor_is_anonymous`
  - `actor_display_name`, `actor_profile_image_url`
- targets:
  - `post_id`, `comment_id`, `conversation_id`, `message_id`
- navigation:
  - `deeplink`, `action_deeplink`

Deeplink conventions (examples):
- `looped://post/{post_id}`
- `looped://comment/{comment_id}?post_id={post_id}`
- `looped://user/{user_id}?anon=true|false`
- `looped://conversations/{conversation_id}`

### Notification preferences

- `GET /v1/notifications/preferences`
- `PUT /v1/notifications/preferences`

The preferences object is nested by channel and type (push/in-app/email; follow/like/comment/etc). Clients should treat unknown fields as forward-compatible.

