import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

const APP_STORE_URL = "https://apps.apple.com/us/app/looped-social/id6758413180";
const APP_DEEP_LINK_ROOT = "looped://";
const DISMISS_STORAGE_KEY = "looped-ios-app-prompt-dismissed-at";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const RESERVED_MARKETING_SLUGS = new Set([
  "about",
  "contact",
  "privacy",
  "privacy-policy",
  "cookies",
  "terms",
  "community-rules",
  "community-request",
  "faq",
  "attributions",
  "login",
  "delete-account",
  "app",
  "p",
]);

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;

  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS can identify as Mac; touch points disambiguate.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

function isLikelyProfileSlug(pathname: string): string | null {
  const match = pathname.match(/^\/([^/]+)$/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1] ?? "").replace(/^@/, "").toLowerCase();
  if (!raw || RESERVED_MARKETING_SLUGS.has(raw)) return null;
  return /^[a-z0-9_]{3,30}$/.test(raw) ? raw : null;
}

function deepLinkForPath(pathname: string): string {
  const postMatch = pathname.match(/^\/p\/([^/]+)$/);
  if (postMatch?.[1]) return `looped://post/${encodeURIComponent(decodeURIComponent(postMatch[1]))}`;

  const profileSlug = isLikelyProfileSlug(pathname);
  if (profileSlug) return `looped://profile/${encodeURIComponent(profileSlug)}`;

  return APP_DEEP_LINK_ROOT;
}

function readDismissedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeDismissedAt(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(value));
  } catch {
    // ignore localStorage failures
  }
}

export function IOSAppPrompt() {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  const eligiblePath = useMemo(() => !location.pathname.startsWith("/app"), [location.pathname]);

  useEffect(() => {
    if (!eligiblePath || !isIOSDevice()) {
      setIsVisible(false);
      return;
    }

    const dismissedAt = readDismissedAt();
    const shouldShow = dismissedAt <= 0 || Date.now() - dismissedAt >= DISMISS_COOLDOWN_MS;
    setIsVisible(shouldShow);
  }, [eligiblePath, location.pathname]);

  const dismissPrompt = useCallback(() => {
    writeDismissedAt(Date.now());
    setIsVisible(false);
  }, []);

  const openInApp = useCallback(() => {
    if (typeof window === "undefined") return;
    const deepLink = deepLinkForPath(location.pathname);
    dismissPrompt();

    const fallbackTimer = window.setTimeout(() => {
      window.location.href = APP_STORE_URL;
    }, 1100);

    const handleVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility, { once: true });
    window.location.href = deepLink;
  }, [dismissPrompt, location.pathname]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-3">
      <div
        className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-border/80 bg-bg p-3 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-strong">Open in Looped Social</p>
            <p className="mt-1 text-sm text-text-secondary">Best experience in the iOS app.</p>
          </div>
          <button
            type="button"
            onClick={dismissPrompt}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-light transition hover:bg-bg-muted hover:text-strong"
            aria-label="Dismiss app prompt"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={openInApp}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            Open in app
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="inline-flex items-center justify-center rounded-full border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
