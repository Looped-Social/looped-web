import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { NotificationsApiError, fetchNotifications, markNotificationRead } from "@/lib/notificationsApi";
import { fetchUserFollowing, fetchUserMe, fetchUserProfile, setUserFollowing } from "@/lib/userApi";

type NotificationType =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "post_from_followed"
  | "message_request"
  | "announcement"
  | "system"
  | "loopInvite"
  | "groupInvite"
  | "repost";

type NotificationView = {
  id: string;
  rawType: string;
  type: NotificationType;
  createdAt: string;
  unread: boolean;
  actorName: string;
  actorUserId?: string;
  actorAnonProfileId?: string;
  actorProfileImageUrl?: string;
  postId?: string;
  commentId?: string;
  deeplinkRoute?: string;
  actionDeeplinkRoute?: string;
  payloadTitle?: string;
  payloadBody?: string;
  payloadContext?: string;
  category?: string;
  kind?: string;
  verificationStatus?: string;
  verificationMethod?: string;
  companyId?: string;
  communityId?: string;
  communityName?: string;
  expiresAt?: string;
  daysRemaining?: number;
  eventKey?: string;
  years?: number;
};

type NotificationPresentation = {
  title: string;
  description: string;
};

type NotificationTapAction =
  | {
      kind: "navigate";
      href: string;
    }
  | {
      kind: "system_detail";
    }
  | {
      kind: "unavailable";
      message: string;
      tone: "info" | "error";
    };

type ActorProfilePreview = {
  name?: string;
  avatarUrl?: string;
};

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

const POST_TARGET_NOTIFICATION_TYPES = new Set<NotificationType>([
  "like",
  "comment",
  "reply",
  "mention",
  "repost",
]);

const VERIFICATION_KINDS = new Set(["community_verification", "user_verification"]);

const NOTIFICATION_TYPE_BY_COMPACT_KEY: Record<string, NotificationType> = {
  like: "like",
  comment: "comment",
  reply: "reply",
  mention: "mention",
  follow: "follow",
  postfromfollowed: "post_from_followed",
  messagerequest: "message_request",
  announcement: "announcement",
  system: "system",
  loopinvite: "loopInvite",
  groupinvite: "groupInvite",
  repost: "repost",
};

function handleProfileImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE_SRC;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const compact = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return compact.length ? compact : undefined;
}

function asDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function formatTimeAgo(value: string): string {
  const date = asDate(value);
  if (!date) return "";

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(deltaSeconds, "second");
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 4) return rtf.format(weeks, "week");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  const years = Math.round(days / 365);
  return rtf.format(years, "year");
}

function extractPayload(item: Record<string, unknown>): Record<string, unknown> {
  const payload = item.payload;
  if (isRecord(payload)) return payload;
  return {};
}

function routeToPost(postId: string, commentId?: string): string {
  const base = `/app/post/${encodeURIComponent(postId)}/comments`;
  if (!commentId) return base;
  return `${base}?commentId=${encodeURIComponent(commentId)}`;
}

function safePathSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^\/+|\/+$/g, "");
}

function resolveRouteFromLoopedPath(path: string, searchParams?: URLSearchParams): string | undefined {
  const normalizedPath = path.replace(/^\/+/, "");
  if (!normalizedPath) return undefined;

  const segments = normalizedPath.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return undefined;

  const [first, second] = segments;

  if (first === "app") {
    return `/${segments.join("/")}`;
  }

  if (first === "post" && second) {
    return routeToPost(second);
  }

  if (first === "comment" && second) {
    const postId = safePathSegment(searchParams?.get("post_id") ?? undefined);
    if (!postId) return "/app/notifications";
    return routeToPost(postId, second);
  }

  if (first === "user" && second) {
    const anonParam = (searchParams?.get("anon") ?? "").toLowerCase();
    if (anonParam === "true" || anonParam === "1") {
      return `/app/profile/anon/${encodeURIComponent(second)}`;
    }
    return `/app/profile/${encodeURIComponent(second)}`;
  }

  if (first === "conversations" && second) {
    return `/app/messages/conversation/${encodeURIComponent(second)}`;
  }

  if (first === "channels" && second) {
    return `/app/messages/channel/${encodeURIComponent(second)}`;
  }

  if (first === "announcement") {
    return "/app/notifications";
  }

  if (first === "notifications") return "/app/notifications";
  if (first === "messages") return "/app/messages";
  if (first === "settings") return "/app/settings";
  if (first === "profiles" && segments[1] === "anon" && segments[2]) {
    return `/app/profile/anon/${encodeURIComponent(segments[2])}`;
  }
  if ((first === "profiles" || first === "users") && second) {
    return `/app/profile/${encodeURIComponent(second)}`;
  }

  return undefined;
}

