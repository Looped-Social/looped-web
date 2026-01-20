import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  AdminApiError,
  approveModerationQueueItem,
  fetchAdminModerationQueue,
  removeModerationQueueItem,
} from "../lib/adminApi";
import type { ModerationQueueItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const statusOptions = ["open", "approved", "removed"] as const;
const targetTypeOptions = ["all", "post", "comment"] as const;

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
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
    case "removed":
      return "bg-bg-muted text-text-secondary";
    default:
      return "bg-bg-muted text-text-secondary";
  }
}

function getTargetContent(item: ModerationQueueItem): string | null {
  if (item.target_type === "post") return item.post?.content ?? null;
  if (item.target_type === "comment") return item.comment?.content ?? null;

  const fallback = item as unknown as {
    post?: { content?: unknown } | null;
    comment?: { content?: unknown } | null;
    target?: { content?: unknown } | null;
    content?: unknown;
  };

  const maybe =
    fallback.post?.content ??
    fallback.comment?.content ??
    fallback.target?.content ??
    fallback.content;

  return typeof maybe === "string" ? maybe : null;
}

function getIdRows(item: ModerationQueueItem): Array<{ label: string; value: number }> {
  const rows: Array<{ label: string; value: number }> = [];
  rows.push({ label: "queue_id", value: item.id });

  const postId = item.post_id ?? item.post?.id ?? null;
  const commentId = item.comment_id ?? item.comment?.id ?? null;
  const communityId = item.community_id ?? item.post?.community_id ?? item.comment?.community_id ?? null;

  if (typeof postId === "number") rows.push({ label: "post_id", value: postId });
  if (typeof commentId === "number") rows.push({ label: "comment_id", value: commentId });
  if (typeof communityId === "number") rows.push({ label: "community_id", value: communityId });

  const seen = new Set(rows.map((row) => row.label));
  for (const [key, value] of Object.entries(item)) {
    if (!key.endsWith("_id")) continue;
    if (seen.has(key)) continue;
    if (typeof value !== "number") continue;
    seen.add(key);
    rows.push({ label: key, value });
    if (rows.length >= 10) break;
  }

  return rows;
}

function mapModerationError(err: unknown): { message: string; shouldRemove?: boolean } {
  if (err instanceof AdminApiError) {
    if (err.status === 403) {
      return { message: "Forbidden: your account does not have access to the moderation queue." };
    }
    if (err.status === 409 && err.errorCode === "already_reviewed") {
      return { message: "Already reviewed.", shouldRemove: true };
    }
    if (
      err.status === 404 &&
      (err.errorCode === "not_found" || err.errorCode === "target_not_found")
    ) {
      return { message: "Not found: queue item or target is missing.", shouldRemove: true };
    }
  }
  return { message: err instanceof Error ? err.message : "Request failed." };
}

