export class ApiError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export type AuthGateCode =
  | "user_not_provisioned"
  | "onboarding_incomplete"
  | "account_deleted"
  | "account_delete_pending";

export const AUTH_GATE_EVENT = "looped:auth-gate";

export type AuthGateEventDetail = {
  code: AuthGateCode;
  status: number;
  source?: string;
};

type LoginStatusCode = "delete-pending" | "onboarding-required" | "account-deleted";

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseErrorCode(details?: string): string | null {
  const text = normalizeOptional(details);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const payload = parsed as Record<string, unknown>;
    const code = normalizeOptional(payload.error ?? payload.code);
    return code?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function getAuthGateCode(status: number, details?: string): AuthGateCode | null {
  if (status !== 409) return null;
  const code = parseErrorCode(details);
  if (
    code === "user_not_provisioned" ||
    code === "onboarding_incomplete" ||
    code === "account_deleted" ||
    code === "account_delete_pending"
  ) {
    return code;
  }
  return null;
}

export function loginStatusFromAuthGateCode(code: AuthGateCode): LoginStatusCode {
  if (code === "account_delete_pending") return "delete-pending";
  if (code === "account_deleted") return "account-deleted";
  return "onboarding-required";
}

export function emitAuthGate(detail: AuthGateEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthGateEventDetail>(AUTH_GATE_EVENT, { detail }));
}

export function notifyAuthGateFromHttpError({
  status,
  details,
  source,
}: {
  status: number;
  details?: string;
  source?: string;
}): AuthGateCode | null {
  const code = getAuthGateCode(status, details);
  if (!code) return null;
  emitAuthGate({ code, status, source });
  return code;
}

export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "";
  if (!raw) {
    throw new Error("Missing VITE_API_BASE_URL for API requests.");
  }
  return raw.replace(/\/$/, "");
}
