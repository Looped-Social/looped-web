import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  banAdminUser,
  fetchAdminUser,
  fetchAdminUsers,
  unbanAdminUser,
} from "../lib/adminApi";
import type { UserDetail, UserListItem } from "../types/admin";
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
  const [banDuration, setBanDuration] = useState("");
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
    setBanDuration("");
  }, [selectedItem?.id]);

  const handleBan = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const duration = Number(banDuration);
      const durationSeconds =
        banDuration && Number.isFinite(duration) ? duration * 3600 : undefined;
      await banAdminUser(selectedItem.id, {
        duration_seconds: durationSeconds,
        reason: banReason.trim() || undefined,
      });
      setBanReason("");
      setBanDuration("");
      setConfirmBan(false);
      await fetchDetail(selectedItem.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to ban user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnban = async () => {
    if (!selectedItem) return;
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
                      item.ban?.status ?? "active"
                    )}`}
                  >
                    {formatStatusLabel(item.ban?.status ?? "active")}
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
                      selectedDetail?.ban?.status ?? selectedItem.ban?.status ?? "active"
                    )}`}
                  >
                    {formatStatusLabel(
                      selectedDetail?.ban?.status ?? selectedItem.ban?.status ?? "active"
                    )}
                  </span>
                </div>
                {(selectedDetail?.ban?.expires_at || selectedItem.ban?.expires_at) && (
                  <p className="text-xs text-text-light">
                    Expires{" "}
                    {formatDate(selectedDetail?.ban?.expires_at ?? selectedItem.ban?.expires_at)}
                  </p>
                )}
                {selectedDetail?.ban?.created_at && (
                  <p className="text-xs text-text-light">
                    Banned {formatDate(selectedDetail.ban.created_at)}
                  </p>
                )}
                {selectedDetail?.ban?.reason && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Reason: {selectedDetail.ban.reason}
                  </p>
                )}
                {selectedDetail?.ban?.created_by && (
                  <p className="text-xs text-text-light">
                    Banned by admin #{selectedDetail.ban.created_by}
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
                  placeholder="Reason for ban (optional)"
                  className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  value={banDuration}
                  onChange={(event) => setBanDuration(event.target.value)}
                  placeholder="Duration in hours (optional)"
                  className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
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
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
