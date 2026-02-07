import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastTone = "info" | "error";

type ToastState = {
  open: boolean;
  title?: string;
  message: string;
  tone: ToastTone;
};

type ShowToastArgs = {
  title?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastContextValue = {
  toast: ToastState | null;
  showToast: (args: ShowToastArgs) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback(
    ({ title, message, tone = "info", durationMs = 3500 }: ShowToastArgs) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      setToast({ open: true, title, message, tone });
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => {
    return { toast, showToast, dismissToast };
  }, [toast, showToast, dismissToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return value;
}

export function ToastViewport() {
  const { toast, dismissToast } = useToast();
  if (!toast?.open) return null;

  const toneClasses =
    toast.tone === "error"
      ? "border-brand/30 bg-brand/10 text-brand"
      : "border-border/70 bg-bg text-text-primary";

  return (
    <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-[520px] rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${toneClasses}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
            <p className={`mt-0.5 text-sm ${toast.tone === "error" ? "text-brand/90" : "text-text-secondary"}`}>
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-text-secondary transition hover:text-strong"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

