export class ApiError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? "";
  if (!raw) {
    throw new Error("Missing VITE_API_BASE_URL for API requests.");
  }
  return raw.replace(/\/$/, "");
}
