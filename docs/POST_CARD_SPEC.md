# Post Card Spec (Feed item)

Last updated: 2026-02-07

This is a practical layout + token spec for the **main feed post card** and its **loading skeleton**, using the iOS implementation as the canonical reference and noting where the current web implementation differs.

Primary sources:
- iOS: `looped-iOS/looped-iOS/Views/Shared/Feed/PostCard.swift`
- iOS skeleton: `looped-iOS/looped-iOS/Views/Shared/Feed/PostCardSkeleton.swift`
- Web placeholder: `looped-web/apps/web/src/app/components/PostCard/PostCard.tsx`

## Overall container

iOS `PostCard`:
- Surface: `Color.loopedBackground`
- Padding: `16`
- Corner radius: `0` (cards typically stack in a list with separators handled outside)
- Vertical section spacing inside card: `12`

Web (current):
- `<article className="bg-bg px-4 py-4">` → matches iOS padding (16) and background.

## Header block

iOS (`headerSection`):
- Layout: `HStack(alignment: .top, spacing: 12)`
- Avatar:
  - Size: **40×40**
  - Shape: circle (`ProfileAvatarView(...).clipShape(Circle())`)
  - **Not shown for anonymous posts** (`if !post.isAnonymous { authorAvatar }`)
- Primary line:
  - Author name: `loopedHeadlineScaled` (Poppins SemiBold, 17, dynamic type)
    - Color: `SecondaryColor` when anonymous, else `TextPrimaryColor`
  - Optional specialization/company line (after `•`):
    - Font: `loopedSubheadlineScaled` (Poppins Regular, 15, dynamic type)
    - Color: `TextSecondaryColor`
- Overflow menu:
  - `Image(systemName: "ellipsis")` tinted `TextSecondaryColor`
- Optional “Posted in …” community context:
  - Font: `loopedSubheadlineScaled` (15)
  - Color: `TextSecondaryColor`
  - Bottom padding: `6`

Web (current):
- Avatar placeholder is **44×44** (`h-11 w-11`) and always shown.
- Name uses `text-sm font-semibold`; subtitle `text-xs`.

## Post text

iOS (`postTextSection`):
- Font: `loopedBodyScaled` (Poppins Regular, 16, dynamic type)
- Color: `TextPrimaryColor`
- Hashtags: tinted `PrimaryColor`
- Behavior:
  - Multiline, left aligned
  - Supports hashtag taps via `HashtagText`
  - Supports double-tap-to-like gesture

Web (current):
- `<p className="mt-3 text-sm leading-relaxed text-text-primary">…</p>`

## Attachments / media

iOS (`attachmentsSection`):
- Inserts spacer: `height: 12`
- Media grid: `PostedMediaGrid(maxHeight: 350, …)`

Skeleton:
- Media placeholder (when enabled): `cornerRadius: 14`, `height: 200`

## Engagement row (like/comment/repost/share/save)

iOS (`engagementBar`):
- Layout: `HStack(spacing: 10)` (via `@ScaledMetric engagementBarSpacing = 10`)
- Icon sizes:
  - Like/comment/share/save: `22` (via `@ScaledMetric actionIconSize = 22`)
  - Repost: `24` (via `@ScaledMetric repostIconSize = 24`)
- Label spacing (icon ↔ count): `4` (via `@ScaledMetric actionLabelSpacing = 4`)
- Count font: `loopedSubheadlineScaled` (15)
- Default tint: `TextSecondaryColor`
- Active states:
  - Liked: heart uses `ErrorColor` (red)
  - Reposted: icon uses `PrimaryColor`
  - Saved: icon uses `PrimaryColor`
- Disabled/loading:
  - Disabled buttons reduce opacity to `0.6`
- Reaction lock overlay (when reactions are disabled by permissions):
  - Lock icon: `systemName: "lock.fill"`, font `loopedCustom(.bold, size: 10)`
  - Padding: `3`
  - Background: `Circle().fill(BackgroundColor)`
  - Offset: `(x: 7, y: -7)`

Skeleton (`PostCardSkeleton`):
- Action “pills”:
  - Height: `20`
  - Corner radius: `10`
  - Typical widths: `64`, `64`, `74`, and a trailing `64`
  - Row spacing: `18`

Web (current):
- Action buttons are “pill buttons” with a rounded icon container (`h-7 w-7`) + `text-xs` count.
- Save currently shows a count; iOS main feed card shows only the bookmark icon (no count) in `PostCard.swift`.

## Timestamp row

iOS (`timestampSection`):
- Layout: `HStack { Text(timeAgo); Spacer() }`
- Font: `loopedSubheadlineScaled` (15)
- Color: `TextSecondaryColor`

Skeleton:
- Placeholder: `RoundedRectangle(cornerRadius: 6)` → `84×12`

Web (current):
- `<p className="mt-2 text-xs text-text-light">{post.time}</p>`

## Loading skeleton shimmer

iOS:
- Skeleton surface: `BackgroundColor`
- Uses `.shimmering()` (see `looped-iOS/looped-iOS/Views/Shared/Core/Shimmer.swift`)
  - Highlight opacity: 0.55 (light) / 0.18 (dark)
  - Duration: 1.25s, linear, repeats forever
  - Gradient rotated 18°

Web suggestion:
- Implement skeleton blocks with a subtle neutral fill (`text-text-secondary/10`-ish) and a CSS shimmer that matches iOS timing/angle if parity matters.

## Quick “do this first” parity targets for web

If the web feed is intended to feel like iOS:
- Use **40×40** avatars in feed rows/cards (web currently uses 44×44).
- Use card padding **16** (`p-4`) and internal section gaps **12** (`gap-3`).
- Use the iOS engagement icon sizes (**22/24**) and label spacing (**4**) before fine-tuning typography.
