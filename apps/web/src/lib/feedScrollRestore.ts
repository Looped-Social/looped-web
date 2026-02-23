const FEED_SCROLL_RESTORE_STORAGE_KEY = "looped:feed-scroll-restore";
const FEED_SCROLL_RESTORE_TTL_MS = 10 * 60 * 1000;
const FEED_ROUTE_PATHNAME = "/app";

type FeedScrollRestoreRecord = {
  pathname: string;
  scrollY: number;
  postId?: string;
  expiresAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRecord(raw: string | null): FeedScrollRestoreRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const pathname = typeof parsed.pathname === "string" ? parsed.pathname : "";
    const scrollY = typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) ? parsed.scrollY : 0;
    const postId = typeof parsed.postId === "string" && parsed.postId.length > 0 ? parsed.postId : undefined;
    const expiresAt = typeof parsed.expiresAt === "number" && Number.isFinite(parsed.expiresAt) ? parsed.expiresAt : 0;
    if (!pathname || expiresAt <= 0) return null;

    return {
      pathname,
      scrollY: Math.max(0, scrollY),
      postId,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function captureFeedScrollRestore(pathname: string, scrollY: number, options?: { postId?: string }) {
  if (typeof window === "undefined") return;
  if (pathname !== FEED_ROUTE_PATHNAME) return;

  const record: FeedScrollRestoreRecord = {
    pathname,
    scrollY: Math.max(0, Number.isFinite(scrollY) ? scrollY : 0),
    postId: typeof options?.postId === "string" ? options.postId : undefined,
    expiresAt: Date.now() + FEED_SCROLL_RESTORE_TTL_MS,
  };

  try {
    window.sessionStorage.setItem(FEED_SCROLL_RESTORE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors in private browsing modes
  }
}

export function consumeFeedScrollRestore(pathname: string): { scrollY: number; postId?: string } | null {
  if (typeof window === "undefined") return null;

  let parsed: FeedScrollRestoreRecord | null;
  try {
    parsed = parseRecord(window.sessionStorage.getItem(FEED_SCROLL_RESTORE_STORAGE_KEY));
  } catch {
    parsed = null;
  }

  const clear = () => {
    try {
      window.sessionStorage.removeItem(FEED_SCROLL_RESTORE_STORAGE_KEY);
    } catch {
      // ignore storage errors in private browsing modes
    }
  };

  if (!parsed) {
    clear();
    return null;
  }
  if (parsed.expiresAt <= Date.now()) {
    clear();
    return null;
  }
  if (parsed.pathname !== pathname) return null;

  clear();
  return {
    scrollY: parsed.scrollY,
    postId: parsed.postId,
  };
}
