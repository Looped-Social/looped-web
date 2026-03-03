import { useCallback, useEffect, useMemo, useState } from "react";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import {
  fetchCommunityVerifications,
  unverifyCommunity,
  type CommunityVerificationItem,
} from "@/lib/verificationApi";
import { refreshCurrentUser } from "@/stores/currentUserStore";

type ViewStatus = "loading" | "ready" | "error";
type VerificationTone = "active" | "pending" | "rejected" | "expired";

type VerificationPresentation = {
  tone: VerificationTone;
  label: "Active" | "Pending" | "Rejected" | "Expired";
  helperText?: string;
};

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString("en-US");
}

function titleCaseValue(value: string): string {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function methodLabel(method: string | undefined): string | undefined {
  if (!method) return undefined;
  const normalized = method.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "email") return "Email";
  if (normalized === "photo_id" || normalized === "photo-id" || normalized === "photoid") return "Photo ID";
  return titleCaseValue(normalized);
}

function getVerificationPresentation(item: CommunityVerificationItem): VerificationPresentation {
  const status = (item.status ?? "").trim().toLowerCase();
  const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
  const isExpiredDate = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now());

  if (status.includes("rejected") || status.includes("reject")) {
    return {
      tone: "rejected",
      label: "Rejected",
      helperText: "Verification was rejected. Review details and try again from the community page.",
    };
  }

  if (status.includes("expired") || status.includes("expire") || isExpiredDate || (item.verified && item.active === false)) {
    return {
      tone: "expired",
      label: "Expired",
      helperText: "Verification expired. Verify again from the community page.",
    };
  }

  if (item.verified && item.active !== false) {
    return {
      tone: "active",
      label: "Active",
    };
  }

  if (status.includes("pending") || status.includes("review") || status.includes("in_progress") || item.active === true) {
    return {
      tone: "pending",
      label: "Pending",
      helperText: "Verification is being reviewed.",
    };
  }

  return {
    tone: "pending",
    label: "Pending",
  };
}

function statusPillClassName(tone: VerificationTone): string {
  switch (tone) {
    case "active":
      return "border-secondary/35 bg-secondary/12 text-secondary";
    case "rejected":
      return "border-brand/30 bg-brand/10 text-brand";
    case "expired":
      return "border-border/70 bg-bg-muted text-text-secondary";
    case "pending":
    default:
      return "border-border/70 bg-bg-muted text-text-secondary";
  }
}

function statusSortRank(tone: VerificationTone): number {
  switch (tone) {
    case "active":
      return 0;
    case "pending":
      return 1;
    case "rejected":
      return 2;
    case "expired":
      return 3;
    default:
      return 9;
  }
}

function normalizeCommunityKindLabel(kind: string | undefined): string | undefined {
  if (!kind) return undefined;
  const normalized = kind.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "company") return "Company";
  if (normalized === "school") return "School";
  return titleCaseValue(normalized);
}

