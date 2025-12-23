import { getFirebaseIdToken } from "./firebaseClient";
import type {
  AdminInviteRequest,
  AdminInviteResponse,
  AdminListResponse,
  AdminMe,
  AdminUpdateRequest,
  AdminUpdateResponse,
  AppealListResponse,
  AuditListResponse,
  PostDetail,
  ReportListResponse,
  UserDetail,
  UserListResponse,
  VerificationListResponse,
} from "../types/admin";

export class AdminApiError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getAdminApiBase(): string {
  const raw = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "";
  return raw.replace(/\/$/, "");
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getAdminApiBase();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AdminApiError(response.status, details || "Admin request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
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

export async function fetchAdminVerifications(
  status: "pending" | "approved" | "rejected",
  cursor?: string,
  limit = 20
): Promise<VerificationListResponse> {
  const params = new URLSearchParams({ status, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return adminFetch<VerificationListResponse>(`/v1/admin/verifications?${params.toString()}`);
}

export async function approveVerification(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/verifications/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectVerification(id: number, reason: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/verifications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function fetchAdminReports(
  status: "open" | "resolved" | "dismissed",
  targetType?: "post" | "user" | "comment",
  cursor?: string,
  limit = 20,
  filters?: {
    from?: string;
    to?: string;
    sort?: "created_at_desc" | "created_at_asc";
  }
): Promise<ReportListResponse> {
  const params = new URLSearchParams({ status, limit: String(limit) });
  if (targetType) params.set("targetType", targetType);
  if (cursor) params.set("cursor", cursor);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.sort) params.set("sort", filters.sort);
  return adminFetch<ReportListResponse>(`/v1/admin/reports?${params.toString()}`);
}

export async function resolveReport(id: number, reason?: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function dismissReport(id: number, reason?: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/reports/${id}/dismiss`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function fetchAdminPost(id: number): Promise<PostDetail> {
  return adminFetch<PostDetail>(`/v1/admin/posts/${id}`);
}

export async function removeAdminPost(id: number, reason: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/posts/${id}/remove`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function restoreAdminPost(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/posts/${id}/restore`, {
    method: "POST",
  });
}

export async function fetchAdminUsers(
  query: string,
  cursor?: string,
  limit = 20
): Promise<UserListResponse> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return adminFetch<UserListResponse>(`/v1/admin/users?${params.toString()}`);
}

export async function fetchAdminUser(id: number): Promise<UserDetail> {
  return adminFetch<UserDetail>(`/v1/admin/users/${id}`);
}

export async function banAdminUser(
  id: number,
  payload: { duration_seconds?: number; expires_at?: string; reason?: string }
): Promise<{ status: string; id: number; expires_at?: string | null }> {
  return adminFetch<{ status: string; id: number; expires_at?: string | null }>(
    `/v1/admin/users/${id}/ban`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function unbanAdminUser(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/users/${id}/unban`, {
    method: "POST",
  });
}

export async function fetchAdminAdmins(): Promise<AdminListResponse> {
  return adminFetch<AdminListResponse>("/v1/admin/admins");
}

export async function inviteAdmin(payload: AdminInviteRequest): Promise<AdminInviteResponse> {
  return adminFetch<AdminInviteResponse>("/v1/admin/invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdmin(
  id: number,
  payload: AdminUpdateRequest
): Promise<AdminUpdateResponse> {
  return adminFetch<AdminUpdateResponse>(`/v1/admin/admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminAppeals(
  status: "open" | "approved" | "rejected",
  targetType?: "user_ban" | "post_removal",
  userId?: number,
  cursor?: string,
  limit = 20,
  sort: "created_at_desc" | "created_at_asc" = "created_at_desc"
): Promise<AppealListResponse> {
  const params = new URLSearchParams({ status, limit: String(limit), sort });
  if (targetType) params.set("targetType", targetType);
  if (typeof userId === "number" && Number.isFinite(userId)) {
    params.set("userId", String(userId));
  }
  if (cursor) params.set("cursor", cursor);
  return adminFetch<AppealListResponse>(`/v1/admin/appeals?${params.toString()}`);
}

export async function approveAppeal(
  id: number,
  reason?: string
): Promise<{ status: string; action?: string }> {
  return adminFetch<{ status: string; action?: string }>(`/v1/admin/appeals/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function rejectAppeal(
  id: number,
  reason?: string
): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/appeals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function fetchAdminAudit(
  cursor?: string,
  limit = 20
): Promise<AuditListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return adminFetch<AuditListResponse>(`/v1/admin/audit?${params.toString()}`);
}
