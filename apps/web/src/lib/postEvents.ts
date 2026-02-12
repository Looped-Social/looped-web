export const POST_SAVED_CHANGED_EVENT = "looped:post-saved-changed";
export const POST_VISIBILITY_CHANGED_EVENT = "looped:post-visibility-changed";

type SavedChangedDetail = {
  postId: string;
  saved: boolean;
};

type PostVisibilityChangedDetail = {
  reason: "deleted" | "blocked";
  postId?: string;
  authorId?: string;
  authorPrincipalId?: string;
};

export function emitPostSavedChanged(detail: SavedChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POST_SAVED_CHANGED_EVENT, { detail }));
}

export function emitPostDeleted(detail: { postId: string }) {
  if (typeof window === "undefined") return;
  const payload: PostVisibilityChangedDetail = {
    reason: "deleted",
    postId: detail.postId,
  };
  window.dispatchEvent(new CustomEvent(POST_VISIBILITY_CHANGED_EVENT, { detail: payload }));
}

export function emitAuthorBlocked(detail: { authorId?: string; authorPrincipalId?: string }) {
  if (typeof window === "undefined") return;
  const payload: PostVisibilityChangedDetail = {
    reason: "blocked",
    authorId: detail.authorId,
    authorPrincipalId: detail.authorPrincipalId,
  };
  window.dispatchEvent(new CustomEvent(POST_VISIBILITY_CHANGED_EVENT, { detail: payload }));
}

export function isPostSavedChangedEvent(value: unknown): value is CustomEvent<SavedChangedDetail> {
  if (!(value instanceof CustomEvent)) return false;
  const detail = value.detail;
  return Boolean(
    detail &&
      typeof detail === "object" &&
      typeof (detail as { postId?: unknown }).postId === "string" &&
      typeof (detail as { saved?: unknown }).saved === "boolean"
  );
}

export function isPostVisibilityChangedEvent(value: unknown): value is CustomEvent<PostVisibilityChangedDetail> {
  if (!(value instanceof CustomEvent)) return false;
  const detail = value.detail;
  if (!detail || typeof detail !== "object") return false;
  const reason = (detail as { reason?: unknown }).reason;
  if (reason !== "deleted" && reason !== "blocked") return false;

  const postId = (detail as { postId?: unknown }).postId;
  const authorId = (detail as { authorId?: unknown }).authorId;
  const authorPrincipalId = (detail as { authorPrincipalId?: unknown }).authorPrincipalId;

  const hasValidPostId = postId === undefined || typeof postId === "string";
  const hasValidAuthorId = authorId === undefined || typeof authorId === "string";
  const hasValidAuthorPrincipalId = authorPrincipalId === undefined || typeof authorPrincipalId === "string";

  return hasValidPostId && hasValidAuthorId && hasValidAuthorPrincipalId;
}
