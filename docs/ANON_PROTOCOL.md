# Anonymous Mode Protocol (enrollment + action proofs)

Anonymous mode in Looped is a **separate actor** from a logged-in user:
- You keep your real account (Firebase-authenticated user).
- You can also act as an anonymous persona (“anon profile”) that is cryptographically proven but **JWT-free** for actions.

This doc exists because most integration bugs come from mixing JWT auth with anon proof fields.

Primary references:
- iOS implementation: `looped-iOS/looped-iOS/Services/AnonService.swift`
- Backend implementation:
  - Security allow-list: `looped-services/apps/api/src/main/java/com/looped/auth/SecurityConfig.java`
  - Enrollment endpoints: `looped-services/apps/api/src/main/java/com/looped/anon/AnonController.java`
  - Anon profile endpoints: `looped-services/apps/api/src/main/java/com/looped/anon/AnonProfilesController.java`

## Golden rules

1) **Never send `Authorization` when acting as anon.**
   - Backend returns `400 { error: "anon_jwt_not_allowed" }` by design.
2) **Anon actions require proof fields.**
   - `asAnon: true`
   - `anonProfileId`, `anonCert`, `anonCertKid`, `anonSig`
   - Some actions require `anonTimestamp` (anonymous post create).
3) **Some anon endpoints require `X-Actor: anon`.**
   - Example: anonymous repost and anon display specialization.

## Concepts

### Persona keypair (device-held)
- iOS generates a `Curve25519.Signing.PrivateKey` (CryptoKit) and stores it locally.
- The public key is base64-encoded and used as the “personaPubkey”.

### Anonymous certificate (server-issued)
- The server issues a blind-signed certificate proving the persona pubkey is valid for a scope (community + company).
- Certificates expire; clients must re-enroll when expired.

### Action proof (per request)
- For each anonymous action, the client signs a canonical string.
- The backend verifies:
  - the signature (Curve25519)
  - that the certificate is valid and scoped correctly
  - that the action string matches the route + target id

## Enrollment flow (how iOS does it)

Prerequisites:
- The user must be provisioned (onboarding complete enough for backend to create a user record).
- Enrollment is community-scoped:
  - You must have a `communityId` context.
  - For non-specialization communities, the backend may require the user be verified in that community before enrolling.

Steps:

1) Fetch issuer public key (JWT required)
   - `GET /anon/issuer?communityId=<id>`
   - Response:
     - `{ kid, alg:"RSABSSA", public_key_pem, expires_at }`

2) Blind signature issuance (JWT required)
   - Create message:
     - `certMessage = "anon-cert|v1|<personaPubkeyBase64>"`
     - `certHash = sha256(certMessage)`
   - Blind `certHash` using the issuer RSA public key.
   - `POST /anon/issue`
     - Body: `{ communityId, blindedMessage }`
   - Response:
     - `{ anon_cert_kid, blinded_signature, expires_at }`
   - Unblind the signature client-side.

3) Register persona (NO JWT)
   - `POST /anon/register`
     - Body: `{ personaPubkey, anonCert, anonCertKid }`
     - Must omit `Authorization` header.
   - Response:
     - `{ anon_profile_id, handle, community_id, anon_cert_kid, expires_at }`

iOS stores:
- `AnonIdentity.profileId` + `handle`
- A per-community membership:
  - `cert`, `certKid`, `certExpiresAt`

## Generating anon action proofs

iOS proof algorithm (conceptual):

1) Build a canonical action string, e.g.:
   - `like|v1|123`
2) Compute digest:
   - `digest = sha256(canonicalString)`
3) Sign digest with persona private key (Curve25519 signing):
   - `signatureBytes = privateKey.signature(digest)`
4) Encode base64:
   - `anonSig = base64(signatureBytes)`

Payload fields:
- `asAnon: true`
- `anonProfileId: number`
- `anonCert: string` (base64)
- `anonCertKid: string`
- `anonSig: string` (base64)

## Canonical strings (from iOS)

From `looped-iOS/looped-iOS/Services/AnonService.swift`:

Post actions:
- `post_edit|v1|{postId}`
- `post_delete|v1|{postId}`

Reactions:
- `like|v1|{postId}` / `unlike|v1|{postId}`
- `save|v1|{postId}` / `unsave|v1|{postId}`
- `repost|v1|{postId}` / `unrepost|v1|{postId}`

