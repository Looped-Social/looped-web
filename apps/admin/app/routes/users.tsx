import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  banAdminUser,
  createAdminUserCommunityBans,
  fetchAdminCommunities,
  fetchAdminUser,
  fetchAdminUserCommunityBans,
  fetchAdminUsers,
  revokeAdminUserCommunityBan,
  unbanAdminUser,
} from "../lib/adminApi";
import type { AdminCommunity, UserCommunityBan, UserDetail, UserListItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "banned":
      return "bg-brand/10 text-brand";
    case "active":
      return "bg-bg-muted text-text-secondary";
    default:
      return "bg-bg-muted text-text-secondary";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatCommunityBanScope(value: string) {
  if (value === "all_communities") return "All communities";
  if (value === "community") return "Community";
  return value.replace(/_/g, " ");
}

function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [datePart, timePart] = trimmed.split("T");
  if (!datePart || !timePart) return null;
  const [yearRaw, monthRaw, dayRaw] = datePart.split("-");
  const [hourRaw, minuteRaw] = timePart.split(":");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const RECENT_SEARCHES_KEY = "looped-admin-user-searches";

export default function UsersRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canBan = admin.permissions.includes("ban_user");

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<UserListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banExpiryMode, setBanExpiryMode] = useState<"permanent" | "duration" | "expires_at">(
    "permanent"
  );
  const [banDurationValue, setBanDurationValue] = useState("");
  const [banDurationUnit, setBanDurationUnit] = useState<"hours" | "days">("days");
  const [banExpiresAt, setBanExpiresAt] = useState("");
  const [communityBans, setCommunityBans] = useState<UserCommunityBan[]>([]);
  const [communityBansView, setCommunityBansView] = useState<"active" | "all">("active");
  const [communityBansError, setCommunityBansError] = useState<string | null>(null);
  const [isCommunityBansLoading, setIsCommunityBansLoading] = useState(false);
  const [communityBanScope, setCommunityBanScope] = useState<"selected" | "all_communities">(
    "selected"
  );
  const [communityBanReason, setCommunityBanReason] = useState("");
  const [communityBanDurationDays, setCommunityBanDurationDays] = useState("");
  const [communityBanCommunityIdInput, setCommunityBanCommunityIdInput] = useState("");
  const [communityBanSelected, setCommunityBanSelected] = useState<
    { id: number; label: string }[]
  >([]);
  const [communitySearchQuery, setCommunitySearchQuery] = useState("");
  const [communitySearchResults, setCommunitySearchResults] = useState<AdminCommunity[]>([]);
  const [communitySearchError, setCommunitySearchError] = useState<string | null>(null);
  const [isCommunitySearchLoading, setIsCommunitySearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );
  const moderationStats = selectedDetail?.moderation_stats ?? null;
  const currentBan = selectedDetail?.ban ?? selectedItem?.ban ?? null;
  const currentBanStatus = currentBan?.status ?? (currentBan ? "banned" : "active");

  const updateRecentSearches = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(
      0,
      4
    );
    setRecentSearches(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    }
  };

  const runSearch = async (rawQuery?: string) => {
    const nextQuery = (rawQuery ?? query).trim();
    if (!nextQuery) {
      setItems([]);
      setNextCursor(null);
      setSelectedId(null);
      setSelectedDetail(null);
      setIsDetailLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    updateRecentSearches(nextQuery);
    try {
      const res = await fetchAdminUsers(nextQuery);
      setItems(res.items);
      setNextCursor(res.next_cursor ?? null);
      if (res.items[0]?.id) {
        void fetchDetail(res.items[0].id);
      } else {
        setSelectedId(null);
        setSelectedDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search users.");
      setItems([]);
      setNextCursor(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminUsers(query.trim(), nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more users.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetail = async (id: number) => {
    setSelectedId(id);
    setSelectedDetail(null);
    setIsDetailLoading(true);
    setCommunityBans([]);
    setCommunityBansError(null);
    try {
      const detail = await fetchAdminUser(id);
      setSelectedDetail(detail);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to load user detail.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    setConfirmBan(false);
    setActionError(null);
    setBanReason("");
    setBanExpiryMode("permanent");
    setBanDurationValue("");
    setBanDurationUnit("days");
    setBanExpiresAt("");
    setCommunityBansError(null);
    setCommunityBansView("active");
    setCommunityBanScope("selected");
    setCommunityBanReason("");
    setCommunityBanDurationDays("");
    setCommunityBanCommunityIdInput("");
    setCommunityBanSelected([]);
    setCommunitySearchQuery("");
    setCommunitySearchResults([]);
    setCommunitySearchError(null);
    setIsCommunitySearchLoading(false);
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!selectedItem) return;
    setIsCommunityBansLoading(true);
    setCommunityBansError(null);
    fetchAdminUserCommunityBans(selectedItem.id, communityBansView === "active")
      .then((res) => setCommunityBans(res.items ?? []))
      .catch((err) =>
        setCommunityBansError(err instanceof Error ? err.message : "Unable to load community bans.")
      )
      .finally(() => setIsCommunityBansLoading(false));
  }, [communityBansView, selectedItem?.id]);

  useEffect(() => {
    if (communityBanScope !== "selected") return;
    const rawQuery = communitySearchQuery.trim();
    if (rawQuery.length < 2) {
      setCommunitySearchResults([]);
      setCommunitySearchError(null);
      setIsCommunitySearchLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      setIsCommunitySearchLoading(true);
      setCommunitySearchError(null);
      fetchAdminCommunities(rawQuery, undefined, 10)
        .then((res) => setCommunitySearchResults(res.items ?? []))
        .catch((err) =>
          setCommunitySearchError(
            err instanceof Error ? err.message : "Unable to search communities."
          )
        )
        .finally(() => setIsCommunitySearchLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [communityBanScope, communitySearchQuery]);

  const handleBan = async () => {
    if (!selectedItem) return;
    const trimmedReason = banReason.trim();
    if (!trimmedReason) {
      setActionError("Ban reason is required.");
      return;
    }

    let durationSeconds: number | undefined;
    let expiresAtIso: string | undefined;
    if (banExpiryMode === "duration") {
      const parsed = Number(banDurationValue.trim());
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setActionError("Duration must be a positive whole number.");
        return;
      }
      durationSeconds = banDurationUnit === "hours" ? parsed * 3600 : parsed * 86400;
    }
    if (banExpiryMode === "expires_at") {
      const iso = datetimeLocalToIso(banExpiresAt);
      if (!iso) {
        setActionError("Enter a valid expires at date/time.");
        return;
      }
      expiresAtIso = iso;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      await banAdminUser(selectedItem.id, {
        ...(typeof durationSeconds === "number" ? { duration_seconds: durationSeconds } : {}),
        ...(expiresAtIso ? { expires_at: expiresAtIso } : {}),
        reason: trimmedReason,
      });
      setBanReason("");
      setBanExpiryMode("permanent");
      setBanDurationValue("");
      setBanDurationUnit("days");
      setBanExpiresAt("");
      setConfirmBan(false);
      await fetchDetail(selectedItem.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to ban user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCommunityBan = async () => {
    if (!selectedItem) return;
    const reason = communityBanReason.trim();
    if (!reason) {
      setActionError("Community ban reason is required.");
      return;
    }

    const durationRaw = communityBanDurationDays.trim();
    let durationSeconds: number | undefined;
    if (durationRaw) {
      const parsed = Number(durationRaw);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setActionError("Community ban duration must be a positive whole number of days.");
        return;
      }
      durationSeconds = parsed * 86400;
    }

    const selectedIds = communityBanSelected.map((item) => item.id);
    if (communityBanScope === "selected" && selectedIds.length === 0) {
      setActionError("Select at least one community id.");
      return;
    }

    const confirmation =
      communityBanScope === "all_communities"
        ? "Ban this user from all communities?"
        : `Ban this user from ${selectedIds.length} community(ies)?`;
    if (!window.confirm(confirmation)) return;

    setIsSaving(true);
    setActionError(null);
    try {
      await createAdminUserCommunityBans(selectedItem.id, {
        ...(communityBanScope === "all_communities"
          ? { allCommunities: true }
          : { communityIds: selectedIds }),
        reason,
        ...(typeof durationSeconds === "number" ? { duration_seconds: durationSeconds } : {}),
      });
      setCommunityBanReason("");
      setCommunityBanDurationDays("");
      setCommunityBanCommunityIdInput("");
      setCommunityBanSelected([]);
      const res = await fetchAdminUserCommunityBans(selectedItem.id, communityBansView === "active");
      setCommunityBans(res.items ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to create community ban.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeCommunityBan = async (banId: number) => {
    if (!selectedItem) return;
    if (!window.confirm("Revoke this community ban?")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await revokeAdminUserCommunityBan(selectedItem.id, banId);
      const res = await fetchAdminUserCommunityBans(selectedItem.id, communityBansView === "active");
      setCommunityBans(res.items ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to revoke community ban.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnban = async () => {
    if (!selectedItem) return;
    if (!window.confirm("Unban this user?")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await unbanAdminUser(selectedItem.id);
      setConfirmBan(false);
      await fetchDetail(selectedItem.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to unban user.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canBan) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Users</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to moderate users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-text-light">Users</p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">Search and moderate users</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Find user accounts by handle, email, or id. Apply bans as needed.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg p-4 ">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              runSearch();
            }
          }}
          placeholder="Search by email, handle, or user id"
          className="min-w-[240px] flex-1 rounded-full border border-border bg-bg px-4 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={() => runSearch()}
          disabled={isLoading}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {recentSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-light">Recent searches:</span>
          {recentSearches.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setQuery(value);
                runSearch(value);
              }}
              className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setRecentSearches([]);
              if (typeof window !== "undefined") {
                localStorage.removeItem(RECENT_SEARCHES_KEY);
              }
            }}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          {error && (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="text-sm font-semibold text-text-primary">
                Unable to load user results.
              </p>
              <p className="mt-1 text-xs text-text-light">
                Double-check the query and try again.
              </p>
              <details className="mt-2 text-xs text-text-light">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-2 whitespace-pre-wrap">{error}</p>
              </details>
            </div>
          )}
          {isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Searching users...
            </div>
          )}
          {!isLoading && query && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No users found for this query. Try an email, handle, or numeric id.
            </div>
          )}
          {!query && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Enter a query or press Enter to search for a user account.
            </div>
          )}

          {items.map((item) => {
            const isActive = item.id === selectedItem?.id;
            const banStatus = item.ban?.status ?? (item.ban ? "banned" : "active");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => fetchDetail(item.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
                  isActive
                    ? "border-brand/60 bg-bg-muted/60"
                    : "border-border bg-bg hover:border-brand/40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {item.handle ?? "Unknown handle"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {item.email ?? "Email unavailable"}
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                    #{item.id}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-light">
                  <span>Joined {formatDate(item.created_at)}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      banStatus
                    )}`}
                  >
                    {formatStatusLabel(banStatus)}
                  </span>
                </div>
              </button>
            );
          })}

          {nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="w-full rounded-full border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </section>

        <aside className="rounded-2xl border border-border bg-bg p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-strong">User details</h2>
          {!selectedItem ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select a user to see their details.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase text-text-light">
                  Account
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedDetail?.handle ?? selectedItem.handle ?? "Unknown handle"}
                </p>
                <p className="text-xs text-text-light">
                  {selectedDetail?.email ?? selectedItem.email ?? "Email unavailable"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Verification
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedDetail?.verification?.verified ? "Verified" : "Not verified"}
                </p>
                {selectedDetail?.verification?.method && (
                  <p className="text-xs text-text-light">
                    Method: {selectedDetail.verification.method}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Ban status
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Current status</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      currentBanStatus
                    )}`}
                  >
                    {formatStatusLabel(currentBanStatus)}
                  </span>
                </div>
                {currentBanStatus === "banned" && currentBan?.expires_at && (
                  <p className="text-xs text-text-light">
                    Expires {formatDate(currentBan.expires_at)}
                  </p>
                )}
                {currentBanStatus === "banned" && currentBan?.created_at && (
                  <p className="text-xs text-text-light">
                    Banned {formatDate(currentBan.created_at)}
                  </p>
                )}
                {currentBanStatus === "banned" && currentBan?.reason && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Reason: {currentBan.reason}
                  </p>
                )}
                {currentBanStatus === "banned" && currentBan?.created_by && (
                  <p className="text-xs text-text-light">
                    Banned by admin #{currentBan.created_by}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Moderation stats
                </p>
                {moderationStats ? (
                  <div className="mt-3 space-y-3 text-xs text-text-secondary">
                    {[
                      {
                        title: "Posts",
                        stats: [
                          { label: "Total posts", value: moderationStats.posts_total },
                          {
                            label: "Removed posts",
                            value: moderationStats.posts_removed_total,
                          },
                        ],
                      },
                      {
                        title: "Reports against user",
                        stats: [
                          {
                            label: "Total",
                            value: moderationStats.reports_against_user_total,
                          },
                          {
                            label: "Open",
                            value: moderationStats.reports_against_user_open,
                          },
                          {
                            label: "Resolved",
                            value: moderationStats.reports_against_user_resolved,
                          },
                          {
                            label: "Dismissed",
                            value: moderationStats.reports_against_user_dismissed,
                          },
                        ],
                      },
                      {
                        title: "Reports against posts",
                        stats: [
                          {
                            label: "Total",
                            value: moderationStats.reports_against_posts_total,
                          },
                          {
                            label: "Open",
                            value: moderationStats.reports_against_posts_open,
                          },
                          {
                            label: "Resolved",
                            value: moderationStats.reports_against_posts_resolved,
                          },
                          {
                            label: "Dismissed",
                            value: moderationStats.reports_against_posts_dismissed,
                          },
                        ],
                      },
                      {
                        title: "Reports filed",
                        stats: [
                          {
                            label: "Total",
                            value: moderationStats.reports_filed_total,
                          },
                          {
                            label: "Open",
                            value: moderationStats.reports_filed_open,
                          },
                          {
                            label: "Resolved",
                            value: moderationStats.reports_filed_resolved,
                          },
                          {
                            label: "Dismissed",
                            value: moderationStats.reports_filed_dismissed,
                          },
                        ],
                      },
                    ].map((group) => (
                      <div key={group.title}>
                        <p className="text-xs font-semibold text-text-light">
                          {group.title}
                        </p>
                        <div className="mt-2 space-y-1">
                          {group.stats.map((stat) => (
                            <div
                              key={stat.label}
                              className="flex items-center justify-between"
                            >
                              <span>{stat.label}</span>
                              <span className="font-semibold text-text-primary">
                                {formatNumber(stat.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isDetailLoading ? (
                  <p className="mt-2 text-xs text-text-secondary">
                    Loading moderation stats...
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-text-secondary">
                    No moderation stats available yet.
                  </p>
                )}
              </div>

              {actionError && (
                <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                  {actionError}
                </p>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-text-light">
                  Ban reason
                </label>
                <input
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                  placeholder="Reason for ban"
                  className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <div className="space-y-2 rounded-2xl border border-border bg-bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase text-text-light">Ban duration</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Permanent", value: "permanent" },
                      { label: "Duration", value: "duration" },
                      { label: "Expires at", value: "expires_at" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setBanExpiryMode(
                            option.value as "permanent" | "duration" | "expires_at"
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          banExpiryMode === option.value
                            ? "border-brand/40 bg-brand/10 text-brand"
                            : "border-border bg-bg text-text-secondary hover:bg-bg-muted"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {banExpiryMode === "duration" && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={banDurationValue}
                        onChange={(event) => setBanDurationValue(event.target.value)}
                        placeholder="7"
                        inputMode="numeric"
                        className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                      <select
                        value={banDurationUnit}
                        onChange={(event) =>
                          setBanDurationUnit(event.target.value as "hours" | "days")
                        }
                        className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-36"
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  )}

                  {banExpiryMode === "expires_at" && (
                    <input
                      type="datetime-local"
                      value={banExpiresAt}
                      onChange={(event) => setBanExpiresAt(event.target.value)}
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmBan) {
                        setConfirmBan(true);
                        return;
                      }
                      handleBan();
                    }}
                    disabled={isSaving}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : confirmBan ? "Confirm ban" : "Ban user"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnban}
                    disabled={isSaving}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Unban
                  </button>
                </div>
                  {confirmBan && (
                    <button
                      type="button"
                      onClick={() => setConfirmBan(false)}
                      className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                </div>

              <div className="rounded-2xl border border-border bg-bg px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-light">Community bans</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Blocks actions in scoped communities and filters those communities from feeds.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-2 py-1 text-xs text-text-secondary">
                    {[
                      { label: "Active", value: "active" },
                      { label: "All", value: "all" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCommunityBansView(option.value as "active" | "all")}
                        className={`rounded-full px-3 py-1 transition ${
                          communityBansView === option.value
                            ? "bg-brand text-white"
                            : "hover:text-text-primary"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {communityBansError && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                    {communityBansError}
                  </p>
                )}

                {isCommunityBansLoading ? (
                  <p className="mt-3 text-xs text-text-secondary">Loading community bans...</p>
                ) : communityBans.length === 0 ? (
                  <p className="mt-3 text-xs text-text-secondary">No community bans.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {communityBans.map((ban) => {
                      const label =
                        ban.scope === "all_communities"
                          ? "All communities"
                          : ban.community_name
                            ? `${ban.community_name} (#${ban.community_id ?? "?"})`
                            : ban.community_id
                              ? `Community #${ban.community_id}`
                              : "Community (unknown)";
                      return (
                        <div
                          key={ban.id}
                          className="rounded-xl border border-border bg-bg-muted/30 px-3 py-3 text-xs text-text-secondary"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-text-primary">{label}</p>
                              <p className="mt-1 text-[11px] text-text-light">
                                Scope: {formatCommunityBanScope(ban.scope)} · Ban #{ban.id}
                              </p>
                            </div>
                            {!ban.revoked_at && (
                              <button
                                type="button"
                                onClick={() => handleRevokeCommunityBan(ban.id)}
                                disabled={isSaving}
                                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-[11px] text-text-light">
                            <p>
                              <span className="font-semibold text-text-primary">Reason:</span>{" "}
                              {ban.reason ?? "N/A"}
                            </p>
                            <p>
                              <span className="font-semibold text-text-primary">Expires:</span>{" "}
                              {ban.expires_at ? formatDate(ban.expires_at) : "Never"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase text-text-light">Create</p>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Selected communities", value: "selected" },
                      { label: "All communities", value: "all_communities" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setCommunityBanScope(option.value as "selected" | "all_communities")
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          communityBanScope === option.value
                            ? "border-brand/40 bg-brand/10 text-brand"
                            : "border-border bg-bg text-text-secondary hover:bg-bg-muted"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {communityBanScope === "selected" && (
                    <div className="space-y-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-text-light">
                          Search communities (optional)
                        </label>
                        <input
                          value={communitySearchQuery}
                          onChange={(event) => setCommunitySearchQuery(event.target.value)}
                          placeholder="UNC Chapel Hill"
                          className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                        {communitySearchError && (
                          <p className="text-xs text-brand">{communitySearchError}</p>
                        )}
                        {isCommunitySearchLoading && (
                          <p className="text-xs text-text-secondary">Searching...</p>
                        )}
                        {!isCommunitySearchLoading && communitySearchResults.length > 0 && (
                          <div className="space-y-2">
                            {communitySearchResults.map((community) => (
                              <button
                                key={community.id}
                                type="button"
                                onClick={() =>
                                  setCommunityBanSelected((prev) => {
                                    if (prev.some((item) => item.id === community.id)) return prev;
                                    return [
                                      ...prev,
                                      {
                                        id: community.id,
                                        label: `${community.name} (#${community.id})`,
                                      },
                                    ];
                                  })
                                }
                                className="flex w-full items-center justify-between rounded-xl border border-border bg-bg px-3 py-2 text-left text-xs text-text-secondary transition hover:bg-bg-muted"
                              >
                                <span className="font-semibold text-text-primary">
                                  {community.name}
                                </span>
                                <span className="text-xs text-text-light">#{community.id}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <label className="text-xs font-semibold uppercase text-text-light">
                        Community IDs
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={communityBanCommunityIdInput}
                          onChange={(event) => setCommunityBanCommunityIdInput(event.target.value)}
                          placeholder="42"
                          inputMode="numeric"
                          className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = Number(communityBanCommunityIdInput.trim());
                            if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
                              setActionError("Enter a valid community id.");
                              return;
                            }
                            setCommunityBanSelected((prev) => {
                              if (prev.some((item) => item.id === parsed)) return prev;
                              return [...prev, { id: parsed, label: `#${parsed}` }];
                            });
                            setCommunityBanCommunityIdInput("");
                          }}
                          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                        >
                          Add
                        </button>
                      </div>
                      {communityBanSelected.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {communityBanSelected.map((community) => (
                            <button
                              key={community.id}
                              type="button"
                              onClick={() =>
                                setCommunityBanSelected((prev) =>
                                  prev.filter((item) => item.id !== community.id)
                                )
                              }
                              className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
                            >
                              {community.label} · Remove
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light">
                      Reason
                    </label>
                    <input
                      value={communityBanReason}
                      onChange={(event) => setCommunityBanReason(event.target.value)}
                      placeholder="harassment"
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light">
                      Duration (days, optional)
                    </label>
                    <input
                      value={communityBanDurationDays}
                      onChange={(event) => setCommunityBanDurationDays(event.target.value)}
                      placeholder="7"
                      inputMode="numeric"
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateCommunityBan}
                    disabled={isSaving}
                    className="w-full rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Create community ban"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
