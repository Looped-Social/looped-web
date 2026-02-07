# Media + Uploads (public media + message media)

Media in Looped is uploaded client-side to S3 using server-issued presigned URLs, then “finalized” via an API callback so the backend can create a media asset record and return a CDN URL.

Primary references:
- Backend: `looped-services/apps/api/src/main/java/com/looped/media/MediaController.java`
- iOS: `looped-iOS/looped-iOS/Services/MediaService.swift`
- Web helper (community request image): `looped-web/apps/web/src/lib/communityApi.ts`

## Public media assets (`/v1/media/*`)

### 1) Presign upload

- `POST /v1/media/presign` (no auth required)
  - Body: `{ contentType: string, sizeBytes: number }`
  - Response (typical):
    - `key` (S3 key like `media/...`)
    - `uploadUrl` (presigned PUT URL)
    - `headers` (may include `Content-Type`)
    - `callbackSignature` (optional HMAC signature for callback)

### 2) Upload to S3

- Upload directly to `uploadUrl` with `PUT` (or method indicated by backend if present).
- Include any headers returned from presign.
- On success you should get a 2xx from S3.

### 3) Callback / finalize

- `POST /v1/media/callback` (route is permit-all; request rules depend on actor)
  - Headers:
    - Optional: `X-Media-Signature: <callbackSignature>` (when returned from presign)
    - Optional: `X-Actor: anon` (when the uploader is the anonymous actor)
  - Body:
    - `{ key, mimeType, width, height, durationSeconds?, thumbnailMediaAssetId? }`

Actor rules (enforced in the controller):
- User uploads:
  - Must include `Authorization`.
- Anon uploads:
  - Must omit `Authorization`.
  - Should include `X-Actor: anon`.

Response:
- Media asset payload containing at least:
  - `id`
  - `key`
  - `mime_type` / `mimeType`
  - `cdn_url` / `cdnUrl`
  - For video: optional `thumbnail_*` fields

### Callback signature (`X-Media-Signature`)

Backend behavior:
- If `MEDIA_CALLBACK_SECRET` is configured, the backend validates:
  - `expected = HMAC_SHA256_BASE64(secret, key)`
  - `X-Media-Signature` must match.
- If the secret is not configured, signature validation is skipped.

Practical guidance:
- If `callbackSignature` is returned from presign, always send it back on callback.
- If it’s absent, omit `X-Media-Signature`.

### Resolve media IDs to URLs

- `POST /v1/media/resolve` (no auth required)
  - Body: `{ ids: number[] }` (max chunk size is effectively 50 in iOS)
  - Response: `{ items: [{ id, key, mime_type, cdn_url, ... }] }`

Visibility behavior:
- Public media is visible without auth.
- Some media may require auth if it is user-owned and not public.

iOS behavior:
- Tries resolve with auth first; if it gets a 401, retries without auth.

## Message media (`/v1/message-media/*`)

Message attachments are stored under message-media keys (commonly prefixed with `dm/`) and are resolved to short-lived download URLs.

Backend: `looped-services/apps/api/src/main/java/com/looped/messaging/MessageMediaController.java`
iOS: `looped-iOS/looped-iOS/Services/MessageMediaService.swift`

### Presign message upload

- `POST /v1/message-media/presign` (auth required)
  - Body: `{ contentType: string, sizeBytes: number }`
  - Response: `{ key, uploadUrl, headers }`

Constraints:
- Anonymous profiles are blocked from message media with:
  - `403 { error: "anonymous_not_allowed" }`

### Upload to S3

- `PUT <uploadUrl>` with provided headers/body.
- Store the returned `key` in the message’s `attachments` payload.

### Resolve message media

- `POST /v1/message-media/resolve` (auth required)
  - Body: `{ keys: string[] }` (keys are filtered/deduped; server limits to ~50)
  - Response: `{ items: [{ key, downloadUrl, expires_in_seconds? }] }`

Backend checks:
- Keys must match expected prefix patterns (backend currently rejects non-`dm/` keys).
- The caller must be authorized to access the media (conversation/channel membership rules).

## Web code that already exists

There is a working example of the presign → upload → callback pattern in:
- `looped-web/apps/web/src/lib/communityApi.ts` (`uploadCommunityImage`)

