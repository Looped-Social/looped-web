import { getFirebaseIdToken } from "./firebaseClient";
import type {
  AdminCommunity,
  AdminCommunityCreateRequest,
  AdminCommunityDomainListResponse,
  AdminCommunityListResponse,
  AdminCommunityLogoListResponse,
  AdminCommunityLogoPresignResponse,
  AdminCommunityUpdateRequest,
  AdminCommunityUpdateResponse,
  AdminSector,
  AdminSectorCompanyListResponse,
  AdminSectorCreateRequest,
  AdminSectorListResponse,
  AdminInviteRequest,
  AdminInviteResponse,
  AdminListResponse,
  AdminMe,
  AdminSpecializationsSettingsResponse,
  AdminSpecializationsSettingsUpdateRequest,
  AdminUpdateRequest,
  AdminUpdateResponse,
  AnnouncementSendRequest,
  AnnouncementSendResponse,
  AppealListResponse,
  AuditListResponse,
  CommunityRequestApprovePayload,
  CommunityRequestApproveResponse,
  CommunityRequestListResponse,
  CommunityLeaderboardItem,
  CommunityLeaderboardResponse,
  HashtagLeaderboardItem,
  HashtagLeaderboardResponse,
  PostDetail,
  ReportListResponse,
  UserDetail,
  UserListResponse,
  UserCommunityBanCreateRequest,
  UserCommunityBanCreateResponse,
  UserCommunityBanListResponse,
  UserCommunityBanRevokeResponse,
  UserStatsResponse,
  UserSpecializationCooldownResetResponse,
  VerificationDetail,
  VerificationListResponse,
  UserVerifiedCommunityListResponse,
  UserVerifiedCommunityRevokeResponse,
} from "../types/admin";

export class AdminApiError extends Error {
  status: number;
  details?: string;
  errorCode?: string;

  constructor(status: number, message: string, details?: string, errorCode?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.errorCode = errorCode;
  }
}

function getAdminApiBase(): string {
  const raw = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "";
  return raw.replace(/\/$/, "");
}

