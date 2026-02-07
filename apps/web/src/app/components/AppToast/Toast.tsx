import "./toast.css";

import { useMemo } from "react";

import { useToast } from "./ToastProvider";

type ToastViewportProps = {
  tabBarHeight?: number;
};

function ToastIcon({ kind }: { kind: "info" | "warning" | "loading" | "success" | "error" }) {
  if (kind === "loading") {
    return (
      <svg viewBox="0 0 24 24" className="looped-toast__icon-spinner" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" opacity="0.3" />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "success") {
    return (
      <svg viewBox="0 0 24 24" className="looped-toast__icon-svg" aria-hidden="true">
        <path d="m8.8 12.3 2.1 2.1 4.3-4.3" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "error") {
    return (
      <svg viewBox="0 0 24 24" className="looped-toast__icon-svg" aria-hidden="true">
        <path d="m9 9 6 6" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        <path d="m15 9-6 6" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="looped-toast__icon-svg" aria-hidden="true">
        <path d="M12 7.5v5.2" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="16.2" r="1.1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="looped-toast__icon-svg" aria-hidden="true">
      <path d="M12 10v5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="7.6" r="1.1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="looped-toast__close-icon" aria-hidden="true">
      <path d="m8 8 8 8" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path d="m16 8-8 8" fill="none" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ToastViewport({ tabBarHeight = 0 }: ToastViewportProps) {
  const { toast, hideToast } = useToast();
  const safeTabBarHeight = Number.isFinite(tabBarHeight) && tabBarHeight > 0 ? tabBarHeight : 0;

  const accentClass = useMemo(() => {
    if (!toast) return "";
    if (toast.kind === "loading") return "looped-toast--loading";
    if (toast.kind === "success") return "looped-toast--success";
    if (toast.kind === "error") return "looped-toast--error";
    return "looped-toast--secondary";
  }, [toast]);

  if (!toast) return null;

  const isLoading = toast.kind === "loading";
  const role = toast.kind === "error" ? "alert" : "status";
  const ariaLabel = `${toast.title}: ${toast.text}`;

  return (
    <div
      className="looped-toast-viewport"
      style={{ ["--toast-tab-bar-height" as string]: `${safeTabBarHeight}px` }}
    >
      <div
        role={role}
        aria-live={toast.kind === "error" ? "assertive" : "polite"}
        aria-label={ariaLabel}
        className={`looped-toast ${accentClass} ${toast.isExiting ? "looped-toast--exit" : "looped-toast--enter"} ${toast.dismissible ? "looped-toast--dismissible" : ""}`}
        onClick={toast.dismissible ? hideToast : undefined}
      >
        <div className="looped-toast__icon" aria-hidden="true">
          <ToastIcon kind={toast.kind} />
        </div>

        <div className="looped-toast__copy">
          <p className="looped-toast__title">{toast.title}</p>
          <p className="looped-toast__message">{toast.text}</p>
        </div>

        {!isLoading ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              hideToast();
            }}
            className="looped-toast__close"
            aria-label="Dismiss toast"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}
