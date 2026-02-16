const POST_LOGOUT_NOTICE_KEY = "looped-post-logout-notice";
const NOTICE_MAX_AGE_MS = 10 * 60 * 1000;

type StoredPostLogoutNotice = {
  message: string;
  createdAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function persistPostLogoutNotice(message: string) {
  if (typeof window === "undefined") return;
  const trimmed = message.trim();
  if (!trimmed) return;

  const payload: StoredPostLogoutNotice = {
    message: trimmed,
    createdAt: Date.now(),
  };

  try {
    window.localStorage.setItem(POST_LOGOUT_NOTICE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function consumePostLogoutNotice(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(POST_LOGOUT_NOTICE_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(POST_LOGOUT_NOTICE_KEY);

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    const createdAt = typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt) ? parsed.createdAt : 0;

    if (!message) return null;
    if (Date.now() - createdAt > NOTICE_MAX_AGE_MS) return null;

    return message;
  } catch {
    return null;
  }
}
