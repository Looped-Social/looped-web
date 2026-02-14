import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export type NormalizedApiError = {
  code: string;
  message: string;
};

export class SettingsApiError extends ApiError {
  code: string;

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number;
    code: string;
    message: string;
    details?: string;
  }) {
    super(status, message, details);
    this.code = code;
  }
}

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function normalizeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseErrorResponse(response: Response): Promise<{ normalized: NormalizedApiError; details?: string }> {
  const fallbackMessage = response.statusText || "Request failed.";
  const text = (await response.text()).trim();
  if (!text) {
    return {
      normalized: {
        code: `http_${response.status}`,
        message: fallbackMessage,
      },
    };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      const payload = parsed as {
        error?: unknown;
        code?: unknown;
        message?: unknown;
      };
      const code = normalizeCode(payload.error ?? payload.code) ?? `http_${response.status}`;
      const message = normalizeMessage(payload.message) ?? fallbackMessage;
      return {
        normalized: { code, message },
        details: text,
      };
    }
  } catch {
    return {
      normalized: {
        code: `http_${response.status}`,
        message: text,
      },
      details: text,
    };
  }

  return {
    normalized: {
      code: `http_${response.status}`,
      message: fallbackMessage,
    },
    details: text,
  };
}

async function parseSuccessPayload<T>(response: Response): Promise<T> {
  if (response.status === 204) return {} as T;
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SettingsApiError({
      status: response.status,
      code: "invalid_response",
      message: "Unexpected server response.",
      details: text,
    });
  }
}

function defaultRetryCount(method: string): number {
  return method === "GET" || method === "HEAD" ? 2 : 0;
}

function shouldRetry(method: string, status: number): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return TRANSIENT_STATUS.has(status);
}

export async function settingsAuthFetch<T>(
  path: string,
  init?: RequestInit,
  options?: {
    retries?: number;
  }
): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getApiBase();
  const method = (init?.method ?? "GET").toUpperCase();
  const retries = options?.retries ?? defaultRetryCount(method);
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let attempt = 0;
  let networkError: Error | null = null;

  while (attempt <= retries) {
    let response: Response;

    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        method,
        headers,
      });
    } catch (error) {
      networkError = error instanceof Error ? error : new Error("Network request failed.");
      if (attempt >= retries) {
        throw new SettingsApiError({
          status: 0,
          code: "network_error",
          message: networkError.message,
          details: networkError.message,
        });
      }
      attempt += 1;
      await sleep(200 * attempt);
      continue;
    }

    if (response.ok) {
      return parseSuccessPayload<T>(response);
    }

    const { normalized, details } = await parseErrorResponse(response);
    if (attempt < retries && shouldRetry(method, response.status)) {
      attempt += 1;
      await sleep(200 * attempt);
      continue;
    }
    notifyAuthGateFromHttpError({ status: response.status, details, source: "settingsHttp" });

    throw new SettingsApiError({
      status: response.status,
      code: normalized.code,
      message: normalized.message,
      details,
    });
  }

  throw new SettingsApiError({
    status: 0,
    code: "network_error",
    message: networkError?.message ?? "Network request failed.",
    details: networkError?.message,
  });
}

export function normalizeSettingsError(error: unknown): NormalizedApiError {
  if (error instanceof SettingsApiError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof ApiError) {
    return {
      code: `http_${error.status}`,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
    };
  }

  return {
    code: "unknown",
    message: "Something went wrong.",
  };
}
