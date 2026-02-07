# UI + Design System Reference (iOS → Web)

Last updated: 2026-02-07

This doc captures Looped’s **design tokens + UI conventions** as implemented in the iOS SwiftUI app, and how those map onto the web app’s Tailwind v4 theme (`packages/config`). It exists so web agents can build consistent UI without re-scanning `looped-iOS/`.

## Sources of truth

### iOS (canonical token values)
- Typography tokens: `looped-iOS/looped-iOS/Views/Shared/Core/LoopedFonts.swift`
- Color tokens: `looped-iOS/looped-iOS/Views/Shared/Core/LoopedColors.swift`
- Actual color hex values (asset catalog):
  - `looped-iOS/looped-iOS/Assets.xcassets/Colors/*.colorset/Contents.json`

### Web (token implementation)
- Tailwind v4 theme variables: `looped-web/packages/config/src/theme.css`
- Dark-mode overrides: `looped-web/packages/config/src/base.css`
- App-level overrides (note the extra dark overrides): `looped-web/apps/web/app/app.css`

### Representative iOS UI specs to mirror
- Feed tabs + community pills + search field: `looped-iOS/looped-iOS/Views/Shared/Feed/FeedTabs.swift`
- Pill buttons (Follow / Join / etc): `looped-iOS/looped-iOS/Views/Shared/Buttons/FollowPillButtonLabel.swift`
- Post card + skeleton: `looped-iOS/looped-iOS/Views/Shared/Feed/PostCard.swift`, `looped-iOS/looped-iOS/Views/Shared/Feed/PostCardSkeleton.swift`
- Notification list row: `looped-iOS/looped-iOS/Views/Shared/Notifications/NotificationRow.swift`
- Skeleton shimmer behavior: `looped-iOS/looped-iOS/Views/Shared/Core/Shimmer.swift`
- Minimum tap target (HIG): `looped-iOS/looped-iOS/Views/Shared/Core/LoopedTapTarget.swift`

### Representative web UI (existing)
- TikTok-inspired app shell: `looped-web/apps/web/src/app/components/AppLayout/AppLayout.tsx`
- Right-rail search + filter popover: `looped-web/apps/web/src/app/components/AppSearchPanel/AppSearchPanel.tsx`
- Feed post card (placeholder): `looped-web/apps/web/src/app/components/PostCard/PostCard.tsx`

## Typography

### Font family
- **Poppins** is the primary font.
  - iOS uses bundled fonts: `Poppins-Regular`, `Poppins-Medium`, `Poppins-SemiBold`, `Poppins-Bold`, `Poppins-ExtraBold`.
  - Web imports Poppins via Google Fonts in `looped-web/packages/config/src/theme.css` and exposes it as `--font-sans`.

### iOS typography scale (design tokens)
From `LoopedFonts.swift`:

| Token | Weight | Size | Typical use |
|---|---:|---:|---|
| `loopedSmallText` | Regular | 12 | timestamps, microcopy |
| `loopedSmallTextMedium` | Medium | 12 | micro emphasis |
| `loopedSubBodyRegular` | Regular | 14 | secondary body |
| `loopedSubBodyMedium` | Medium | 14 | labels, pills, tabs |
| `loopedSubBodyBold` | Bold | 14 | selected tabs/pills |
| `loopedBody` | Regular | 16 | primary body |
| `loopedBodyMedium` | Medium | 16 | emphasized body |
| `loopedBodyStrong` | SemiBold | 16 | primary buttons |
| `loopedSubheadMedium` | Medium | 20 | section headers |
| `loopedHeadingMedium` | Medium | 24 | screen headers |
| `loopedHeadingMedium28` | Medium | 28 | large headers |
| `loopedHeadingMedium32` | Medium | 32 | large headers |
| `loopedHeaderStrong` | SemiBold | 32 | strong headers |
| `loopedHeading` | Regular | 36 | marketing/display |
| `loopedLargeHeading` | Regular | 52 | marketing/display |
| `loopedSuperLargeHeading` | Regular | 68 | marketing/display |

