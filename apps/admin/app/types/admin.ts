export type AdminRole = "owner" | "admin" | "moderator";

export type AdminStatus = "active" | "disabled" | "pending";

export type AdminMe = {
  id: number;
  email: string;
  role: AdminRole;
  status: AdminStatus | string;
  permissions: string[];
};

export type AdminListItem = AdminMe & {
  created_at: string;
  last_login_at: string | null;
};

export type AdminListResponse = {
  items: AdminListItem[];
};

export type AdminInviteRequest = {
  email: string;
  role: Exclude<AdminRole, "owner">;
  permissions?: string[];
};

export type AdminInviteResponse = {
  token: string;
  expires_at: string;
  role: Exclude<AdminRole, "owner">;
  permissions: string[];
};

export type AdminUpdateRequest = {
  role?: AdminRole;
  status?: AdminStatus;
  permissions?: string[];
};

export type AdminUpdateResponse = {
  id: number;
  role: AdminRole;
  status: AdminStatus;
  permissions: string[];
};

export type VerificationItem = {
  id: number;
  user_id: number;
  email: string | null;
  method: "email" | "video" | "thirdparty" | string;
  status: "pending" | "approved" | "rejected" | string;
  submitted_at: string;
  company_domain: string | null;
  media_key: string | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reject_reason: string | null;
};

export type VerificationListResponse = {
  items: VerificationItem[];
  next_cursor?: string | null;
};

export type ReportItem = {
  id: number;
  target_type: "post" | "user" | string;
  target_id: number;
  reporter_id: number;
  reporter_handle: string | null;
  reason: string;
  status: "open" | "resolved" | string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  resolved_reason: string | null;
};

export type ReportListResponse = {
  items: ReportItem[];
  next_cursor?: string | null;
};

export type UserBan = {
  id: number;
  status: "banned" | "active" | string;
  expires_at?: string | null;
  reason?: string | null;
};

export type UserListItem = {
  id: number;
  handle: string | null;
  email: string | null;
  company_id: number | null;
  created_at: string;
  ban?: UserBan | null;
};

export type UserListResponse = {
  items: UserListItem[];
  next_cursor?: string | null;
};

export type UserDetail = UserListItem & {
  verification?: {
    method: string;
    verified: boolean;
    verified_at: string | null;
  } | null;
};

export type PostDetail = {
  id: number;
  author_id?: number;
  company_id?: number;
  content?: string | null;
  media_asset_id?: number | null;
  created_at?: string;
  removed_at?: string | null;
  removed_reason?: string | null;
  removed_by?: number | null;
  [key: string]: unknown;
};

export type AuditItem = {
  id: number;
  actor_admin_id: number;
  action: string;
  target_type: string;
  target_id: number;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type AuditListResponse = {
  items: AuditItem[];
  next_cursor?: string | null;
};