function resolveRouteFromDeeplink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("looped://")) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname;
      const path = parsed.pathname.replace(/^\/+/, "");
      const combined = [host, path].filter(Boolean).join("/");
      return resolveRouteFromLoopedPath(combined, parsed.searchParams);
    } catch {
      const fallbackPath = trimmed.slice("looped://".length);
      return resolveRouteFromLoopedPath(fallbackPath);
    }
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("/app")) return trimmed;
    if (trimmed.startsWith("/p/")) {
      const postId = safePathSegment(trimmed.replace(/^\/p\//, ""));
      return postId ? routeToPost(postId) : undefined;
    }
    if (trimmed.startsWith("/u/")) {
      const slug = safePathSegment(trimmed.replace(/^\/u\//, ""));
      return slug ? `/u/${encodeURIComponent(slug)}` : undefined;
    }
    return resolveRouteFromLoopedPath(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/app")) {
      const suffix = parsed.search ? `${parsed.pathname}${parsed.search}` : parsed.pathname;
      return suffix;
    }

    if (parsed.pathname.startsWith("/p/")) {
      const postId = safePathSegment(parsed.pathname.replace(/^\/p\//, ""));
      return postId ? routeToPost(postId) : undefined;
    }

    if (parsed.pathname.startsWith("/u/")) {
      const slug = safePathSegment(parsed.pathname.replace(/^\/u\//, ""));
      return slug ? `/u/${encodeURIComponent(slug)}` : undefined;
    }

    return resolveRouteFromLoopedPath(parsed.pathname, parsed.searchParams);
  } catch {
    return undefined;
  }
}

function normalizeNotificationType(value: string): NotificationType {
  const compact = value
    .trim()
    .replace(/[_\s-]/g, "")
    .toLowerCase();
  if (!compact) return "system";
  return NOTIFICATION_TYPE_BY_COMPACT_KEY[compact] ?? "system";
}

function resolveActorAnonId(payload: Record<string, unknown>, actor?: Record<string, unknown>): string | undefined {
  return (
    pickString(payload, ["actor_anon_profile_id", "actorAnonProfileId", "anon_profile_id", "anonProfileId"]) ??
    (actor ? pickString(actor, ["anon_profile_id", "anonProfileId", "id"]) : undefined)
  );
}

function resolveActorUserId(payload: Record<string, unknown>, actor?: Record<string, unknown>): string | undefined {
  return (
    pickString(payload, ["actor_user_id", "actorUserId", "user_id", "userId"]) ??
    (actor ? pickString(actor, ["user_id", "userId", "id"]) : undefined)
  );
}

function resolveActorName(payload: Record<string, unknown>): string {
  const actor = isRecord(payload.actor) ? payload.actor : null;

  const displayName =
    normalizeOptional(payload.actor_display_name) ??
    normalizeOptional(payload.actorDisplayName) ??
    normalizeOptional(payload.actor_name) ??
    normalizeOptional(payload.actorName) ??
    (actor
      ? normalizeOptional(actor.display_name ?? actor.displayName ?? actor.name)
      : undefined);
  if (displayName) return displayName;

  const handle =
    normalizeOptional(payload.actor_handle) ??
    normalizeOptional(payload.actorHandle) ??
    (actor ? normalizeOptional(actor.handle ?? actor.username) : undefined);
  if (handle) return handle.startsWith("@") ? handle : `@${handle}`;

  if (resolveActorAnonId(payload, actor ?? undefined)) return "Anonymous";
  return "Someone";
}

function isVerificationNotification(notification: NotificationView): boolean {
  if (notification.category === "verification") return true;
  if (!notification.kind) return false;
  return VERIFICATION_KINDS.has(notification.kind);
}

function resolveVerificationDaysRemaining(notification: NotificationView): number | undefined {
  if (typeof notification.daysRemaining === "number" && Number.isFinite(notification.daysRemaining)) {
    return Math.max(0, Math.floor(notification.daysRemaining));
  }
  const expiresDate = asDate(notification.expiresAt);
  if (!expiresDate) return undefined;
  const diffMs = expiresDate.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 86_400_000);
}

function resolveVerificationPresentation(notification: NotificationView): NotificationPresentation | null {
  if (!isVerificationNotification(notification)) return null;

  const payloadTitle = notification.payloadTitle;
  const payloadBody = notification.payloadBody;
  const status = notification.verificationStatus;
  const communityName = notification.communityName;
  const daysRemaining = resolveVerificationDaysRemaining(notification);

  if (status === "approved") {
    return {
      title: payloadTitle ?? "Verification approved",
      description:
        payloadBody ??
        (communityName
          ? `You're verified in ${communityName}.`
          : "Your verification was approved."),
    };
  }

  if (status === "rejected") {
    return {
      title: payloadTitle ?? "Verification rejected",
      description: payloadBody ?? "Your verification request was rejected.",
    };
  }

  if (status === "expiring") {
    const expirationCopy =
      typeof daysRemaining === "number"
        ? `Your verification expires in ${Math.max(0, Math.floor(daysRemaining))} day${Math.floor(daysRemaining) === 1 ? "" : "s"}.`
        : "Your verification is expiring soon.";

    return {
      title: payloadTitle ?? "Verification expiring soon",
      description: payloadBody ?? expirationCopy,
    };
  }

  if (status === "expired") {
    return {
      title: payloadTitle ?? "Verification expired",
      description: payloadBody ?? "Your verification has expired. Re-verify in the iOS app.",
    };
  }

  return {
    title: payloadTitle ?? "Verification update",
    description: payloadBody ?? "Review your verification status.",
  };
}

function buildNotificationTitle(notification: NotificationView, actorName: string): string {
  switch (notification.type) {
    case "follow":
      return `${actorName} followed you`;
    case "like":
      return `${actorName} liked your post`;
    case "comment":
      return `${actorName} commented on your post`;
    case "reply":
      return `${actorName} replied to your comment`;
    case "mention":
      return `${actorName} mentioned you`;
    case "repost":
      return `${actorName} reposted your post`;
    case "post_from_followed":
      return `${actorName} posted something new`;
    case "message_request":
      return `${actorName} sent a message request`;
    case "loopInvite":
      return "Loop invite";
    case "groupInvite":
      return "Group invite";
    case "announcement":
      return "Announcement";
    case "system":
      return "System update";
    default:
      return "System update";
  }
}

function buildNotificationDescription(notification: NotificationView): string {
  const directMessage =
    notification.payloadBody ??
    notification.payloadContext;
  if (directMessage) return directMessage;

  if (notification.type === "announcement" && typeof notification.years === "number") {
    const roundedYears = Math.max(0, Math.floor(notification.years));
    if (roundedYears > 0) {
      return `Celebrating ${roundedYears} year${roundedYears === 1 ? "" : "s"}.`;
    }
  }

  if (POST_TARGET_NOTIFICATION_TYPES.has(notification.type) || notification.type === "post_from_followed") {
    return "Tap to view post.";
  }
  if (notification.type === "follow") return "Tap to view profile.";
  if (notification.type === "message_request") {
    return "Tap to open messages.";
  }
  if (notification.type === "loopInvite" || notification.type === "groupInvite") return "Tap to open invite.";
  if (notification.type === "announcement" || notification.type === "system") return "Tap to view details.";

  return "Tap to open.";
}

function resolveNotificationPresentation(notification: NotificationView, actorName: string): NotificationPresentation {
  const verification = resolveVerificationPresentation(notification);
  if (verification) return verification;

  return {
    title: notification.payloadTitle ?? buildNotificationTitle(notification, actorName),
    description: buildNotificationDescription(notification),
  };
}

function resolveNotificationTapAction(notification: NotificationView): NotificationTapAction {
  if (POST_TARGET_NOTIFICATION_TYPES.has(notification.type)) {
    if (notification.postId) {
      const commentId = notification.type === "comment" || notification.type === "reply"
        ? notification.commentId
        : undefined;
      return { kind: "navigate", href: routeToPost(notification.postId, commentId) };
    }
    if (notification.deeplinkRoute) return { kind: "navigate", href: notification.deeplinkRoute };
    if (notification.actionDeeplinkRoute) return { kind: "navigate", href: notification.actionDeeplinkRoute };
    return { kind: "unavailable", message: "This post isn't available right now.", tone: "error" };
  }

  if (notification.type === "follow") {
    if (notification.actorUserId) {
      return { kind: "navigate", href: `/app/profile/${encodeURIComponent(notification.actorUserId)}` };
    }
    if (notification.actorAnonProfileId) {
      return { kind: "navigate", href: `/app/profile/anon/${encodeURIComponent(notification.actorAnonProfileId)}` };
    }
    if (notification.deeplinkRoute) return { kind: "navigate", href: notification.deeplinkRoute };
    if (notification.actionDeeplinkRoute) return { kind: "navigate", href: notification.actionDeeplinkRoute };
    return { kind: "unavailable", message: "This profile isn't available right now.", tone: "error" };
  }

  if (notification.type === "post_from_followed") {
    if (notification.postId) return { kind: "navigate", href: routeToPost(notification.postId) };
    if (notification.deeplinkRoute) return { kind: "navigate", href: notification.deeplinkRoute };
    if (notification.actionDeeplinkRoute) return { kind: "navigate", href: notification.actionDeeplinkRoute };
    return { kind: "unavailable", message: "This post isn't available right now.", tone: "error" };
  }

  if (notification.type === "message_request") {
    if (notification.deeplinkRoute) return { kind: "navigate", href: notification.deeplinkRoute };
    if (notification.actionDeeplinkRoute) return { kind: "navigate", href: notification.actionDeeplinkRoute };
    return { kind: "unavailable", message: "This destination isn't available yet.", tone: "info" };
  }

  if (notification.type === "announcement" || notification.type === "system") {
    return { kind: "system_detail" };
  }

  if (notification.deeplinkRoute) return { kind: "navigate", href: notification.deeplinkRoute };
  if (notification.actionDeeplinkRoute) return { kind: "navigate", href: notification.actionDeeplinkRoute };

  return { kind: "unavailable", message: "This notification isn't available right now.", tone: "error" };
}

function parseUserProfilePreview(payload: unknown): ActorProfilePreview {
  if (!isRecord(payload)) return {};

  const firstName = pickString(payload, ["first_name", "firstName"]);
  const lastName = pickString(payload, ["last_name", "lastName"]);
  const fullName = [normalizeOptional(firstName), normalizeOptional(lastName)]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const fallbackName =
    normalizeOptional(payload.display_name ?? payload.displayName ?? payload.name) ??
    normalizeOptional(payload.handle ?? payload.username);

  return {
    name: fullName || fallbackName,
    avatarUrl: pickString(payload, ["profile_image_url", "profileImageUrl"]),
  };
}

function resolveFollowingUserId(entry: Record<string, unknown>): string | undefined {
  const directId = pickString(entry, ["id", "user_id", "userId"]);
  if (directId) return directId;
  if (isRecord(entry.user)) {
    return pickString(entry.user, ["id", "user_id", "userId"]);
  }
  return undefined;
}

function resolveCurrentUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function normalizeNotification(item: unknown): NotificationView | null {
  if (!isRecord(item)) return null;

  const id = pickString(item, ["id", "notification_id", "notificationId"]);
  if (!id) return null;

  const payload = extractPayload(item);
  const payloadActor = isRecord(payload.actor) ? payload.actor : undefined;
  const topLevelActor = isRecord(item.actor) ? item.actor : undefined;
  const actor = payloadActor ?? topLevelActor;
  const actorLookup: Record<string, unknown> = { ...item, ...payload, ...(actor ? { actor } : {}) };

  const rawType = pickString(item, ["type"]) ?? pickString(payload, ["type"]) ?? "system";
  const type = normalizeNotificationType(rawType);

  const createdDate =
    asDate(item.created_at ?? item.createdAt ?? item.timestamp ?? item.time) ??
    asDate(payload.created_at ?? payload.createdAt ?? payload.timestamp ?? payload.time) ??
    new Date();

  const read = getBoolean(item.read);
  const unread = getBoolean(item.unread) ?? (read !== undefined ? !read : false);

  const actorName = resolveActorName(actorLookup);
  const actorUserId = resolveActorUserId(actorLookup, actor);
  const actorAnonProfileId = resolveActorAnonId(actorLookup, actor);
  const actorProfileImageUrl =
    pickString(actorLookup, [
      "actor_profile_image_url",
      "actorProfileImageUrl",
      "actor_avatar_url",
      "actorAvatarUrl",
      "actor_image_url",
      "actorImageUrl",
    ]) ??
    (actor
      ? pickString(actor, ["profile_image_url", "profileImageUrl", "avatar_url", "avatarUrl", "image_url", "imageUrl"])
      : undefined);

  const postId = pickString(actorLookup, ["post_id", "postId"]);
  const commentId = pickString(actorLookup, ["comment_id", "commentId"]);

  const deeplinkValue = pickString(actorLookup, ["deeplink", "deep_link", "deepLink"]);
  const actionDeeplinkValue =
    pickString(actorLookup, ["action_deeplink", "actionDeeplink", "action_deep_link", "actionDeepLink"]) ??
    deeplinkValue;
  const deeplinkRoute = resolveRouteFromDeeplink(deeplinkValue);
  const actionDeeplinkRoute = resolveRouteFromDeeplink(actionDeeplinkValue);

  return {
    id,
    rawType,
    type,
    createdAt: createdDate.toISOString(),
    unread,
    actorName,
    actorUserId,
    actorAnonProfileId,
    actorProfileImageUrl,
    postId,
    commentId,
    deeplinkRoute,
    actionDeeplinkRoute,
    payloadTitle: normalizeOptional(actorLookup.title),
    payloadBody:
      normalizeOptional(actorLookup.body) ??
      normalizeOptional(actorLookup.message) ??
      normalizeOptional(actorLookup.text),
    payloadContext: normalizeOptional(actorLookup.context),
    category: normalizeOptional(payload.category ?? payload.notification_category ?? actorLookup.category)?.toLowerCase(),
    kind: normalizeOptional(payload.kind ?? payload.notification_kind ?? actorLookup.kind)?.toLowerCase(),
    verificationStatus: normalizeOptional(payload.status ?? payload.verification_status ?? actorLookup.status)?.toLowerCase(),
    verificationMethod: normalizeOptional(payload.method ?? payload.verification_method ?? actorLookup.method)?.toLowerCase(),
    companyId: pickString(actorLookup, ["company_id", "companyId"]),
    communityId: pickString(actorLookup, ["community_id", "communityId"]),
    communityName: normalizeOptional(payload.community_name ?? payload.communityName ?? actorLookup.community_name ?? actorLookup.communityName),
    expiresAt: normalizeOptional(payload.expires_at ?? payload.expiresAt ?? actorLookup.expires_at ?? actorLookup.expiresAt),
    daysRemaining: getNumber(payload.days_remaining ?? payload.daysRemaining ?? actorLookup.days_remaining ?? actorLookup.daysRemaining),
    eventKey: normalizeOptional(payload.event_key ?? payload.eventKey ?? actorLookup.event_key ?? actorLookup.eventKey),
    years: getNumber(actorLookup.years),
  };
}

function sortByNewest(items: NotificationView[]): NotificationView[] {
  return [...items].sort((left, right) => {
    const leftTs = asDate(left.createdAt)?.getTime() ?? 0;
    const rightTs = asDate(right.createdAt)?.getTime() ?? 0;
    return rightTs - leftTs;
  });
}

function mergeById(existing: NotificationView[], incoming: NotificationView[]): NotificationView[] {
  const byId = new Map<string, NotificationView>();

  for (const item of existing) {
    byId.set(item.id, item);
  }

  for (const item of incoming) {
    const previous = byId.get(item.id);
    if (!previous) {
      byId.set(item.id, item);
      continue;
    }

    byId.set(item.id, {
      ...previous,
      ...item,
      actorName:
        item.actorName !== "Someone"
          ? item.actorName
          : previous.actorName,
      actorProfileImageUrl: item.actorProfileImageUrl ?? previous.actorProfileImageUrl,
      unread: previous.unread ? item.unread : false,
    });
  }

  return sortByNewest(Array.from(byId.values()));
}

function parseApiError(error: unknown): { status?: number; code?: string; message: string } {
  if (error instanceof NotificationsApiError) {
    const raw = error.details?.trim();
    if (!raw) return { status: error.status, message: error.message };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const code = normalizeOptional(parsed.error);
        const message = normalizeOptional(parsed.message) ?? raw;
        return { status: error.status, code, message };
      }
    } catch {
      return { status: error.status, message: raw };
    }
    return { status: error.status, message: raw };
  }

  if (error instanceof Error) return { message: error.message };
  return { message: "Something went wrong." };
}

function SkeletonNotificationRow() {
  return (
    <div className="animate-pulse px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-bg-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-1/2 rounded-full bg-bg-muted" aria-hidden="true" />
          <div className="h-3 w-3/4 rounded-full bg-bg-muted" aria-hidden="true" />
          <div className="h-3 w-1/5 rounded-full bg-bg-muted" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function AppNotificationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [items, setItems] = useState<NotificationView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loading-more" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedSystemNotification, setSelectedSystemNotification] = useState<NotificationView | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingUserIds, setFollowingUserIds] = useState<Record<string, true>>({});
  const [followUpdatingIds, setFollowUpdatingIds] = useState<string[]>([]);

  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfilePreview>>({});
  const [loadingActorIds, setLoadingActorIds] = useState<string[]>([]);

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);

  const loadNotifications = useCallback(
    async ({ cursor, replace, poll }: { cursor?: string; replace: boolean; poll?: boolean }) => {
      if (!poll) {
        setStatus(cursor ? "loading-more" : "loading");
      }
      setError(null);

      try {
        const response = await fetchNotifications({ limit: cursor ? 20 : 50, cursor });
        const normalized = (response.items ?? [])
          .map(normalizeNotification)
          .filter((notification): notification is NotificationView => Boolean(notification));

        setItems((previous) => {
          if (replace) return sortByNewest(normalized);
          if (cursor) return sortByNewest([...previous, ...normalized]);
          return mergeById(previous, normalized);
        });

        setNextCursor(response.next_cursor ?? response.nextCursor ?? null);
        if (!poll) {
          setStatus("idle");
        }
      } catch (loadError) {
        const parsed = parseApiError(loadError);
        const message =
          parsed.code === "user_not_provisioned"
            ? "Complete onboarding in the iOS app to receive notifications."
            : parsed.message;
        setError(message);
        if (!poll) {
          setStatus("error");
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadNotifications({ replace: true });
  }, [loadNotifications]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNotifications({ replace: false, poll: true });
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const meResponse = await fetchUserMe();
        const viewerId = resolveCurrentUserId(meResponse);
        if (!active || !viewerId) return;
        setCurrentUserId(viewerId);

        const followingMap: Record<string, true> = {};
        let cursor: string | undefined;
        let pages = 0;
        do {
          const response = await fetchUserFollowing({
            userId: viewerId,
            limit: 100,
            cursor,
          });

          const list = Array.isArray(response.items) ? response.items : [];
          for (const entry of list) {
            if (!isRecord(entry)) continue;
            const id = resolveFollowingUserId(entry);
            if (id) followingMap[id] = true;
          }

          cursor = response.next_cursor ?? response.nextCursor ?? undefined;
          pages += 1;
        } while (cursor && pages < 5);

        if (!active) return;
        setFollowingUserIds(followingMap);
      } catch {
        // ignore follow-state bootstrap failures
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadingSet = new Set(loadingActorIds);
    const actorIdsToLoad = Array.from(
      new Set(
        items
          .map((item) => item.actorUserId)
          .filter((id): id is string => Boolean(id))
          .filter((id) => !actorProfiles[id] && !loadingSet.has(id))
      )
    );

    if (!actorIdsToLoad.length) return;

    setLoadingActorIds((previous) => [...previous, ...actorIdsToLoad]);
    let active = true;

    void Promise.all(
      actorIdsToLoad.map(async (actorUserId) => {
        try {
          const profile = await fetchUserProfile(actorUserId);
          return { actorUserId, preview: parseUserProfilePreview(profile) };
        } catch {
          return { actorUserId, preview: {} as ActorProfilePreview };
        }
      })
    ).then((results) => {
      if (!active) return;
      setActorProfiles((previous) => {
        const next = { ...previous };
        for (const result of results) {
          next[result.actorUserId] = result.preview;
        }
        return next;
      });
      setLoadingActorIds((previous) =>
        previous.filter((id) => !actorIdsToLoad.includes(id))
      );
    });

    return () => {
      active = false;
    };
  }, [actorProfiles, items, loadingActorIds]);

  const handleNotificationTap = useCallback(
    (notification: NotificationView) => {
      if (notification.unread) {
        setItems((previous) =>
          previous.map((item) =>
            item.id === notification.id ? { ...item, unread: false } : item
          )
        );

        void markNotificationRead(notification.id).catch((markError) => {
          setItems((previous) =>
            previous.map((item) =>
              item.id === notification.id ? { ...item, unread: true } : item
            )
          );
          const parsed = parseApiError(markError);
          showToast({
            title: "Couldn't mark notification as read",
            message: parsed.message,
            tone: "error",
          });
        });
      }

      const action = resolveNotificationTapAction(notification);
      if (action.kind === "navigate") {
        navigate(action.href);
        return;
      }

      if (action.kind === "system_detail") {
        setSelectedSystemNotification(notification);
        return;
      }

      showToast({
        title: "Notification unavailable",
        message: action.message,
        tone: action.tone,
      });
    },
    [navigate, showToast]
  );

  const handleMarkAll = useCallback(async () => {
    const unreadIds = items.filter((item) => item.unread).map((item) => item.id);
    if (!unreadIds.length) return;

    setItems((previous) => previous.map((item) => ({ ...item, unread: false })));

    const results = await Promise.allSettled(
      unreadIds.map((notificationId) => markNotificationRead(notificationId))
    );

    const failedIds = results
      .map((result, index) => ({ result, notificationId: unreadIds[index] }))
      .filter((entry) => entry.result.status === "rejected")
      .map((entry) => entry.notificationId);

    if (failedIds.length) {
      const failedSet = new Set(failedIds);
      setItems((previous) =>
        previous.map((item) =>
          failedSet.has(item.id) ? { ...item, unread: true } : item
        )
      );
      showToast({
        title: "Some notifications were not marked read",
        message: "Please try again.",
        tone: "error",
      });
    }
  }, [items, showToast]);

  const handleFollowToggle = useCallback(
    async (event: MouseEvent<HTMLButtonElement>, actorUserId: string) => {
      event.stopPropagation();

      const currentlyFollowing = Boolean(followingUserIds[actorUserId]);
      const nextFollowing = !currentlyFollowing;
      setFollowUpdatingIds((previous) =>
        previous.includes(actorUserId) ? previous : [...previous, actorUserId]
      );
      setFollowingUserIds((previous) => {
        if (nextFollowing) return { ...previous, [actorUserId]: true };
        const next = { ...previous };
        delete next[actorUserId];
        return next;
      });

      try {
        const response = await setUserFollowing(actorUserId, nextFollowing);
        setFollowingUserIds((previous) => {
          const next = { ...previous };
          if (response.following) {
            next[actorUserId] = true;
          } else {
            delete next[actorUserId];
          }
          return next;
        });
      } catch (followError) {
        setFollowingUserIds((previous) => {
          const next = { ...previous };
          if (currentlyFollowing) {
            next[actorUserId] = true;
          } else {
            delete next[actorUserId];
          }
          return next;
        });
        const parsed = parseApiError(followError);
        showToast({
          title: "Couldn't update follow",
          message: parsed.message,
          tone: "error",
        });
      } finally {
        setFollowUpdatingIds((previous) =>
          previous.filter((id) => id !== actorUserId)
        );
      }
    },
    [followingUserIds, showToast]
  );

  return (
    <AppLayout activeNavId="notifications">
      <AppMobileHeader title="Notifications" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-strong">Notifications</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            disabled={unreadCount === 0}
            className="rounded-full border border-border/70 px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-50"
          >
            Mark all
          </button>
        </div>
      </header>

      <div className="divide-y divide-border/70 bg-bg">
        {status === "loading" && items.length === 0 ? (
          <>
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonNotificationRow key={`notification-skeleton-${index}`} />
            ))}
          </>
        ) : null}

        {error ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm font-semibold text-strong">Unable to load notifications.</p>
            <p className="text-sm text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => void loadNotifications({ replace: true })}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {items.map((notification) => {
          const cachedActor = notification.actorUserId
            ? actorProfiles[notification.actorUserId]
            : undefined;
          const actorName =
            notification.actorName !== "Someone"
              ? notification.actorName
              : cachedActor?.name ?? notification.actorName;
          const actorImageUrl = notification.actorProfileImageUrl ?? cachedActor?.avatarUrl;
          const presentation = resolveNotificationPresentation(notification, actorName);

          const actorUserId = notification.actorUserId;
          const canFollowBack =
            notification.type === "follow" &&
            Boolean(actorUserId) &&
            !notification.actorAnonProfileId &&
            actorUserId !== currentUserId;
          const isFollowing = actorUserId
            ? Boolean(followingUserIds[actorUserId])
            : false;
          const isFollowUpdating = actorUserId
            ? followUpdatingIds.includes(actorUserId)
            : false;

          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleNotificationTap(notification)}
              className={`w-full px-4 py-4 text-left transition ${
                notification.unread ? "bg-brand/5" : "bg-bg hover:bg-bg-muted/35"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-sm font-semibold text-text-secondary">
                    <img
                      src={actorImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={handleProfileImageError}
                    />
                  </div>
                  {notification.unread ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm ${notification.unread ? "font-semibold text-strong" : "font-medium text-text-primary"}`}>
                      {presentation.title}
                    </p>
                    <p className="shrink-0 text-xs text-text-light">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{presentation.description}</p>
                  {canFollowBack && actorUserId ? (
                    <button
                      type="button"
                      onClick={(event) =>
                        void handleFollowToggle(event, actorUserId)
                      }
                      disabled={isFollowUpdating}
                      className={`mt-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isFollowing
                          ? "border border-border/70 bg-bg text-text-secondary hover:text-strong"
                          : "bg-brand text-white hover:bg-brand-hover"
                      } disabled:opacity-60`}
                    >
                      {isFollowUpdating ? "Updating..." : isFollowing ? "Following" : "Follow back"}
                    </button>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}

        {items.length === 0 && status === "idle" && !error ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">No notifications yet.</div>
        ) : null}

        {nextCursor && status !== "loading-more" ? (
          <div className="flex justify-center px-4 py-5">
            <button
              type="button"
              onClick={() =>
                void loadNotifications({
                  cursor: nextCursor,
                  replace: false,
                })
              }
              className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
            >
              Load more
            </button>
          </div>
        ) : null}

        {status === "loading-more" ? (
          <div className="px-4 py-5 text-center text-sm text-text-secondary">Loading more...</div>
        ) : null}
      </div>

      {selectedSystemNotification ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onClick={() => setSelectedSystemNotification(null)}
        >
          <div
            className="w-full rounded-t-2xl border border-border/70 bg-bg p-4 shadow-xl sm:max-w-md sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const presentation = resolveNotificationPresentation(
                selectedSystemNotification,
                selectedSystemNotification.actorName
              );

              return (
                <>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-strong">{presentation.title}</h2>
                    <button
                      type="button"
                      onClick={() => setSelectedSystemNotification(null)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong"
                      aria-label="Close notification detail"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-text-secondary">{presentation.description}</p>
                  <p className="mt-3 text-xs text-text-light">{formatTimeAgo(selectedSystemNotification.createdAt)}</p>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