Comments:
- `comment|v1|{postId}`
- `comment_like|v1|{commentId}` / `comment_unlike|v1|{commentId}`
- `comment_edit|v1|{commentId}` / `comment_delete|v1|{commentId}`
- List proofs (used as query params so backend can compute `user_liked`):
  - `comment_list|v1|{postId}`
  - `comment_replies|v1|{commentId}`
  - `comment_user_replies|v1|{userId}`

Follows/blocks:
- `follow|v1|{userId}` / `unfollow|v1|{userId}`
- `follow_anon|v1|{anonProfileId}` / `unfollow_anon|v1|{anonProfileId}`
- `block|v1|{id}` / `unblock|v1|{id}` (used for both users + principals)

Anon profile meta:
- `anon_posts_liked|v1|{anonProfileId}`
- `anon_posts_saved|v1|{anonProfileId}`
- `comment_anon_replies|v1|{anonProfileId}`
- `anon_display_community|v1|{anonProfileId}`
- `anon_display_specialization|v1|{anonProfileId}`

Revoke:
- `revoke|v1|{anonProfileId}`

### Anonymous post creation canonical string

iOS uses a distinct format for creating anonymous posts:
- `timestamp = secondsSinceEpoch`
- `contentHash = sha256Hex(contentUtf8)`
- `canonical = "v2|{communityId}|{contentHash}|{timestamp}"`

Sent in the post create body:
- `anonTimestamp: timestamp`

## Where anon proofs are sent (by endpoint)

Body-based proofs (common pattern):
- `POST /v1/posts/{id}/like` and `DELETE /v1/posts/{id}/like`
- `POST /v1/posts/{id}/save` and `DELETE /v1/posts/{id}/save`
- `PUT /v1/posts/{id}` and `DELETE /v1/posts/{id}`
- `POST /v1/posts/{id}/comments` / `PUT /v1/comments/{id}` / `DELETE /v1/comments/{id}`
- `POST /v1/comments/{id}/like` / `DELETE /v1/comments/{id}/like`
- `POST /v1/users/{id}/follow` / `DELETE /v1/users/{id}/follow`
- `POST /v1/anon/{id}/follow` / `DELETE /v1/anon/{id}/follow` (anon-following anon profiles)
- `POST /v1/users/{id}/block` / `DELETE /v1/users/{id}/block`
- `POST /v1/principals/{id}/block` / `DELETE /v1/principals/{id}/block`

Query-param proofs (used for “viewer state” computation in lists):
- `GET /v1/posts/{postId}/comments?...anon proof query...`
- `GET /v1/comments/{commentId}/replies?...anon proof query...`
- `GET /v1/users/{userId}/replies?...anon proof query...`
- `GET /v1/anon/{anonProfileId}/posts/liked?...anon proof query...`
- `GET /v1/anon/{anonProfileId}/posts/saved?...anon proof query...`
- `GET /v1/anon/{anonProfileId}/replies?...anon proof query...`

Header requirements:
- Some endpoints require `X-Actor: anon` in addition to proofs:
  - `PUT /v1/posts/{id}/repost` and `DELETE /v1/posts/{id}/repost` when acting as anon
  - `PUT /v1/anon/{id}/display-specialization`
  - `POST /v1/anon/{id}/follow` and `DELETE /v1/anon/{id}/follow`

JWT-only anon profile graph endpoints (no anon proofs):
- `GET /v1/anon/{id}/followers`
- `GET /v1/anon/{id}/following`

The backend’s permit-all list for anon-capable endpoints is in `SecurityConfig.java`.

## Common error codes (anon)

- `400 anon_jwt_not_allowed` — you included `Authorization` on an anon action.
- `403 invalid_anon_proof` — missing/invalid proof fields or signature.
- `400 invalid_actor` — missing required `X-Actor: anon`.
- `403 anon_revoked` — persona pubkey is revoked (registration blocked).
- `409 anon_enrollment_blocked` — enrollment sanctioned for a community.
- `403 community_not_verified` — enrollment/action requires verification in the community.

## Backup + restore (iOS behavior)

iOS supports backing up the persona private key:
- Encrypts the private key bytes with a user passphrase + random salt.
- Uploads ciphertext blob:
  - `POST /anon/backup` (JWT required)
  - Body: `{ blobId, salt, ciphertext, expiresAt? }`
- Restore:
  - `GET /anon/backup/{blobId}` (JWT required by `SecurityConfig`)
  - Decrypts private key, then re-enrolls to recreate memberships.

## Web implementation guidance

- If/when the web client supports anonymous mode:
  - Treat it as a first-class actor mode in your API layer.
  - Centralize the “don’t send JWT” behavior; don’t rely on caller discipline.
  - Expect to support both anon-proof-in-body and anon-proof-in-query patterns.
