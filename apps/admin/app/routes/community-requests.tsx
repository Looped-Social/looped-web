import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  approveCommunityRequest,
  deleteCommunityRequest,
  fetchAdminCommunityRequests,
  rejectCommunityRequest,
} from "../lib/adminApi";
import type { CommunityRequestApprovePayload, CommunityRequestItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const statusOptions = ["pending", "approved", "rejected"] as const;

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
    case "pending":
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

function formatKindLabel(value?: string | null) {
  if (!value) return "Unknown kind";
  return formatStatusLabel(value);
}

function getSubmittedAt(item: CommunityRequestItem) {
  return item.submitted_at ?? item.created_at ?? null;
}

export default function CommunityRequestsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canCreate = admin.permissions.includes("create_community");

  const [status, setStatus] = useState<(typeof statusOptions)[number]>("pending");
  const [items, setItems] = useState<CommunityRequestItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [overrideKind, setOverrideKind] = useState("");
  const [overrideName, setOverrideName] = useState("");
  const [overrideDescription, setOverrideDescription] = useState("");
  const [overrideImageUrl, setOverrideImageUrl] = useState("");
  const [overrideVerificationTtlDays, setOverrideVerificationTtlDays] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  const canTakeAction = selectedItem?.status === "pending";

  useEffect(() => {
    setConfirmReject(false);
    setConfirmDelete(false);
    setActionError(null);
    setRejectReason("");
    setOverrideKind("");
    setOverrideName("");
    setOverrideDescription("");
    setOverrideImageUrl("");
    setOverrideVerificationTtlDays("");
  }, [selectedItem?.id]);

  useEffect(() => {
    if (!canCreate) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchAdminCommunityRequests(status)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
        setSelectedId(res.items[0]?.id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load community requests.");
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
  }, [canCreate, status]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminCommunityRequests(status, nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more requests.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemStatus = (id: number, nextStatus: string, reason?: string) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, status: nextStatus, reject_reason: reason ?? item.reject_reason }
          : item
      );
      return status === "pending" ? updated.filter((item) => item.status === "pending") : updated;
    });
  };

  const handleApprove = async () => {
    if (!selectedItem || !canTakeAction) return;
    setIsSaving(true);
    setActionError(null);

    const payload: CommunityRequestApprovePayload = {};
    const trimmedKind = overrideKind.trim();
    const trimmedName = overrideName.trim();
    const trimmedDescription = overrideDescription.trim();
    const trimmedImageUrl = overrideImageUrl.trim();
    const trimmedTtl = overrideVerificationTtlDays.trim();

    if (trimmedKind) payload.kind = trimmedKind;
    if (trimmedName) payload.name = trimmedName;
    if (trimmedDescription) payload.description = trimmedDescription;
    if (trimmedImageUrl) payload.imageUrl = trimmedImageUrl;
    if (trimmedTtl) {
      const parsed = Number(trimmedTtl);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        setActionError("Verification TTL must be a positive whole number of days.");
        setIsSaving(false);
        return;
      }
      payload.verificationTtlDays = parsed;
    }

    try {
      await approveCommunityRequest(
        selectedItem.id,
        Object.keys(payload).length ? payload : undefined
      );
      updateItemStatus(selectedItem.id, "approved");
      setConfirmReject(false);
      setRejectReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to approve request.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !canTakeAction) return;
    if (!rejectReason.trim()) {
      setActionError("Add a rejection reason before confirming.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await rejectCommunityRequest(selectedItem.id, rejectReason.trim());
      updateItemStatus(selectedItem.id, "rejected", rejectReason.trim());
      setRejectReason("");
      setConfirmReject(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to reject request.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await deleteCommunityRequest(selectedItem.id);
      setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
      setSelectedId(null);
      setConfirmDelete(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete request.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Community requests</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to review community requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">
            Community requests
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">
            Review new community submissions
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Approve a request to create a community or reject with a reason.
          </p>
        </div>
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          {error && (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="text-sm font-semibold text-text-primary">
                Unable to load community requests.
              </p>
              <p className="mt-1 text-xs text-text-light">
                Try refreshing the page or switching status filters.
              </p>
              <details className="mt-2 text-xs text-text-light">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-2 whitespace-pre-wrap">{error}</p>
              </details>
            </div>
          )}
          {isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading community requests...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No community requests match this status yet.
            </div>
          )}
          {items.map((item) => {
            const isActive = item.id === selectedItem?.id;
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
                      {item.name ?? "Untitled community"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {formatKindLabel(item.kind)}
                    </p>
                    <p className="mt-2 text-xs text-text-light">
                      {item.description ?? "No description provided."}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-light">
                  <span>Submitted {formatDate(getSubmittedAt(item))}</span>
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
          <h2 className="text-lg font-semibold text-strong">Review details</h2>
          {!selectedItem ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select a community request to review the details.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase text-text-light">
                  Community name
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedItem.name ?? "Untitled community"}
                </p>
                <p className="text-xs text-text-light">
                  Kind: {formatKindLabel(selectedItem.kind)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Description
                </p>
                <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">
                  {selectedItem.description ?? "No description provided."}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Request metadata
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Status</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                      selectedItem.status
                    )}`}
                  >
                    {formatStatusLabel(selectedItem.status)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Submitted</span>
                  <span className="text-text-primary">
                    {formatDate(getSubmittedAt(selectedItem))}
                  </span>
                </div>
                {selectedItem.requested_by_email && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Requested by</span>
                    <span className="text-text-primary">
                      {selectedItem.requested_by_email}
                    </span>
                  </div>
                )}
                {selectedItem.verification_ttl_days && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Verification TTL</span>
                    <span className="text-text-primary">
                      {selectedItem.verification_ttl_days} days
                    </span>
                  </div>
                )}
                {selectedItem.reject_reason && (
                  <p className="mt-2 text-xs text-text-light">
                    Reject reason: {selectedItem.reject_reason}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Request image
                </p>
                {selectedItem.image_url ? (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.name ?? "Community request"}
                    className="mt-2 h-40 w-full rounded-xl border border-border/60 object-cover"
                  />
                ) : (
                  <p className="mt-2 text-xs text-text-light">No image submitted.</p>
                )}
                {selectedItem.image_key && (
                  <p className="mt-2 text-xs text-text-light">
                    Image key: {selectedItem.image_key}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Overrides (optional)
                </p>
                <input
                  value={overrideName}
                  onChange={(event) => setOverrideName(event.target.value)}
                  placeholder={selectedItem.name ?? "Community name"}
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  value={overrideKind}
                  onChange={(event) => setOverrideKind(event.target.value)}
                  placeholder={selectedItem.kind ?? "Kind (e.g. sector)"}
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <textarea
                  value={overrideDescription}
                  onChange={(event) => setOverrideDescription(event.target.value)}
                  rows={3}
                  placeholder={selectedItem.description ?? "Description override"}
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  value={overrideImageUrl}
                  onChange={(event) => setOverrideImageUrl(event.target.value)}
                  placeholder={selectedItem.image_url ?? "Image URL override"}
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <input
                  value={overrideVerificationTtlDays}
                  onChange={(event) => setOverrideVerificationTtlDays(event.target.value)}
                  placeholder={
                    selectedItem.verification_ttl_days
                      ? `${selectedItem.verification_ttl_days}`
                      : "Verification TTL (days)"
                  }
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="text-xs text-text-light">
                  Leave fields blank to use the submitted values.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase text-text-light">
                  Rejection reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={3}
                  placeholder="Provide a clear reason for rejection..."
                  disabled={!canTakeAction || isSaving}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {!canTakeAction && (
                <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-light">
                  Only pending requests can be approved or rejected.
                </p>
              )}

              {actionError && (
                <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                  {actionError}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSaving || !canTakeAction}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Approve"}
                </button>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canTakeAction) return;
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
                    disabled={isSaving || !canTakeAction}
                    className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmReject ? "Confirm reject" : "Reject"}
                  </button>
                  {confirmReject && (
                    <button
                      type="button"
                      onClick={() => setConfirmReject(false)}
                      className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Delete request
                </p>
                <p className="mt-1 text-xs text-text-light">
                  Permanently remove the request record. This cannot be undone.
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      handleDelete();
                    }}
                    disabled={isSaving}
                    className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {confirmDelete ? "Confirm delete" : "Delete request"}
                  </button>
                  {confirmDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
