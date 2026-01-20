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
  status?: AdminStatus | string;
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
  user_handle?: string | null;
  user_display_name?: string | null;
  email?: string | null;
  method: "email" | "video" | "thirdparty" | "photo_id" | string;
  status: "pending" | "approved" | "rejected" | string;
  submitted_at: string;
  community_id?: number | null;
  community_name?: string | null;
  company_domain?: string | null;
  media_key?: string | null;
  metadata?: Record<string, unknown> | null;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
  reject_reason?: string | null;
  delete_after_at?: string | null;
  media_deleted_at?: string | null;
};

export type VerificationListResponse = {
  items: VerificationItem[];
  next_cursor?: string | null;
};

export type VerificationDocument = {
  kind: "selfie" | "id_front" | "id_back" | string;
  key: string;
  download_url: string;
  expires_in_seconds: number;
};

export type VerificationDetail = VerificationItem & {
  documents?: VerificationDocument[];
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

export type CommunityRequestApproveResponse = {
  status: string;
  community_id?: number;
};

export type AdminCommunity = {
  id: number;
  kind: "company" | "school" | "sector" | "specialization" | string;
  specialization_type?: "major" | "department" | string | null;
  name: string;
  short_name?: string | null;
  description?: string | null;
  member_count?: number | null;
  image_url?: string | null;
  verification_ttl_days?: number | null;
  specialization_join_cooldown_months?: number | null;
  created_at?: string | null;
};

export type AdminCommunityListResponse = {
  items: AdminCommunity[];
  next_cursor?: string | null;
};

export type AdminCommunityCreateRequest = {
  kind: "company" | "school" | "sector" | "specialization";
  name: string;
  description?: string;
  imageUrl?: string;
  verificationTtlDays?: number;
  specializationType?: "major" | "department";
  specializationJoinCooldownMonths?: number;
  shortName?: string;
};

export type AdminCommunityUpdateRequest = {
  verificationTtlDays?: number;
  description?: string;
  shortName?: string;
  specializationJoinCooldownMonths?: number;
};

export type AdminCommunityUpdateResponse = {
  id: number;
  description?: string | null;
  verification_ttl_days?: number | null;
  short_name?: string | null;
  specialization_join_cooldown_months?: number | null;
};

export type AdminSpecializationsSettingsResponse = {
  default_join_cooldown_months: number;
};

export type AdminSpecializationsSettingsUpdateRequest = {
  defaultJoinCooldownMonths: number;
};

export type AdminCommunityDomainListResponse = {
  items: string[];
};

export type AdminCommunityLogoUpload = {
  id?: number | null;
  media_asset_id?: number | null;
  key?: string | null;
  mime_type?: string | null;
  cdn_url?: string | null;
  image_url?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  created_at?: string | null;
};

export type AdminCommunityLogoListResponse = {
  community_id?: number | null;
  kind?: string | null;
  uploads: AdminCommunityLogoUpload[];
  logo_dev_url?: string | null;
  selected_source?: "logo_dev" | "upload" | "custom" | "none" | string;
  selected_image_url?: string | null;
  selected_upload_id?: number | null;
};

export type AdminCommunityLogoPresignResponse = {
  uploadUrl?: string;
  upload_url?: string;
  key: string;
  headers?: Record<string, string>;
  callbackSignature?: string;
  callback_signature?: string;
};

export type AdminSector = {
  id: number;
  kind: "sector" | string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  verification_ttl_days?: number | null;
  created_at?: string | null;
};

export type AdminSectorListResponse = {
  items: AdminSector[];
  next_cursor?: string | null;
};

export type AdminSectorCreateRequest = {
  name: string;
  description?: string;
  imageUrl?: string;
  verificationTtlDays?: number;
};

export type AdminSectorCompanyListResponse = {
  items: AdminCommunity[];
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

export type UserCommunityBan = {
  id: number;
  scope: "community" | "all_communities" | string;
  community_id: number | null;
  community_name: string | null;
  reason: string | null;
  created_at: string | null;
  expires_at: string | null;
  created_by: number | null;
  revoked_at: string | null;
  revoked_by: number | null;
};

export type UserCommunityBanListResponse = {
  items: UserCommunityBan[];
};

export type UserCommunityBanCreateRequest = {
  communityIds?: number[];
  allCommunities?: boolean;
  reason: string;
  duration_seconds?: number;
};

export type UserCommunityBanCreateResponse = {
  status: "banned" | string;
  user_id: number;
  ban_ids: number[];
};

export type UserCommunityBanRevokeResponse = {
  status: "revoked" | string;
  user_id: number;
  ban_id: number;
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

export type UserVerifiedCommunity = {
  community_id: number;
  community_name: string | null;
  community_kind?: string | null;
  verified_at: string | null;
  method?: string | null;
};

export type UserVerifiedCommunityListResponse = {
  items: UserVerifiedCommunity[];
};

export type UserVerifiedCommunityRevokeResponse = {
  status: "revoked" | string;
  user_id: number;
  community_id: number;
};

export type UserSpecializationCooldownResetResponse = {
  status: "reset" | string;
  user_id: number;
  specialization_type: "major" | "department" | string;
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

export type ActiveUsersKpiItem = {
  day: string;
  dau?: number | null;
  mau_30d?: number | null;
  dau_mau_ratio?: number | null;
  [key: string]: unknown;
};

export type ActiveUsersKpiResponse = {
  items: ActiveUsersKpiItem[];
  [key: string]: unknown;
};

export type CommunityHealthDailyKpiItem = {
  day: string;
  posts_count?: number | null;
  comments_count?: number | null;
  post_likes_count?: number | null;
  post_shares_count?: number | null;
  unique_posters?: number | null;
  unique_commenters?: number | null;
  unique_post_likers?: number | null;
  unique_post_sharers?: number | null;
  comment_to_post_ratio?: number | null;
  [key: string]: unknown;
};

export type CommunityHealthDailyKpiResponse = {
  community_id: number;
  items: CommunityHealthDailyKpiItem[];
  [key: string]: unknown;
};

export type CommunityRetentionKpiItem = {
  cohort_day: string;
  cohort_size?: number | null;
  retained_d1?: number | null;
  retained_d7?: number | null;
  retained_d30?: number | null;
  retention_d1?: number | null;
  retention_d7?: number | null;
  retention_d30?: number | null;
  [key: string]: unknown;
};

export type CommunityRetentionKpiResponse = {
  community_id: number;
  items: CommunityRetentionKpiItem[];
  [key: string]: unknown;
};

export type TrustSafetyKpiResponse = {
  total_users?: number | null;
  verified_users_global?: number | null;
  verified_users_any_community?: number | null;
  verified_percent_global?: number | null;
  verified_percent_any_community?: number | null;
  posts_total?: number | null;
  posts_anon?: number | null;
  posts_anon_rate?: number | null;
  comments_total?: number | null;
  comments_anon?: number | null;
  comments_anon_rate?: number | null;
  likes_total?: number | null;
  likes_anon?: number | null;
  likes_anon_rate?: number | null;
  appeals_reviewed?: number | null;
  appeals_approved?: number | null;
  appeal_success_rate?: number | null;
  [key: string]: unknown;
};

export type ContentCreationDailyKpiItem = {
  day: string;
  active_users?: number | null;
  creators?: number | null;
  creator_rate?: number | null;
  [key: string]: unknown;
};

export type ContentCreationDailyKpiResponse = {
  items: ContentCreationDailyKpiItem[];
  [key: string]: unknown;
};

export type CommunitiesPostsPerActiveDailyKpiItem = {
  day: string;
  posts_count?: number | null;
  active_communities?: number | null;
  posts_per_active_community?: number | null;
  [key: string]: unknown;
};

export type CommunitiesPostsPerActiveDailyKpiResponse = {
  items: CommunitiesPostsPerActiveDailyKpiItem[];
  [key: string]: unknown;
};

export type PostsUniqueParticipantsKpiResponse = {
  posts_count?: number | null;
  avg_unique_participants_per_post?: number | null;
  p50_unique_participants_per_post?: number | null;
  p90_unique_participants_per_post?: number | null;
  [key: string]: unknown;
};

export type RetentionByKindKpiItem = {
  kind: string;
  cohort_day: string;
  cohort_size?: number | null;
  retained_d1?: number | null;
  retained_d7?: number | null;
  retained_d30?: number | null;
  retention_d1?: number | null;
  retention_d7?: number | null;
  retention_d30?: number | null;
  [key: string]: unknown;
};

export type RetentionByKindKpiResponse = {
  items: RetentionByKindKpiItem[];
  [key: string]: unknown;
};

export type GrowthUsersDailyKpiItem = {
  day: string;
  new_users?: number | null;
  deleted_users?: number | null;
  [key: string]: unknown;
};

export type GrowthUsersDailyKpiResponse = {
  items: GrowthUsersDailyKpiItem[];
  [key: string]: unknown;
};

export type GrowthUsersWeeklyKpiItem = {
  week_start: string;
  new_users?: number | null;
  deleted_users?: number | null;
  [key: string]: unknown;
};

export type GrowthUsersWeeklyKpiResponse = {
  items: GrowthUsersWeeklyKpiItem[];
  [key: string]: unknown;
};

export type ModerationRepeatOffendersKpiResponse = {
  repeat_offenders?: number | null;
  total_offenders?: number | null;
  repeat_offender_rate?: number | null;
  bans_total?: number | null;
  post_removals_total?: number | null;
  [key: string]: unknown;
};

export type TimeToFirstActionsKpiResponse = {
  p50_seconds_to_first_action?: number | null;
  p90_seconds_to_first_action?: number | null;
  p50_seconds_to_first_verification?: number | null;
  p90_seconds_to_first_verification?: number | null;
  [key: string]: unknown;
};

export type VerificationToFirstActionsKpiResponse = {
  p50_seconds_to_first_like?: number | null;
  p90_seconds_to_first_like?: number | null;
  p50_seconds_to_first_comment?: number | null;
  p90_seconds_to_first_comment?: number | null;
  p50_seconds_to_first_post?: number | null;
  p90_seconds_to_first_post?: number | null;
  [key: string]: unknown;
};

export type NorthStarUniqueInteractionsKpiResponse = {
  unique_interactions?: number | null;
  unique_users?: number | null;
  interaction_edges?: number | null;
  [key: string]: unknown;
};

export type SupportTicketsKpiResponse = {
  tickets_total?: number | null;
  tickets_per_1000_users?: number | null;
  users_total?: number | null;
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
