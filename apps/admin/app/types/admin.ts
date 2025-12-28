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

export type CommunityRequestItem = {
  id: number;
  status: "pending" | "approved" | "rejected" | string;
  kind: string | null;
  name: string | null;
  description: string | null;
  image_key?: string | null;
  image_url?: string | null;
  verification_ttl_days?: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
  requested_by?: number | null;
  requested_by_email?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  reject_reason?: string | null;
  [key: string]: unknown;
};

export type CommunityRequestListResponse = {
  items: CommunityRequestItem[];
  next_cursor?: string | null;
};

export type CommunityRequestApprovePayload = {
  kind?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  verificationTtlDays?: number;
};

export type ReportItem = {
  id: number;
  target_type: "post" | "user" | "comment" | string;
  target_id: number;
  reporter_id: number;
  reporter_handle: string | null;
  reason: string;
  status: "open" | "resolved" | "dismissed" | string;
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
  created_at?: string | null;
  created_by?: number | null;
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
  moderation_stats?: ModerationStats | null;
};

export type ModerationStats = {
  posts_total: number;
  posts_removed_total: number;
  reports_against_user_total: number;
  reports_against_user_open: number;
  reports_against_user_resolved: number;
  reports_against_user_dismissed: number;
  reports_against_posts_total: number;
  reports_against_posts_open: number;
  reports_against_posts_resolved: number;
  reports_against_posts_dismissed: number;
  reports_filed_total: number;
  reports_filed_open: number;
  reports_filed_resolved: number;
  reports_filed_dismissed: number;
};

export type AppealItem = {
  id: number;
  user_id: number;
  user_handle: string | null;
  target_type: "user_ban" | "post_removal" | string;
  target_id: number | null;
  reason: string;
  status: "open" | "approved" | "rejected" | string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewed_reason: string | null;
};

export type AppealListResponse = {
  items: AppealItem[];
  next_cursor?: string | null;
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

export type CommunityLeaderboardItem = {
  community_id: number;
  community_name?: string | null;
  likes_count?: number | null;
  shares_count?: number | null;
  followers_count?: number | null;
  verifications_count?: number | null;
  accounts_total?: number | null;
  [key: string]: unknown;
};

export type CommunityLeaderboardResponse =
  | CommunityLeaderboardItem[]
  | {
      items: CommunityLeaderboardItem[];
    };

export type HashtagLeaderboardItem = {
  id: number;
  name: string;
  usage_count?: number | null;
  [key: string]: unknown;
};

export type HashtagLeaderboardResponse =
  | HashtagLeaderboardItem[]
  | {
      items: HashtagLeaderboardItem[];
    };

export type UserStatsResponse = {
  total_users?: number | null;
  new_users?: number | null;
  deleted_users?: number | null;
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

export type AnnouncementSendRequest = {
  title: string;
  body: string;
  deeplink?: string | null;
};

export type AnnouncementSendResponse = {
  sent: number;
};
