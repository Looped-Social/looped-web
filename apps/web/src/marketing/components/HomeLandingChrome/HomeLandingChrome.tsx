import { useEffect } from "react";
import { Link } from "react-router";

import { Logo } from "@looped/ui";

import { SocialIconLinks } from "../SocialIconLinks/SocialIconLinks";

const APP_STORE_URL = "https://apps.apple.com/us/app/looped-social/id6758413180";

export function HomeChoiceDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Get Looped"
        className="w-full max-w-md rounded-[2rem] bg-bg p-6 text-strong shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-strong">Choose how to continue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong"
            aria-label="Close dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-full bg-brand px-5 py-3 text-base font-semibold text-white transition hover:bg-brand/90"
            onClick={onClose}
          >
            Log in / Sign up
          </Link>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full border border-border bg-bg px-5 py-3 text-base font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Download on iOS
          </a>
        </div>
      </div>
    </div>
  );
}

export function HomeLandingChrome({
  tone,
}: {
  tone: "light" | "dark";
}) {
  const isDark = tone === "dark";
  const logoVariant = isDark ? "dark" : "light";
  const navTextClass = isDark ? "text-white/92" : "text-strong";
  const mutedTextClass = isDark ? "text-white/58" : "text-text-secondary";
  const borderClass = isDark ? "border-white/18" : "border-border/80";
  const topLinkClass = isDark ? "text-white/92 hover:text-white" : "text-strong hover:text-strong/80";
  const loginClass = isDark
    ? "bg-brand text-white hover:bg-brand/90"
    : "bg-brand text-white hover:bg-brand/90";
  const signupClass = isDark
    ? "border-white/28 text-white hover:bg-white/10"
    : "border-strong/18 text-strong hover:bg-bg";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70]">
      <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="pointer-events-auto origin-left scale-110 px-1 py-1">
          <Logo variant={logoVariant} />
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className={`text-sm font-semibold transition ${topLinkClass}`}
          >
            Get iOS App
          </a>
          <Link
            to="/login"
            className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${loginClass}`}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className={`inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition ${signupClass}`}
          >
            Sign up
          </Link>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0">
        <div className="mx-auto max-w-7xl px-4 pb-0 sm:px-6 sm:pb-0 lg:px-8 lg:pb-0">
          <div className={`pointer-events-auto flex flex-col gap-4 border-t px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between ${borderClass}`}>
            <div className={`flex flex-wrap items-center gap-5 text-sm ${navTextClass}`}>
              <Link className="font-semibold transition hover:opacity-70" to="/about">
                about
              </Link>
              <Link className="font-semibold transition hover:opacity-70" to="/privacy">
                privacy
              </Link>
              <Link className="font-semibold transition hover:opacity-70" to="/terms">
                terms
              </Link>
              <Link className="font-semibold transition hover:opacity-70" to="/faq">
                FAQs
              </Link>
              <SocialIconLinks
                className="gap-0.5"
                linkClassName={`h-8 w-8 ${navTextClass}`}
                iconClassName="h-4.5 w-4.5"
              />
            </div>
            <p className={`text-sm ${mutedTextClass}`}>2026 Looped Social. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