function ModerationQueueCard({
  item,
  currentStatusFilter,
  onReviewed,
  onRemoveFromList,
  onBanner,
}: {
  item: ModerationQueueItem;
  currentStatusFilter: (typeof statusOptions)[number];
  onReviewed: (id: number, newStatus: "approved" | "removed") => void;
  onRemoveFromList: (id: number) => void;
  onBanner: (message: string) => void;
}) {
  const [panel, setPanel] = useState<"approve" | "remove" | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [removeReason, setRemoveReason] = useState("");
  const [removeNote, setRemoveNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPanel(null);
    setApproveNote("");
    setRemoveReason("");
    setRemoveNote("");
    setIsSaving(false);
    setActionError(null);
  }, [item.id]);

  const content = getTargetContent(item);
  const idRows = useMemo(() => getIdRows(item), [item]);
  const isOpen = item.status === "open";

  const handleApprove = async () => {
    if (!isOpen || isSaving) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await approveModerationQueueItem(item.id, approveNote.trim() || undefined);
      onBanner("Approved.");
      if (currentStatusFilter === "open") {
        onRemoveFromList(item.id);
      } else {
        onReviewed(item.id, "approved");
      }
    } catch (err) {
      const mapped = mapModerationError(err);
      setActionError(mapped.message);
      if (mapped.shouldRemove) {
        onBanner(mapped.message);
        onRemoveFromList(item.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!isOpen || isSaving) return;
    if (!removeReason.trim()) {
      setActionError("Removal reason is required.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await removeModerationQueueItem(item.id, removeReason.trim(), removeNote.trim() || undefined);
      onBanner("Removed.");
      if (currentStatusFilter === "open") {
        onRemoveFromList(item.id);
      } else {
        onReviewed(item.id, "removed");
      }
    } catch (err) {
      const mapped = mapModerationError(err);
      setActionError(mapped.message);
      if (mapped.shouldRemove) {
        onBanner(mapped.message);
        onRemoveFromList(item.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-bg p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-strong">Queue #{item.id}</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(
                item.status
              )}`}
            >
              {item.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">Target:</span> {item.target_type} ·{" "}
            <span className="font-medium text-text-primary">Source:</span> {item.source ?? "N/A"} ·{" "}
            <span className="font-medium text-text-primary">Reason:</span> {item.reason ?? "N/A"}
          </p>
          <p className="mt-1 text-xs text-text-light">
            Created {formatDate(item.created_at)} · Updated {formatDate(item.updated_at)}
            {item.reviewed_at ? ` · Reviewed ${formatDate(item.reviewed_at)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isOpen || isSaving}
            onClick={() => setPanel((prev) => (prev === "approve" ? null : "approve"))}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={!isOpen || isSaving}
            onClick={() => setPanel((prev) => (prev === "remove" ? null : "remove"))}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg-muted/30 p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">
            Target content
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">
            {content ?? "N/A"}
          </pre>
        </div>

        <div className="rounded-xl border border-border bg-bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">IDs</p>
          <dl className="mt-2 space-y-2 text-sm">
            {idRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">{row.label}</dt>
                <dd className="font-mono text-xs text-text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {panel === "approve" && (
        <div className="mt-4 rounded-xl border border-border bg-bg-muted/30 p-4">
          <p className="text-sm font-semibold text-strong">Approve</p>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-text-light">
            Note (optional)
          </label>
          <textarea
            value={approveNote}
            onChange={(event) => setApproveNote(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
            placeholder="Optional note for audit trail"
          />
          {actionError && <p className="mt-2 text-sm text-brand">{actionError}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setPanel(null)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleApprove}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Approving..." : "Confirm approve"}
            </button>
          </div>
        </div>
      )}

      {panel === "remove" && (
        <div className="mt-4 rounded-xl border border-border bg-bg-muted/30 p-4">
          <p className="text-sm font-semibold text-strong">Remove</p>

          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-text-light">
            Reason
          </label>
          <input
            value={removeReason}
            onChange={(event) => setRemoveReason(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
            placeholder="Required reason"
          />

          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-text-light">
            Note (optional)
          </label>
          <textarea
            value={removeNote}
            onChange={(event) => setRemoveNote(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
            placeholder="Optional note for audit trail"
          />

          {actionError && <p className="mt-2 text-sm text-brand">{actionError}</p>}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setPanel(null)}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleRemove}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Removing..." : "Confirm remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModerationRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();

  const [status, setStatus] = useState<(typeof statusOptions)[number]>("open");
  const [targetType, setTargetType] = useState<(typeof targetTypeOptions)[number]>("all");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canSeePage = admin.status === "active";

  useEffect(() => {
    if (!canSeePage) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    setBanner(null);
    fetchAdminModerationQueue(
      status,
      targetType === "all" ? undefined : targetType,
      undefined,
      50
    )
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
      })
      .catch((err) => {
        if (!active) return;
        const mapped = mapModerationError(err);
        setError(mapped.message);
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
  }, [canSeePage, reloadKey, status, targetType]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminModerationQueue(
        status,
        targetType === "all" ? undefined : targetType,
        nextCursor,
        50
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      const mapped = mapModerationError(err);
      setError(mapped.message);
    } finally {
      setIsLoading(false);
    }
  };

  const header = useMemo(() => {
    return `${status === "open" ? "Open" : status} queue`;
  }, [status]);

  if (!canSeePage) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <h1 className="text-2xl font-semibold text-strong">Moderation Queue</h1>
        <p className="mt-2 text-sm text-text-secondary">Your admin account is not active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-bg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-strong">Moderation Queue</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Review items flagged for moderation ({header}).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}
              className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
              Target type
            </span>
            <select
              value={targetType}
              onChange={(event) =>
                setTargetType(event.target.value as (typeof targetTypeOptions)[number])
              }
              className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
            >
              {targetTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <p className="text-sm text-text-secondary">
              {isLoading ? "Loading..." : `${items.length} item${items.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {banner && (
          <div className="mt-4 rounded-xl border border-border bg-bg-muted/30 px-4 py-3 text-sm text-text-secondary">
            {banner}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-brand">
            {error}
          </div>
        )}
      </div>

      {items.length === 0 && !isLoading && !error && (
        <div className="rounded-2xl border border-border bg-bg p-6">
          <p className="text-sm text-text-secondary">No queue items found.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <ModerationQueueCard
            key={item.id}
            item={item}
            currentStatusFilter={status}
            onReviewed={(id, newStatus) => {
              setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
            }}
            onRemoveFromList={(id) => {
              setItems((prev) => prev.filter((i) => i.id !== id));
            }}
            onBanner={(message) => {
              setBanner(message);
            }}
          />
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={isLoading}
            onClick={loadMore}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

