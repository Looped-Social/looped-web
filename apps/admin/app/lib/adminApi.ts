import type { AdminMe } from "../types/admin";

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getAdminApiBase(): string {
  const raw = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "";
  return raw.replace(/\/$/, "");
}

export async function fetchAdminMe(token: string): Promise<AdminMe> {
  const base = getAdminApiBase();
  const url = `${base}/v1/admin/me`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new AdminApiError(response.status, message || "Admin request failed.");
  }

  return response.json() as Promise<AdminMe>;
}
