import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import { approveAppeal, fetchAdminAppeals, rejectAppeal } from "../lib/adminApi";
import type { AppealItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const statusOptions = ["open", "approved", "rejected"] as const;
const targetOptions = ["all", "user_ban", "post_removal"] as const;
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
    case "approved":
      return "bg-bg-muted text-text-secondary";
    case "rejected":
      return "bg-bg-muted text-text-secondary";
    default:
      return "bg-bg-muted text-text-secondary";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatActionLabel(value?: string | null) {
  if (!value) return "No action taken";
  switch (value) {
    case "user_unbanned":
      return "User unbanned";
    case "post_restored":
      return "Post restored";
    case "none":
      return "No action taken";
    default:
      return value.replace(/_/g, " ");
  }
}

export default function AppealsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canView = admin.permissions.includes("view_reports");
  const canResolve = admin.permissions.includes("resolve_reports");

  const [status, setStatus] = useState<(typeof statusOptions)[number]>("open");
  const [targetType, setTargetType] = useState<(typeof targetOptions)[number]>("all");
  const [sort, setSort] = useState<(typeof sortOptions)[number]["value"]>("created_at_desc");
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<AppealItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveReason, setApproveReason] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);
  const [approveAction, setApproveAction] = useState<{ id: number; action?: string | null } | null>(
    null
  );

  const selectedAppeal = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );
  const canTakeAction = canResolve && selectedAppeal?.status === "open";

  const parsedUserId = useMemo(() => {
    if (!userId.trim()) return undefined;
    const value = Number(userId);
    return Number.isFinite(value) ? value : null;
  }, [userId]);

  const appliedFilters = useMemo(() => {
    const filters: Array<{ label: string; onClear: () => void }> = [];
    if (status !== "open") {
      filters.push({ label: `Status: ${status}`, onClear: () => setStatus("open") });
    }
    if (targetType !== "all") {
      filters.push({ label: `Target: ${formatStatusLabel(targetType)}`, onClear: () => setTargetType("all") });
    }
    if (userId.trim()) {
      filters.push({ label: `User: ${userId.trim()}`, onClear: () => setUserId("") });
    }
    if (sort !== "created_at_desc") {
      const label = sortOptions.find((option) => option.value === sort)?.label ?? sort;
      filters.push({ label: `Sort: ${label}`, onClear: () => setSort("created_at_desc") });
    }
    return filters;
  }, [sort, status, targetType, userId]);

  useEffect(() => {
    setConfirmReject(false);
    setActionError(null);
    setRejectReason("");
    setApproveReason("");
    setApproveAction(null);
  }, [selectedAppeal?.id]);

  useEffect(() => {
    if (!canView) return;
    if (parsedUserId === null) {
      setError("Enter a numeric user id to filter by user.");
      setItems([]);
      setNextCursor(null);
      setSelectedId(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchAdminAppeals(
      status,
      targetType === "all" ? undefined : targetType,
      parsedUserId,
      undefined,
      20,
      sort
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
        setSelectedId(res.items[0]?.id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load appeals.");
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
  }, [canView, parsedUserId, sort, status, targetType]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    if (parsedUserId === null) {
      setError("Enter a numeric user id to filter by user.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetchAdminAppeals(
        status,
        targetType === "all" ? undefined : targetType,
        parsedUserId,
        nextCursor,
        20,
        sort
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more appeals.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemStatus = (id: number, nextStatus: string, reason?: string) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, status: nextStatus, reviewed_reason: reason ?? item.reviewed_reason }
          : item
      );
      return status === "open" ? updated.filter((item) => item.status === "open") : updated;
    });
  };

  const handleApprove = async () => {
    if (!selectedAppeal) return;
    if (!window.confirm("Approve this appeal?")) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const response = await approveAppeal(selectedAppeal.id, approveReason.trim() || undefined);
      updateItemStatus(selectedAppeal.id, "approved", approveReason.trim() || undefined);
      setApproveAction({ id: selectedAppeal.id, action: response.action ?? "none" });
      setApproveReason("");
      setConfirmReject(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to approve appeal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedAppeal) return;
    if (!rejectReason.trim()) {
      setActionError("Add a rejection reason before confirming.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await rejectAppeal(selectedAppeal.id, rejectReason.trim());
      updateItemStatus(selectedAppeal.id, "rejected", rejectReason.trim());
      setRejectReason("");
      setConfirmReject(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to reject appeal.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Appeals</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to view appeals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">Appeals</p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">
            Review ban and post appeals
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Approve or reject appeals submitted by users.
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
                  status === option ? "bg-brand text-white" : "hover:text-text-primary"
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
                  targetType === option ? "bg-brand text-white" : "hover:text-text-primary"
                }`}
              >
                {formatStatusLabel(option)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary ">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-text-light">
            User ID
          </span>
          <input
            type="number"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="Optional"
            className="w-32 rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
        {(userId || sort !== "created_at_desc") && (
          <button
            type="button"
            onClick={() => {
              setUserId("");
              setSort("created_at_desc");
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Clear filters
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
              setUserId("");
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
              <p className="text-sm font-semibold text-text-primary">Unable to load appeals.</p>
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
              Loading appeals...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No appeals match the current filters.
            </div>
          )}

          {items.map((item) => {
            const isActive = item.id === selectedAppeal?.id;
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
                      {item.user_handle ?? `User #${item.user_id}`}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {formatStatusLabel(item.target_type)} appeal
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                    #{item.id}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-light">
                  <span>Submitted {formatDate(item.created_at)}</span>
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
          <h2 className="text-lg font-semibold text-strong">Appeal details</h2>
          {!selectedAppeal ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select an appeal to review details.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase text-text-light">
                  User
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedAppeal.user_handle ?? "Unknown handle"}
                </p>
                <p className="text-xs text-text-light">User ID: {selectedAppeal.user_id}</p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Appeal target
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {formatStatusLabel(selectedAppeal.target_type)}
                </p>
                <p className="text-xs text-text-light">
                  Target ID: {selectedAppeal.target_id ?? "N/A"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Reason
                </p>
                <p className="mt-2 text-xs text-text-secondary">{selectedAppeal.reason}</p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Status
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Current status</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      selectedAppeal.status
                    )}`}
                  >
                    {formatStatusLabel(selectedAppeal.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-light">
                  Submitted {formatDate(selectedAppeal.created_at)}
                </p>
                {selectedAppeal.reviewed_at && (
                  <p className="text-xs text-text-light">
                    Reviewed {formatDate(selectedAppeal.reviewed_at)}
                  </p>
                )}
                {selectedAppeal.reviewed_by && (
                  <p className="text-xs text-text-light">
                    Reviewed by admin #{selectedAppeal.reviewed_by}
                  </p>
                )}
                {selectedAppeal.reviewed_reason && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Review note: {selectedAppeal.reviewed_reason}
                  </p>
                )}
                {approveAction?.id === selectedAppeal.id && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Action: {formatActionLabel(approveAction.action)}
                  </p>
                )}
              </div>

              {canResolve && selectedAppeal.status !== "open" && (
                <div className="rounded-xl border border-border bg-bg-muted/40 px-3 py-2 text-xs text-text-secondary">
                  This appeal is already {formatStatusLabel(selectedAppeal.status)}.
                </div>
              )}

              {canTakeAction && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase text-text-light">
                    Approve note
                  </label>
                  <textarea
                    value={approveReason}
                    onChange={(event) => setApproveReason(event.target.value)}
                    rows={2}
                    placeholder="Optional note for approval..."
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <label className="text-xs font-semibold uppercase text-text-light">
                    Reject reason
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    rows={2}
                    placeholder="Reason required to reject..."
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
                    onClick={handleApprove}
                    disabled={isSaving}
                    className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Approve appeal"}
                  </button>
                )}
                {canTakeAction && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!rejectReason.trim()) {
                        setActionError("Add a rejection reason before confirming.");
                        return;
                      }
                      if (!confirmReject) {
                        setConfirmReject(true);
                        return;
                      }
                      handleReject();
                    }}
                    disabled={isSaving}
                    className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmReject ? "Confirm reject appeal" : "Reject appeal"}
                  </button>
                )}
                {confirmReject && (
                  <button
                    type="button"
                    onClick={() => setConfirmReject(false)}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
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
