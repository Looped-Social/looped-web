import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";

import { VerificationDocumentGallery } from "../components/VerificationDocumentGallery/VerificationDocumentGallery";
import {
  AdminApiError,
  approveVerification,
  deleteVerificationMedia,
  fetchAdminVerification,
  fetchAdminVerifications,
  rejectVerification,
} from "../lib/adminApi";
import type { VerificationDetail, VerificationItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const statusOptions = ["pending", "approved", "rejected"] as const;
const verificationMethod = "photo_id";

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
      return "bg-bg-muted text-text-secondary";
    case "approved":
      return "bg-brand/10 text-brand";
    case "rejected":
      return "bg-bg-muted text-text-secondary";
    default:
      return "bg-bg-muted text-text-secondary";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getVerificationCommunityLabel(item: VerificationItem) {
  const communityName = item.community_name?.trim();
  if (communityName) return communityName;

  const typedMeta = item.metadata as
    | {
        community_name?: string | null;
        communityName?: string | null;
        community_label?: string | null;
        communityLabel?: string | null;
      }
    | null;

  const metaName =
    typedMeta?.community_name?.trim() ||
    typedMeta?.communityName?.trim() ||
    typedMeta?.community_label?.trim() ||
    typedMeta?.communityLabel?.trim();
  if (metaName) return metaName;

  const domain = item.company_domain?.trim();
  if (domain) return domain;

  return "Unknown";
}

function getVerificationCommunityId(item: VerificationItem) {
  if (typeof item.community_id === "number") return item.community_id;
  const typedMeta = item.metadata as { community_id?: number | null; communityId?: number | null } | null;
  if (typeof typedMeta?.community_id === "number") return typedMeta.community_id;
  if (typeof typedMeta?.communityId === "number") return typedMeta.communityId;
  return null;
}

function getApplicantLabel(item: VerificationItem) {
  const displayName = item.user_display_name?.trim();
  const handle = item.user_handle?.trim();
  if (displayName && handle) return `${displayName} (@${handle})`;
  if (displayName) return displayName;
  if (handle) return `@${handle}`;
  return item.email ?? "Unknown applicant";
}

function getApplicantSecondary(item: VerificationItem) {
  return item.email ?? null;
}

function isPhotoIdDetail(value: VerificationDetail | null, id: number): value is VerificationDetail {
  return value !== null && value.id === id;
}

export default function VerificationsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canVerify = admin.permissions.includes("verify_users");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("pending");
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<VerificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ tone: "info" | "error"; message: string } | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const rejectReasonRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    setConfirmReject(false);
    setActionError(null);
    setRejectReason("");
    requestAnimationFrame(() => {
      if (!rejectReasonRef.current) return;
      rejectReasonRef.current.style.height = "auto";
    });
  }, [selectedItem?.id]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && items.some((item) => item.id === prev)) return prev;
      return items[0]?.id ?? null;
    });
  }, [items]);

  useEffect(() => {
    if (!canVerify) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchAdminVerifications(status, verificationMethod)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
        setSelectedId(res.items[0]?.id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load verifications.");
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
  }, [canVerify, status]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    if (selectedItem.method !== verificationMethod) {
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    fetchAdminVerification(selectedItem.id)
      .then((res) => {
        if (!active) return;
        setSelectedDetail(res);
      })
      .catch((err) => {
        if (!active) return;
        setSelectedDetail(null);
        setDetailError(err instanceof Error ? err.message : "Unable to load verification details.");
      })
      .finally(() => {
        if (!active) return;
        setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedItem?.id, selectedItem?.method]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminVerifications(status, verificationMethod, nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more results.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = (id: number, patch: Partial<VerificationItem>) => {
    setItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return updated.filter((item) => item.status === status);
    });
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    if (!window.confirm("Approve this verification?")) return;
    setIsSaving(true);
    setActionBanner(null);
    setActionError(null);
    try {
      await approveVerification(selectedItem.id);
      updateItem(selectedItem.id, { status: "approved" });
      setRejectReason("");
      setConfirmReject(false);
    } catch (err) {
      if (
        err instanceof AdminApiError &&
        err.status === 409 &&
        (err.errorCode === "email_in_use" || err.details?.includes("email_in_use"))
      ) {
        updateItem(selectedItem.id, { status: "rejected", reject_reason: "email_in_use" });
        setRejectReason("");
        setConfirmReject(false);
        setActionBanner({
          tone: "info",
          message:
            "This email is already in use for an active verified account in this community. The request was automatically marked rejected (email_in_use).",
        });
        return;
      }
      setActionError(err instanceof Error ? err.message : "Unable to approve verification.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) {
      setActionError("Add a rejection reason before confirming.");
      return;
    }
    setIsSaving(true);
    setActionBanner(null);
    setActionError(null);
    try {
      const res = await rejectVerification(selectedItem.id, rejectReason.trim());
      updateItem(selectedItem.id, {
        status: "rejected",
        reject_reason: rejectReason.trim(),
        delete_after_at: res.delete_after_at,
      });
      setRejectReason("");
      setConfirmReject(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to reject verification.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedItem) return;
    if (selectedItem.method !== verificationMethod) return;
    if (!window.confirm("Delete verification photos now? This cannot be undone.")) return;
    setIsSaving(true);
    setActionBanner(null);
    setActionError(null);
    try {
      const res = await deleteVerificationMedia(selectedItem.id);
      if (res.media_deleted_at) {
        updateItem(selectedItem.id, { media_deleted_at: res.media_deleted_at });
      } else if (res.media_deleted) {
        updateItem(selectedItem.id, { media_deleted_at: new Date().toISOString() });
      }
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      fetchAdminVerification(selectedItem.id)
        .then((detail) => setSelectedDetail(detail))
        .catch((err) =>
          setDetailError(
            err instanceof Error ? err.message : "Unable to refresh verification documents."
          )
        )
        .finally(() => setDetailLoading(false));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete verification media.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canVerify) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Verification queue</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to review verification requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionBanner && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            actionBanner.tone === "error"
              ? "border-brand/30 bg-brand/5 text-brand"
              : "border-border bg-bg text-text-secondary"
          }`}
        >
          <p className="min-w-[220px] flex-1">{actionBanner.message}</p>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Dismiss
          </button>
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-text-light">
            Verification queue
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-strong">Review pending accounts</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Approve or reject verification submissions tied to workplace identity.
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

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <section className="space-y-3">
          {error && (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="text-sm font-semibold text-text-primary">
                Unable to load verification requests.
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
              Loading verification requests...
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              No verification requests match this status yet.
            </div>
          )}
          {items.map((item) => {
            const isActive = item.id === selectedItem?.id;
            const secondary = getApplicantSecondary(item);
            const communityLabel = getVerificationCommunityLabel(item);
            const communityId = getVerificationCommunityId(item);
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
                      {getApplicantLabel(item)}
                    </p>
                    {secondary && (
                      <p className="mt-1 text-xs text-text-secondary">{secondary}</p>
                    )}
                    <p className="mt-1 text-xs text-text-light">
                      Community: {communityLabel}
                      {communityId ? ` (#${communityId})` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                    {item.method}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-text-light">
                  <span>Submitted {formatDate(item.submitted_at)}</span>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-strong">Review details</h2>
              {selectedItem && (
                <p className="mt-1 text-xs text-text-light">
                  Submitted {formatDate(selectedItem.submitted_at)}
                </p>
              )}
            </div>
            {selectedItem && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                  selectedItem.status
                )}`}
              >
                {formatStatusLabel(selectedItem.status)}
              </span>
            )}
          </div>
          {!selectedItem ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select a verification request to review the details.
            </p>
          ) : (
            <div className="mt-4 space-y-5 text-sm text-text-secondary">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Applicant
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {getApplicantLabel(selectedItem)}
                    </p>
                    {getApplicantSecondary(selectedItem) && (
                      <p className="text-xs text-text-light">{getApplicantSecondary(selectedItem)}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Community
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {getVerificationCommunityLabel(selectedItem)}
                    </p>
                    {getVerificationCommunityId(selectedItem) && (
                      <p className="mt-1 text-xs text-text-light">
                        ID #{getVerificationCommunityId(selectedItem)}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-text-light">
                      Method
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {selectedItem.method}
                    </p>
                    {selectedItem.media_key && (
                      <p className="mt-1 text-xs text-text-light">{selectedItem.media_key}</p>
                    )}
                  </div>

                  {status !== "rejected" && (
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase text-text-light">
                        Rejection reason
                      </label>
                      <textarea
                        ref={rejectReasonRef}
                        value={rejectReason}
                        onChange={(event) => {
                          setRejectReason(event.target.value);
                          event.currentTarget.style.height = "auto";
                          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                        }}
                        rows={2}
                        placeholder="Provide a clear reason for rejection..."
                        className="w-full resize-none overflow-hidden rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  )}

                  {selectedItem.reject_reason && (
                    <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase text-text-light">
                        Reject reason
                      </p>
                      <p className="mt-2 text-xs text-text-secondary">{selectedItem.reject_reason}</p>
                    </div>
                  )}

                  {status === "rejected" &&
                    selectedItem.delete_after_at &&
                    !selectedItem.media_deleted_at &&
                    !(isPhotoIdDetail(selectedDetail, selectedItem.id) && selectedDetail.media_deleted_at) && (
                      <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                        <p className="text-xs font-semibold uppercase text-text-light">
                          Auto-delete
                        </p>
                        <p className="mt-2 text-xs text-text-secondary">
                          Scheduled {formatDate(selectedItem.delete_after_at)}.
                        </p>
                      </div>
                    )}
                </div>

                {selectedItem.method === verificationMethod && (
                  <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-text-light">
                        Documents
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetail(null);
                          setDetailError(null);
                          setDetailLoading(true);
                          fetchAdminVerification(selectedItem.id)
                            .then((res) => setSelectedDetail(res))
                            .catch((err) =>
                              setDetailError(
                                err instanceof Error
                                  ? err.message
                                  : "Unable to refresh verification documents."
                              )
                            )
                            .finally(() => setDetailLoading(false));
                        }}
                        className="text-xs font-semibold uppercase text-brand"
                      >
                        Refresh
                      </button>
                    </div>

                    {detailLoading && (
                      <p className="mt-2 text-xs text-text-light">Loading documents...</p>
                    )}

                    {detailError && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-brand">{detailError}</p>
                    )}

                    {!detailLoading && !detailError && (
                      <div className="mt-3">
                        {isPhotoIdDetail(selectedDetail, selectedItem.id) &&
                        (selectedDetail.documents?.length ?? 0) > 0 ? (
                          <VerificationDocumentGallery documents={selectedDetail.documents ?? []} />
                        ) : selectedItem.media_deleted_at ||
                          (isPhotoIdDetail(selectedDetail, selectedItem.id) &&
                            selectedDetail.media_deleted_at) ? (
                          <p className="text-xs text-text-light">
                            Documents deleted{" "}
                            {formatDate(
                              (isPhotoIdDetail(selectedDetail, selectedItem.id)
                                ? selectedDetail.media_deleted_at
                                : null) ?? selectedItem.media_deleted_at
                            )}
                            .
                          </p>
                        ) : (
                          <p className="text-xs text-text-light">No documents attached.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {actionError && (
                <p className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
                  {actionError}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? "Saving..."
                    : status === "rejected"
                      ? "Undo rejection (approve)"
                      : "Approve"}
                </button>
                {status === "rejected" ? (
                  <button
                    type="button"
                    onClick={handleDeleteMedia}
                    disabled={
                      isSaving ||
                      selectedItem.method !== verificationMethod ||
                      Boolean(
                        selectedItem.media_deleted_at ||
                          (isPhotoIdDetail(selectedDetail, selectedItem.id) &&
                            selectedDetail.media_deleted_at)
                      )
                    }
                    className="w-full rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectedItem.media_deleted_at ||
                    (isPhotoIdDetail(selectedDetail, selectedItem.id) &&
                      selectedDetail.media_deleted_at)
                      ? "Photos deleted"
                      : "Delete photos now"}
                  </button>
                ) : (
                  <div className="space-y-2">
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
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
