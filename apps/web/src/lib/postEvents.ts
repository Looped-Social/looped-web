export const POST_SAVED_CHANGED_EVENT = "looped:post-saved-changed";

type SavedChangedDetail = {
  postId: string;
  saved: boolean;
};

export function emitPostSavedChanged(detail: SavedChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POST_SAVED_CHANGED_EVENT, { detail }));
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