export function AppSettingsVerificationsPage() {
  const [viewStatus, setViewStatus] = useState<ViewStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityVerificationItem[]>([]);
  const [confirmingItem, setConfirmingItem] = useState<CommunityVerificationItem | null>(null);
  const [unverifyingCommunityId, setUnverifyingCommunityId] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    setViewStatus("loading");
    setLoadError(null);

    try {
      const nextItems = await fetchCommunityVerifications();
      setItems(nextItems);
      setViewStatus("ready");
    } catch (error) {
      const normalized = normalizeSettingsError(error);
      setViewStatus("error");
      setLoadError(normalized.message || "Unable to load verifications.");
    }
  }, []);

  useEffect(() => {
    void loadVerifications();
  }, [loadVerifications]);

  const sortedCommunityItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aPresentation = getVerificationPresentation(a);
      const bPresentation = getVerificationPresentation(b);
      const rankDiff = statusSortRank(aPresentation.tone) - statusSortRank(bPresentation.tone);
      if (rankDiff !== 0) return rankDiff;
      return a.communityName.localeCompare(b.communityName);
    });
  }, [items]);

  const verifiedEmailItems = useMemo(() => {
    return sortedCommunityItems.filter((item) => Boolean(item.active) && Boolean(item.verifiedEmail?.trim().length));
  }, [sortedCommunityItems]);

  const openUnverifyDialog = useCallback((item: CommunityVerificationItem) => {
    if (!item.verified) return;
    setActionError(null);
    setConfirmingItem(item);
  }, []);

  const closeUnverifyDialog = useCallback(() => {
    if (unverifyingCommunityId) return;
    setConfirmingItem(null);
  }, [unverifyingCommunityId]);

  const handleConfirmUnverify = useCallback(async () => {
    if (!confirmingItem) return;
    setActionError(null);
    setUnverifyingCommunityId(confirmingItem.communityId);

    try {
      await unverifyCommunity(confirmingItem.communityId);
      setConfirmingItem(null);
      await loadVerifications();
      void refreshCurrentUser().catch(() => {});
    } catch (error) {
      const normalized = normalizeSettingsError(error);
      setActionError(normalized.message || "Unable to remove verification.");
    } finally {
      setUnverifyingCommunityId(null);
    }
  }, [confirmingItem, loadVerifications]);

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Verifications" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-strong">Verifications</h1>
          <p className="text-sm text-text-secondary">Manage your community verification statuses.</p>
        </header>

        {actionError ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
            {actionError}
          </div>
        ) : null}

        {viewStatus === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={`settings-verification-skeleton-${index}`} className="rounded-2xl border border-border/60 bg-bg px-4 py-3">
                <div className="looped-skeleton looped-skeleton-shimmer h-4 w-1/3 rounded-full" />
                <div className="looped-skeleton looped-skeleton-shimmer mt-2 h-3 w-1/2 rounded-full" />
              </div>
            ))}
          </div>
        ) : null}

        {viewStatus === "error" ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
            <p className="text-sm font-semibold text-strong">Unable to load verifications.</p>
            {loadError ? <p className="text-sm text-text-secondary">{loadError}</p> : null}
            <button
              type="button"
              onClick={() => void loadVerifications()}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {viewStatus === "ready" ? (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">Companies &amp; Schools</h2>
              {sortedCommunityItems.length > 0 ? (
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                  {sortedCommunityItems.map((item) => {
                    const presentation = getVerificationPresentation(item);
                    const expiresDate = formatDate(item.expiresAt);
                    const verifiedDate = formatDate(item.verifiedAt);
                    const method = methodLabel(item.method);
                    const communityKind = normalizeCommunityKindLabel(item.communityKind);
                    const isRowBusy = unverifyingCommunityId === item.communityId;
                    const isRowActionable = item.verified;

                    return (
                      <button
                        key={item.communityId}
                        type="button"
                        onClick={() => openUnverifyDialog(item)}
                        disabled={!isRowActionable || isRowBusy}
                        className={`w-full space-y-2 px-4 py-3 text-left transition ${
                          isRowActionable ? "hover:bg-bg-muted/35" : ""
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-strong">{item.communityName}</p>
                            {communityKind ? <p className="truncate text-xs text-text-secondary">{communityKind}</p> : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {isRowBusy ? (
                              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-text-secondary/45 border-t-transparent" />
                            ) : null}
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusPillClassName(presentation.tone)}`}
                            >
                              {presentation.label}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-text-secondary">
                          {method ? <p>Method: {method}</p> : null}
                          {item.verifiedEmail ? <p>Verified email: {item.verifiedEmail}</p> : item.email ? <p>Email: {item.email}</p> : null}
                          {verifiedDate ? <p>Verified: {verifiedDate}</p> : null}
                          {expiresDate ? <p>Expires: {expiresDate}</p> : item.verified ? <p>Never expires</p> : null}
                          {item.rejectReason ? <p>Rejection reason: {item.rejectReason}</p> : null}
                          {presentation.helperText ? <p>{presentation.helperText}</p> : null}
                          {isRowActionable ? <p className="font-medium text-text-light">Tap to remove verification.</p> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-bg px-4 py-6 text-center">
                  <img
                    src="/icons/verified.svg"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto h-8 w-8 opacity-45 grayscale"
                    loading="lazy"
                  />
                  <p className="mt-3 text-sm text-text-secondary">No community verifications yet.</p>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">Verified Emails</h2>
              {verifiedEmailItems.length > 0 ? (
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                  {verifiedEmailItems.map((item) => {
                    const presentation = getVerificationPresentation(item);
                    return (
                      <div key={`verified-email-${item.communityId}`} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="select-text truncate text-sm font-semibold text-strong">{item.verifiedEmail}</p>
                          <p className="truncate text-xs text-text-secondary">{item.communityName}</p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusPillClassName(presentation.tone)}`}
                        >
                          {presentation.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-bg px-4 py-3">
                  <p className="text-sm text-text-secondary">No verified emails yet.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      {confirmingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-bg p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-strong">Remove verification?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {confirmingItem.active
                ? "Removing this verification releases your email lock for this community."
                : "This will remove this verification from your account."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeUnverifyDialog}
                disabled={Boolean(unverifyingCommunityId)}
                className="rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmUnverify()}
                disabled={Boolean(unverifyingCommunityId)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
              >
                {unverifyingCommunityId ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