Also used frequently in feed:
- `loopedHeadlineScaled` (SemiBold 17, Dynamic Type relative to `.headline`)
- `loopedSubheadlineScaled` (Regular 15, relative to `.subheadline`)
- `loopedBodyScaled` (Regular 16, relative to `.body`)

### Web mapping guidance (Tailwind v4)
- Prefer Tailwind semantic sizes where possible:
  - 12 → `text-xs`
  - 14 → `text-sm`
  - 16 → `text-base`
  - 20 → `text-xl`
  - 24 → `text-2xl`
- iOS uses non-default web sizes (15, 17, 22, 28, 32). If parity matters:
  - Use Tailwind arbitrary sizes (e.g. `text-[15px]`) **or** add explicit tokens in `packages/config/src/theme.css` so they’re reusable.

## Color system (iOS asset hex → web theme variables)

Looped uses role-based colors. iOS defines the role names in `LoopedColors.swift` and the actual values in the asset catalog.

### Core tokens

| Role | iOS asset | Light | Dark | Web token |
|---|---|---:|---:|---|
| Brand | `PrimaryColor` | `#EA404A` | `#EA404A` | `--color-brand` |
| Accent / anon accent | `SecondaryColor` | `#15BFB5` | `#15BFB5` | `--color-secondary` |
| Contrast | `ContrastColor` | `#0F0F0F` | `#FFFFFF` | `--color-contrast` |
| Background | `BackgroundColor` | `#FFFFFF` | `#0F0F0F` | `--color-bg` |
| Muted bg | `MutedBackground` | `#F3F4F6` | `#333333` | `--color-bg-muted` |
| Text primary | `TextPrimaryColor` | `#1F2937` | `#E5E7EB` | `--color-text-primary` |
| Text secondary | `TextSecondaryColor` | `#6B7280` | `#9CA3AF` | `--color-text-secondary` |
| Text strong | `StrongText` | `#111827` | `#E5E7EB` | `--color-strong` |
| Message | `MessageColor` | `#ACF6F2` | `#0D7C75` | `--color-message` |
| Message muted | `MessageColorMuted` | `#EEF2F7` | `#1A1A1A` | `--color-message-muted` *(web differs today)* |
| Error | `ErrorColor` | `#D92D20` | `#FF5A5F` | *(not currently a web token)* |
| Success | `SuccessColor` | `#12B76A` | `#22C55E` | *(not currently a web token)* |

Notes:
- iOS anonymous mode commonly uses **secondary** as the accent (see `Color.loopedAccent(isAnonymousMode:)`), e.g. author name tint on anon posts.
- Web currently sets `--color-message-muted: #fafafa` (light) in `packages/config/src/theme.css`, while iOS uses `#EEF2F7`.

### Web-only “app shell” tokens (TikTok-style background)
Defined in `looped-web/packages/config/src/theme.css`:
- `--color-shell-bg: #0b0b0b`
- `--color-shell-surface: #141414`
- `--color-shell-surface-muted: #1f1f1f`
- `--color-shell-border: rgba(255, 255, 255, 0.14)`
- `--color-shell-text: #f9fafb`
- `--color-shell-text-muted: #9ca3af`

These are used for the left nav and right rail; the center “device frame” uses `--color-bg` etc.

## Dark mode

### Web implementation
- Dark mode is driven by `data-theme="dark"` on `<html>` (set early in `looped-web/apps/web/app/root.tsx` via `localStorage['looped-theme']`).
- The base override lives in `looped-web/packages/config/src/base.css` and swaps `--color-*` variables to their `--color-*-dark` counterparts.

### App-level overrides
`looped-web/apps/web/app/app.css` additionally overrides:
- `--color-border`
- `--color-text-secondary`
when `[data-theme="dark"]` is set. Keep this in mind when debugging “why does dark look different here?”.

## Spacing scale (what iOS uses most)

iOS largely follows a 4pt grid, with these values most common in `Views/Shared`:
- **16** (most common): screen gutters, card padding
- **12**: row vertical padding, section gaps
- **8**: compact padding/gaps, pills
- **6 / 10 / 14 / 20 / 24**: smaller/larger variants

