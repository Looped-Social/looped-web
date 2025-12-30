import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  banAdminUser,
  dismissReport,
  fetchAdminPost,
  fetchAdminReports,
  removeAdminPost,
  resolveReport,
} from "../lib/adminApi";
import type { PostDetail, ReportItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const statusOptions = ["open", "resolved", "dismissed"] as const;
const targetOptions = ["all", "post", "user", "comment"] as const;
const sortOptions = [
  { label: "Newest first", value: "created_at_desc" },
  { label: "Oldest first", value: "created_at_asc" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "open":
      return "bg-brand/10 text-brand";
    case "resolved":
      return "bg-bg-muted text-text-secondary";
    case "dismissed":
      return "bg-bg-muted text-text-secondary";
    default:
      return "bg-bg-muted text-text-secondary";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function ReportsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canViewReports = admin.permissions.includes("view_reports");
  const canResolve = admin.permissions.includes("resolve_reports");
  const canRemovePost = admin.permissions.includes("remove_post");
  const canBanUser = admin.permissions.includes("ban_user");

  const [status, setStatus] = useState<(typeof statusOptions)[number]>("open");
  const [targetType, setTargetType] = useState<(typeof targetOptions)[number]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<(typeof sortOptions)[number]["value"]>("created_at_desc");
  const [items, setItems] = useState<ReportItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "remove_post" | "ban_user" | "dismiss_report" | null
  >(null);
  const [resolveReason, setResolveReason] = useState("");
  const [dismissReason, setDismissReason] = useState("");
  const [removeReason, setRemoveReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("");
  const [postDetail, setPostDetail] = useState<PostDetail | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const selectedReport = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );
  const canTakeAction = canResolve && selectedReport?.status === "open";

  const appliedFilters = useMemo(() => {
    const filters: Array<{ label: string; onClear: () => void }> = [];
    if (status !== "open") {
      filters.push({ label: `Status: ${status}`, onClear: () => setStatus("open") });
    }
    if (targetType !== "all") {
      filters.push({ label: `Target: ${targetType}`, onClear: () => setTargetType("all") });
    }
    if (dateFrom) {
      filters.push({ label: `From: ${dateFrom}`, onClear: () => setDateFrom("") });
    }
    if (dateTo) {
      filters.push({ label: `To: ${dateTo}`, onClear: () => setDateTo("") });
    }
    if (sort !== "created_at_desc") {
      const label = sortOptions.find((option) => option.value === sort)?.label ?? sort;
      filters.push({ label: `Sort: ${label}`, onClear: () => setSort("created_at_desc") });
    }
    return filters;
  }, [dateFrom, dateTo, sort, status, targetType]);

  useEffect(() => {
    setConfirmAction(null);
    setActionError(null);
    setResolveReason("");
    setDismissReason("");
    setRemoveReason("");
    setBanReason("");
    setBanDuration("");
  }, [selectedReport?.id]);

  useEffect(() => {
    if (!canViewReports) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchAdminReports(status, targetType === "all" ? undefined : targetType, undefined, 20, {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      sort,
    })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
        setSelectedId(res.items[0]?.id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load reports.");
        setItems([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canViewReports, status, targetType, dateFrom, dateTo, sort]);

  useEffect(() => {
    if (!selectedReport || selectedReport.target_type !== "post") {
      setPostDetail(null);
      setPostError(null);
      return;
    }
    let active = true;
    fetchAdminPost(selectedReport.target_id)
      .then((detail) => {
        if (!active) return;
        setPostDetail(detail);
      })
      .catch((err) => {
        if (!active) return;
        setPostError(err instanceof Error ? err.message : "Unable to load post details.");
      });
    return () => {
      active = false;
    };
  }, [selectedReport]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminReports(
        status,
        targetType === "all" ? undefined : targetType,
        nextCursor,
        20,
        { from: dateFrom || undefined, to: dateTo || undefined, sort }
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more reports.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport) return;
    if (!window.confirm("Resolve this report?")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await resolveReport(selectedReport.id, resolveReason.trim() || undefined);
      setItems((prev) => {
        if (status === "open") {
          return prev.filter((item) => item.id !== selectedReport.id);
        }
        return prev.map((item) =>
          item.id === selectedReport.id ? { ...item, status: "resolved" } : item
        );
      });
      setResolveReason("");
      setConfirmAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to resolve report.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;
    if (!dismissReason.trim()) {
      setActionError("Add a dismissal reason before confirming.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await dismissReport(selectedReport.id, dismissReason.trim());
      setItems((prev) => {
        if (status === "open") {
          return prev.filter((item) => item.id !== selectedReport.id);
        }
        return prev.map((item) =>
          item.id === selectedReport.id ? { ...item, status: "dismissed" } : item
        );
      });
      setDismissReason("");
      setConfirmAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to dismiss report.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePost = async () => {
    if (!selectedReport || selectedReport.target_type !== "post") return;
    if (!removeReason.trim()) {
      setActionError("Add a removal reason before confirming.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await removeAdminPost(selectedReport.target_id, removeReason.trim());
      setRemoveReason("");
      setConfirmAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to remove post.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBanUser = async () => {
    if (!selectedReport || selectedReport.target_type !== "user") return;
    setIsSaving(true);
    setActionError(null);
    try {
      const duration = Number(banDuration);
      const durationSeconds =
        banDuration && Number.isFinite(duration) ? duration * 3600 : undefined;
      await banAdminUser(selectedReport.target_id, {
        duration_seconds: durationSeconds,
        reason: banReason.trim() || undefined,
      });
      setBanReason("");
      setBanDuration("");
      setConfirmAction(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to ban user.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewReports) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Reports queue</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to view reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">
            Reports
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">Moderate reported content</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review reports and take action on posts or users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-2 py-1 text-sm text-text-secondary">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-full px-3 py-1 transition ${
                  status === option
                    ? "bg-brand text-white"
                    : "hover:text-text-primary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-2 py-1 text-sm text-text-secondary">
            {targetOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTargetType(option)}
                className={`rounded-full px-3 py-1 transition ${
                  targetType === option
                    ? "bg-brand text-white"
                    : "hover:text-text-primary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary ">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-light">
            From
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-light">
            To
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-light">
            Sort
          </span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as (typeof sortOptions)[number]["value"])
            }
            className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Clear dates
          </button>
        )}
      </div>

      {appliedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-light">Applied filters:</span>
          {appliedFilters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={filter.onClear}
              className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
            >
              {filter.label} x
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setStatus("open");
              setTargetType("all");
              setDateFrom("");
              setDateTo("");
              setSort("created_at_desc");
            }}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          {error && (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="text-sm font-semibold text-text-primary">Unable to load reports.</p>
              <p className="mt-1 text-xs text-text-light">
                Try adjusting filters or refresh the page.
              </p>
              <details className="mt-2 text-xs text-text-light">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-2 whitespace-pre-wrap">{error}</p>
              </details>
            </div>
          )}
          {isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading reports...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No reports match the current filters. Try adjusting the date range or status.
            </div>
          )}

          {items.map((item) => {
            const isActive = item.id === selectedReport?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
                  isActive
                    ? "border-brand/60 bg-bg-muted/60"
                    : "border-border bg-bg hover:border-brand/40"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {item.reason}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Reporter: {item.reporter_handle ?? "Unknown"}
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                    {item.target_type} #{item.target_id}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-light">
                  <span>Opened {formatDate(item.created_at)}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      item.status
                    )}`}
                  >
                    {formatStatusLabel(item.status)}
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
          <h2 className="text-lg font-semibold text-strong">Report details</h2>
          {!selectedReport ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select a report to review details.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase text-text-light">
                  Report
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedReport.reason}
                </p>
                <p className="text-xs text-text-light">
                  Reporter: {selectedReport.reporter_handle ?? "Unknown"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Target
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedReport.target_type} #{selectedReport.target_id}
                </p>
                {selectedReport.target_type === "post" && postDetail?.content && (
                  <p className="mt-2 max-h-16 overflow-hidden text-xs text-text-secondary">
                    {postDetail.content}
                  </p>
                )}
                {selectedReport.target_type === "post" && postError && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Unable to load post details.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Status
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Current status</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      selectedReport.status
                    )}`}
                  >
                    {formatStatusLabel(selectedReport.status)}
                  </span>
                </div>
                {selectedReport.resolved_at && (
                  <p className="mt-2 text-xs text-text-light">
                    Reviewed {formatDate(selectedReport.resolved_at)}
                  </p>
                )}
                {selectedReport.resolved_by && (
                  <p className="text-xs text-text-light">
                    Reviewed by admin #{selectedReport.resolved_by}
                  </p>
                )}
                {selectedReport.resolved_reason && (
                  <p className="mt-2 text-xs text-text-secondary">
                    {selectedReport.status === "dismissed"
                      ? "Dismissal reason"
                      : "Resolution note"}
                    : {selectedReport.resolved_reason}
                  </p>
                )}
              </div>

              {canResolve && selectedReport.status !== "open" && (
                <div className="rounded-xl border border-border bg-bg-muted/40 px-3 py-2 text-xs text-text-secondary">
                  This report is already {formatStatusLabel(selectedReport.status)}.
                </div>
              )}

              {canTakeAction && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase text-text-light">
                    Resolve note
                  </label>
                  <textarea
                    value={resolveReason}
                    onChange={(event) => setResolveReason(event.target.value)}
                    rows={2}
                    placeholder="Add an optional resolution note..."
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <label className="text-xs font-semibold uppercase text-text-light">
                    Dismiss reason
                  </label>
                  <input
                    value={dismissReason}
                    onChange={(event) => setDismissReason(event.target.value)}
                    placeholder="Why this report was dismissed..."
                    className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              )}

              {actionError && (
                <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                  {actionError}
                </p>
              )}

              <div className="grid gap-2">
                {canTakeAction && (
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={isSaving}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Resolve report"}
                  </button>
                )}
                {canTakeAction && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!dismissReason.trim()) {
                        setActionError("Add a dismissal reason before confirming.");
                        return;
                      }
                      if (confirmAction !== "dismiss_report") {
                        setConfirmAction("dismiss_report");
                        return;
                      }
                      handleDismiss();
                    }}
                    disabled={isSaving}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmAction === "dismiss_report"
                      ? "Confirm dismiss report"
                      : "Dismiss report"}
                  </button>
                )}
                {confirmAction === "dismiss_report" && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                  >
                    Cancel
                  </button>
                )}
                {selectedReport.target_type === "post" && canRemovePost && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light">
                      Removal reason
                    </label>
                    <input
                      value={removeReason}
                      onChange={(event) => setRemoveReason(event.target.value)}
                      placeholder="Reason for removing post..."
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!removeReason.trim()) {
                          setActionError("Add a removal reason before confirming.");
                          return;
                        }
                        if (confirmAction !== "remove_post") {
                          setConfirmAction("remove_post");
                          return;
                        }
                        handleRemovePost();
                      }}
                      disabled={isSaving}
                      className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {confirmAction === "remove_post" ? "Confirm remove post" : "Remove post"}
                    </button>
                    {confirmAction === "remove_post" && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                {selectedReport.target_type === "user" && canBanUser && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-text-light">
                      Ban user
                    </label>
                    <input
                      value={banReason}
                      onChange={(event) => setBanReason(event.target.value)}
                      placeholder="Ban reason (optional)"
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <input
                      value={banDuration}
                      onChange={(event) => setBanDuration(event.target.value)}
                      placeholder="Duration in hours (optional)"
                      className="w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmAction !== "ban_user") {
                          setConfirmAction("ban_user");
                          return;
                        }
                        handleBanUser();
                      }}
                      disabled={isSaving}
                      className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {confirmAction === "ban_user" ? "Confirm ban user" : "Ban user"}
                    </button>
                    {confirmAction === "ban_user" && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
