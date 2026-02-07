import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastKind = "info" | "warning" | "loading" | "success" | "error";

type LegacyToastTone = "info" | "error";

type ToastState = {
  id: number;
  kind: ToastKind;
  title: string;
  text: string;
  durationMs: number | null;
  dismissible: boolean;
  isExiting: boolean;
};

export type ShowToastArgs = {
  text?: string;
  message?: string;
  kind?: ToastKind;
  tone?: LegacyToastTone;
  title?: string;
  durationMs?: number;
};

type ToastContextValue = {
  toast: ToastState | null;
  showToast: (args: ShowToastArgs) => void;
  hideToast: () => void;
  dismissToast: () => void;
};

const EXIT_ANIMATION_MS = 250;
const DEFAULT_DURATION_MS = 2000;

const TITLE_BY_KIND: Record<ToastKind, string> = {
  info: "Info",
  warning: "Warning",
  loading: "Loading",
  success: "Success",
  error: "Error",
};

const ToastContext = createContext<ToastContextValue | null>(null);

function resolveToastKind(args: ShowToastArgs): ToastKind {
  if (args.kind) return args.kind;
  if (args.tone === "error") return "error";
  return "info";
}

function normalizeDuration(kind: ToastKind, durationMs?: number): number | null {
  if (kind === "loading") return null;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    return durationMs;
  }
  return DEFAULT_DURATION_MS;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const idRef = useRef(0);
  const autoDismissTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (autoDismissTimerRef.current !== null) {
      window.clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearTimers();
    setToast((current) => {
      if (!current) return null;
      if (current.isExiting) return current;
      return { ...current, isExiting: true };
    });

    exitTimerRef.current = window.setTimeout(() => {
      setToast(null);
      exitTimerRef.current = null;
    }, EXIT_ANIMATION_MS);
  }, [clearTimers]);

  const showToast = useCallback(
    (args: ShowToastArgs) => {
      const text = (args.text ?? args.message ?? "").trim();
      if (!text) return;

      clearTimers();

      const kind = resolveToastKind(args);
      const durationMs = normalizeDuration(kind, args.durationMs);
      const dismissible = kind !== "loading";

      idRef.current += 1;
      setToast({
        id: idRef.current,
        kind,
        title: args.title?.trim() || TITLE_BY_KIND[kind],
        text,
        durationMs,
        dismissible,
        isExiting: false,
      });

      if (durationMs !== null) {
        autoDismissTimerRef.current = window.setTimeout(() => {
          hideToast();
          autoDismissTimerRef.current = null;
        }, durationMs);
      }
    },
    [clearTimers, hideToast]
  );

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const value = useMemo<ToastContextValue>(() => {
    return {
      toast,
      showToast,
      hideToast,
      dismissToast: hideToast,
    };
  }, [hideToast, showToast, toast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return value;
}