Tailwind mapping (defaults):
- 4 → `1` (`p-1`, `gap-1`)
- 6 → `1.5` (`p-1.5`, `gap-1.5`)
- 8 → `2`
- 10 → `2.5`
- 12 → `3`
- 14 → `3.5`
- 16 → `4`
- 20 → `5`
- 24 → `6`
- 32 → `8`
- 44 (tap target) → `11` (e.g. `min-h-11 min-w-11`)

Common iOS patterns to mirror:
- List row: `padding(.horizontal, 16)` + `padding(.vertical, 12)` (e.g. `NotificationRow`, `ConversationRowSkeleton`)
- Card: `padding(16)` + `background(.loopedBackground)` (e.g. `PostCard`, `TrendingPostCommentsLoaderView`)
- Avatar-content gap: `spacing: 12` (most rows/cards)

## Corner radii

Most used radii in iOS shared UI:
- **12**: cards/surfaces (common)
- **20**: pills/segmented controls
- **22**: search field capsule
- **8**: small preview bubbles
- **6**: skeleton line blocks
- **14**: media placeholders / toasts

Web mapping:
- Use Tailwind presets where they match (`rounded-xl` ≈ 12, `rounded-full` for capsules).
- For iOS-specific values like 20/22/14, use `rounded-[20px]` / `rounded-[22px]` / `rounded-[14px]` or add a shared token if used widely.

## Borders & separators

iOS frequently uses:
- Separator line: `Color.loopedTextSecondary.opacity(0.1)` at height 1
- Input stroke: `Color.loopedTextSecondary.opacity(0.2)` at 1px

Web equivalents:
- `border-border/70` or `bg-border/50` for subtle separators (exact alpha may vary)
- Avoid hard-coded RGBA in components; prefer theme tokens + opacity utilities.

## Tap targets (accessibility)

iOS explicitly enforces:
- Minimum 44×44pt tap targets for icon-only controls (`loopedTapTarget(minSize: 44)`).

Web guidance:
- For icon-only buttons, ensure `min-h-11 min-w-11` (44px) and a visible focus ring.

## Loading skeletons + shimmer

iOS shimmer implementation (`Shimmer.swift`):
- Highlight opacity: **0.55 (light)** / **0.18 (dark)**
- Rotation: **18°**
- Animation: linear **1.25s**, repeats forever
- Phase offset: -0.8 → 0.8 across the element width

Skeleton shapes:
- Use muted neutral fills (often `TextSecondaryColor` with 0.10–0.18 opacity or `MutedBackground`).
- Use smaller radii for text blocks (6), larger for media (12–14).

See:
- `looped-iOS/looped-iOS/Views/Shared/Feed/PostCardSkeleton.swift`
- `looped-iOS/looped-iOS/Views/Shared/Messages/ConversationRowSkeleton.swift`

## Pill buttons (Follow/Join/etc.)

iOS pill button spec (`FollowPillButtonLabel.swift`):
- Shape: `Capsule()`
- Sizes:
  - Regular: `minHeight 44`, `px 32`, `py 12`, font `loopedBodyStrong` (16 semibold)
  - Profile: `minHeight 40`, `px 22`, `py 10`, font `loopedSubBodyMedium` (14 medium)
  - Compact: `minHeight 36`, `px 16`, `py 8`, font `loopedSubBodyMedium` (14 medium)
- Variants:
  - Primary: bg `PrimaryColor`, text `White`
  - Secondary: bg `SecondaryColor`, text `White`
  - Muted: bg `MutedBackground`, text `TextPrimaryColor`

## Feed tabs + filter pills (iOS spec)

From `looped-iOS/looped-iOS/Views/Shared/Feed/FeedTabs.swift`:

### Top feed tabs (For You / Latest / Following)
- Container padding: `horizontal 16`
- Tab label:
  - Selected: `loopedSubBodyBold` (14 bold), color `PrimaryColor`
  - Unselected: `loopedSubBodyMedium` (14 medium), color `TextSecondaryColor`
  - Bottom padding: `12`