async function baseFetch<T>(
  pathOrUrl: string,
  init?: RequestInit,
  options?: { withAuth?: boolean }
): Promise<T> {
  const base = getAdminApiBase();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${base}${pathOrUrl}`;
  const withAuth = options?.withAuth ?? false;
  const token = withAuth ? await getFirebaseIdToken() : null;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(withAuth && token ? { Authorization: `Bearer ${token}` } : null),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    let errorCode: string | undefined;
    try {
      const parsed = JSON.parse(details) as { error?: unknown } | null;
      if (parsed && typeof parsed === "object" && typeof parsed.error === "string") {
        errorCode = parsed.error;
      }
    } catch {
      // noop
    }
    throw new AdminApiError(response.status, details || "Request failed.", details, errorCode);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return baseFetch<T>(path, init, { withAuth: true });
}

async function adminUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getAdminApiBase();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new AdminApiError(response.status, details || "Admin request failed.", details);
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
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
  method?: string,
  cursor?: string,
  limit = 20
): Promise<VerificationListResponse> {
  const params = new URLSearchParams({ status, limit: String(limit) });
  if (method) params.set("method", method);
  if (cursor) params.set("cursor", cursor);
  return adminFetch<VerificationListResponse>(`/v1/admin/verifications?${params.toString()}`);
}

export async function fetchAdminVerification(id: number): Promise<VerificationDetail> {
  return adminFetch<VerificationDetail>(`/v1/admin/verifications/${id}`);
}

export type AdminProfileSettingsResponse = {
  default_profile_image_url: string | null;
};

export type AdminProfileSettingsUpdatePayload =
  | { defaultProfileImageUrl: string }
  | { profileMediaAssetId: number }
  | { clearDefaultProfileImage: true };

export async function fetchAdminProfileSettings(): Promise<AdminProfileSettingsResponse> {
  return adminFetch<AdminProfileSettingsResponse>(`/v1/admin/settings/profile`);
}

export async function updateAdminProfileSettings(
  payload: AdminProfileSettingsUpdatePayload
): Promise<AdminProfileSettingsResponse> {
  return adminFetch<AdminProfileSettingsResponse>(`/v1/admin/settings/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type MediaPresignRequest = {
  contentType: string;
  sizeBytes: number;
};

export type MediaPresignResponse = {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  callbackSignature?: string;
};

export type MediaCallbackRequest = {
  key: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type MediaCallbackResponse = {
  id: number;
  key: string;
  mime_type: string;
  cdn_url?: string;
};

export async function presignMediaUpload(payload: MediaPresignRequest): Promise<MediaPresignResponse> {
  return baseFetch<MediaPresignResponse>(`/v1/media/presign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function callbackMediaUpload(
  payload: MediaCallbackRequest,
  options?: { callbackSignature?: string }
): Promise<MediaCallbackResponse> {
  return baseFetch<MediaCallbackResponse>(`/v1/media/callback`, {
    method: "POST",
    headers: {
      "X-Actor": "anon",
      ...(options?.callbackSignature ? { "X-Media-Signature": options.callbackSignature } : null),
    },
    body: JSON.stringify(payload),
  });
}

export async function approveVerification(
  id: number
): Promise<{ status: "approved" | string; media_deleted: boolean }> {
  return adminFetch<{ status: "approved" | string; media_deleted: boolean }>(
    `/v1/admin/verifications/${id}/approve`,
    {
      method: "POST",
    }
  );
}

export async function rejectVerification(
  id: number,
  reason?: string
): Promise<{ status: "rejected" | string; delete_after_at: string }> {
  const trimmed = reason?.trim();
  return adminFetch<{ status: "rejected" | string; delete_after_at: string }>(
    `/v1/admin/verifications/${id}/reject`,
    {
      method: "POST",
      body: trimmed ? JSON.stringify({ reason: trimmed }) : undefined,
    }
  );
}

export async function deleteVerificationMedia(
  id: number
): Promise<{
  media_deleted: boolean;
  media_deleted_at?: string;
  already_deleted?: boolean;
  no_media?: boolean;
}> {
  return adminFetch<{
    media_deleted: boolean;
    media_deleted_at?: string;
    already_deleted?: boolean;
    no_media?: boolean;
  }>(`/v1/admin/verifications/${id}/delete-media`, {
    method: "POST",
  });
}

export async function fetchAdminCommunityRequests(
  status: "pending" | "approved" | "rejected",
  cursor?: string,
  limit = 50
): Promise<CommunityRequestListResponse> {
  const params = new URLSearchParams({ status, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return adminFetch<CommunityRequestListResponse>(
    `/v1/admin/community-requests?${params.toString()}`
  );
}

export async function approveCommunityRequest(
  id: number,
  payload?: CommunityRequestApprovePayload
): Promise<CommunityRequestApproveResponse> {
  return adminFetch<CommunityRequestApproveResponse>(`/v1/admin/community-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function rejectCommunityRequest(
  id: number,
  reason: string
): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/community-requests/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function deleteCommunityRequest(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/community-requests/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAdminCommunities(
  query?: string,
  cursor?: string,
  limit = 30,
  kind?: string
): Promise<AdminCommunityListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query) params.set("query", query);
  if (cursor) params.set("cursor", cursor);
  if (kind) params.set("kind", kind);
  return adminFetch<AdminCommunityListResponse>(`/v1/admin/communities?${params.toString()}`);
}

export async function fetchAdminCommunity(id: number): Promise<AdminCommunity> {
  return adminFetch<AdminCommunity>(`/v1/admin/communities/${id}`);
}

export async function createAdminCommunity(
  payload: AdminCommunityCreateRequest
): Promise<{ id: number }> {
  const body = payload;
  return adminFetch<{ id: number }>(`/v1/admin/communities`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAdminCommunity(
  id: number,
  payload: AdminCommunityUpdateRequest
): Promise<AdminCommunityUpdateResponse> {
  return adminFetch<AdminCommunityUpdateResponse>(`/v1/admin/communities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminCommunity(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/communities/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAdminSpecializationsSettings(): Promise<AdminSpecializationsSettingsResponse> {
  return adminFetch<AdminSpecializationsSettingsResponse>(`/v1/admin/settings/specializations`);
}

export async function updateAdminSpecializationsSettings(
  payload: AdminSpecializationsSettingsUpdateRequest
): Promise<AdminSpecializationsSettingsResponse> {
  return adminFetch<AdminSpecializationsSettingsResponse>(`/v1/admin/settings/specializations`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminCommunityDomains(
  id: number,
  includeInherited = false
): Promise<AdminCommunityDomainListResponse> {
  const query = includeInherited ? "?includeInherited=true" : "";
  return adminFetch<AdminCommunityDomainListResponse>(`/v1/admin/communities/${id}/domains${query}`);
}

export async function addAdminCommunityDomain(
  id: number,
  domain: string
): Promise<{ domain: string }> {
  return adminFetch<{ domain: string }>(`/v1/admin/communities/${id}/domains`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export async function deleteAdminCommunityDomain(id: number, domain: string): Promise<void> {
  await adminFetch(`/v1/admin/communities/${id}/domains?domain=${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
}

export async function fetchAdminCommunityLogos(id: number): Promise<AdminCommunityLogoListResponse> {
  return adminFetch<AdminCommunityLogoListResponse>(`/v1/admin/communities/${id}/logos`);
}

export async function presignAdminCommunityLogo(
  id: number,
  payload: { contentType: string; sizeBytes: number }
): Promise<AdminCommunityLogoPresignResponse> {
  return adminFetch<AdminCommunityLogoPresignResponse>(`/v1/admin/communities/${id}/logos/presign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function callbackAdminCommunityLogo(
  id: number,
  payload: { key: string; mimeType: string; width: number; height: number },
  signature?: string
): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/communities/${id}/logos/callback`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: signature ? { "X-Media-Signature": signature } : undefined,
  });
}

export async function selectAdminCommunityLogo(
  id: number,
  payload: { useLogoDev?: boolean; imageKey?: string; imageUrl?: string }
): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/communities/${id}/logo`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function importAdminCommunitiesCsv(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await adminUpload("/v1/admin/communities/import-csv", formData);
}

export async function fetchAdminSectors(
  query?: string,
  cursor?: string,
  limit = 30
): Promise<AdminSectorListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query) params.set("query", query);
  if (cursor) params.set("cursor", cursor);
  return adminFetch<AdminSectorListResponse>(`/v1/admin/sectors?${params.toString()}`);
}

export async function createAdminSector(payload: AdminSectorCreateRequest): Promise<{ id: number }> {
  return adminFetch<{ id: number }>(`/v1/admin/sectors`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminSector(id: number): Promise<{ status: string }> {
  return adminFetch<{ status: string }>(`/v1/admin/sectors/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAdminSectorCompanies(
  id: number
): Promise<AdminSectorCompanyListResponse> {
  return adminFetch<AdminSectorCompanyListResponse>(`/v1/admin/sectors/${id}/companies`);
}

export async function addAdminSectorCompany(
  id: number,
  companyId: number
): Promise<{ company_id: number }> {
  return adminFetch<{ company_id: number }>(`/v1/admin/sectors/${id}/companies`, {
    method: "POST",
    body: JSON.stringify({ company_id: companyId }),
  });
}

export async function deleteAdminSectorCompany(id: number, companyId: number): Promise<void> {
  await adminFetch(`/v1/admin/sectors/${id}/companies/${companyId}`, {
    method: "DELETE",
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
  limit = 50
): Promise<UserListResponse> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return adminFetch<UserListResponse>(`/v1/admin/users?${params.toString()}`);
}

export async function fetchCommunityLeaderboard(params: {
  metric?: "likes" | "shares" | "followers" | "verifications" | "accounts";
  communityId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<CommunityLeaderboardItem[]> {
  const query = new URLSearchParams();
  if (params.metric) query.set("metric", params.metric);
  if (params.communityId) query.set("communityId", params.communityId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.limit) query.set("limit", String(params.limit));
  const res = await adminFetch<CommunityLeaderboardResponse>(
    `/v1/admin/analytics/communities/leaderboard?${query.toString()}`
  );
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

export async function fetchHashtagLeaderboard(params: {
  communityId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<HashtagLeaderboardItem[]> {
  const query = new URLSearchParams();
  if (params.communityId) query.set("communityId", params.communityId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.limit) query.set("limit", String(params.limit));
  const res = await adminFetch<HashtagLeaderboardResponse>(
    `/v1/admin/analytics/hashtags?${query.toString()}`
  );
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

export async function fetchUserStats(params: {
  from?: string;
  to?: string;
}): Promise<UserStatsResponse> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const suffix = query.toString();
  const path = suffix ? `/v1/admin/analytics/users?${suffix}` : "/v1/admin/analytics/users";
  return adminFetch<UserStatsResponse>(path);
}

export async function fetchAdminUser(id: number): Promise<UserDetail> {
  return adminFetch<UserDetail>(`/v1/admin/users/${id}`);
}

export async function banAdminUser(
  id: number,
  payload: { duration_seconds?: number; expires_at?: string; reason: string }
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

export async function fetchAdminUserCommunityBans(
  id: number,
  active = true
): Promise<UserCommunityBanListResponse> {
  const params = new URLSearchParams();
  params.set("active", active ? "true" : "false");
  return adminFetch<UserCommunityBanListResponse>(
    `/v1/admin/users/${id}/community-bans?${params.toString()}`
  );
}

export async function createAdminUserCommunityBans(
  id: number,
  payload: UserCommunityBanCreateRequest
): Promise<UserCommunityBanCreateResponse> {
  return adminFetch<UserCommunityBanCreateResponse>(`/v1/admin/users/${id}/community-bans`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeAdminUserCommunityBan(
  userId: number,
  banId: number
): Promise<UserCommunityBanRevokeResponse> {
  return adminFetch<UserCommunityBanRevokeResponse>(
    `/v1/admin/users/${userId}/community-bans/${banId}/revoke`,
    {
      method: "POST",
    }
  );
}

export async function fetchAdminUserVerifiedCommunities(
  userId: number
): Promise<UserVerifiedCommunityListResponse> {
  return adminFetch<UserVerifiedCommunityListResponse>(`/v1/admin/users/${userId}/verified-communities`);
}

export async function revokeAdminUserVerifiedCommunity(
  userId: number,
  communityId: number
): Promise<UserVerifiedCommunityRevokeResponse> {
  return adminFetch<UserVerifiedCommunityRevokeResponse>(
    `/v1/admin/users/${userId}/verified-communities/${communityId}/revoke`,
    { method: "POST" }
  );
}

export async function resetAdminUserSpecializationCooldown(
  userId: number,
  specializationType: "major" | "department"
): Promise<UserSpecializationCooldownResetResponse> {
  return adminFetch<UserSpecializationCooldownResetResponse>(
    `/v1/admin/users/${userId}/specializations/${specializationType}/reset-cooldown`,
    { method: "POST" }
  );
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

export async function sendAdminAnnouncement(
  payload: AnnouncementSendRequest
): Promise<AnnouncementSendResponse> {
  return adminFetch<AnnouncementSendResponse>("/v1/admin/announcements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