- Underline:
  - Full-width segmented underline row
  - Selected segment height: `2` (color `PrimaryColor`)
  - Unselected segment height: `1` (color `TextSecondaryColor` at ~30% opacity)

### Community “pill” filters (horizontal scroll)
- Row:
  - `HStack(spacing: 18)`
  - Scroll container height: `32`, vertical padding: `8`
  - Horizontal padding: `12`
- Search icon button:
  - Size: `34×34`
  - Tint: `SecondaryColor`
- Pills (All Loops + communities):
  - Font: selected `loopedSubBodyBold` (14 bold), else `loopedSubBodyMedium` (14 medium)
  - Text color: selected `White`, else `TextSecondaryColor`
  - Padding: `horizontal 8`, `vertical 8`
  - Background: selected `PrimaryColor`, else `TextSecondaryColor` at ~10% opacity
  - Corner radius: `20`

### Community search field (when searching)
- Search input container:
  - Padding: `horizontal 16`, `vertical 10`
  - Background: `MutedBackground`
  - Stroke: `TextSecondaryColor` at ~20% opacity, width 1
  - Corner radius: `22`
- Search icon size: `18×18` (tint `TextSecondaryColor`)
- Clear icon size: ~`16` (system symbol)
- Results surface:
  - Corner radius: `12`
  - Stroke: `TextSecondaryColor` at ~12% opacity
  - Result row padding: `horizontal 16`, `vertical 12`
  - Separator: 1px line, `TextSecondaryColor` at ~10% opacity

## List rows (notifications/messages)

These patterns show up repeatedly in iOS list UIs.

### Notification row baseline
From `looped-iOS/looped-iOS/Views/Shared/Notifications/NotificationRow.swift`:
- Row padding: `horizontal 16`, `vertical 12`
- Avatar: **40×40**, circular
- Avatar/content spacing: `12`
- Primary text: `loopedSubBodyMedium` / `loopedSubBodyRegular` (14)
- Timestamp: `loopedSmallText` (12), `TextSecondaryColor`
- Preview bubble (when present):
  - Padding: `horizontal 12`, `vertical 6`
  - Background: `MutedBackground`
  - Corner radius: `8`

## Avatars (standard vs anonymous)

From `looped-iOS/looped-iOS/Views/Shared/Core/ProfileAvatarView.swift`:
- Shape: circle
- Default/fallback avatar:
  - Standard: `PrimaryColor` fill + person icon
  - Anonymous: `SecondaryColor` fill + person icon (or `profile-pic-anon` image asset if present)

## Web app shell layout (current)

The current web “TikTok-inspired” layout lives in `AppLayout.tsx`:
- Page wrapper: `bg-shell-bg`, centered content `max-w-[1440px]`
- Desktop grid:
  - Left nav: `260px` (hidden below `lg`)
  - Center frame: `max-w-[560px]`, `bg-bg`, subtle ring + heavy shadow, `sm:rounded-[34px]`
  - Right rail: `380px` (hidden below `xl`)

If/when changing layout to match Figma precisely, treat `AppLayout.tsx` as the single place to centralize the shell behavior.

## Iconography (iOS parity)

iOS tab icon names (from `CustomTabBar.swift`):
- Home: `home-icon` / `home-selected`
- Messages: `messages-icon` / `messages-selected`
- Search: `search-icon` / `search-selected`
- Notifications: `notifications-icon` / `bell-selected`
- Profile: `profile-icon` / `profile-selected`

Web currently uses exported SVGs in:
- `looped-web/apps/web/public/ios-icons/*`

## Parity checklist (web vs iOS)

If you’re aiming for “feels like iOS” parity on web:
- Align avatar sizes (40 is the iOS “standard” for rows/cards; web currently uses 44 in `PostCard.tsx`).
- Consider adding theme tokens for `error` and `success` colors (present in iOS assets; not exposed in web theme today).
- Decide whether `MessageColorMuted` should match iOS (`#EEF2F7`) or remain a web-specific value.
