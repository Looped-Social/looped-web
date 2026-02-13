import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import {
  createAppeal,
  type AppealItem,
  fetchUnderReviewContent,
  fetchAppeals,
  fetchViolations,
  type UnderReviewContentItem,
  type ViolationItem,
} from "@/lib/moderationApi";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import { useCurrentUserStore } from "@/stores/currentUserStore";

type ReviewTab = "appeals" | "violations" | "under-review";

function parseTab(value: string | null): ReviewTab {
  if (value === "under-review") return "under-review";
  if (value === "violations") return "violations";
  return "appeals";
}

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.replaceAll("_", " ");
}

function isAppealableViolation(item: ViolationItem): boolean {
  const normalizedStatus = (item.status ?? "").trim().toLowerCase();
  if (!normalizedStatus) return false;
  return normalizedStatus === "appealable" || normalizedStatus === "open" || normalizedStatus === "eligible";
}

export function AppSettingsSafetyReviewPage() {
  const { showToast } = useToast();
  const currentUserState = useCurrentUserStore({ autoLoad: true });
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = parseTab(searchParams.get("tab"));

  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [appealsStatus, setAppealsStatus] = useState<"loading" | "idle" | "error">("loading");
  const [appealsError, setAppealsError] = useState<string | null>(null);

  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [violationsStatus, setViolationsStatus] = useState<"loading" | "idle" | "error" | "loading-more">("loading");
  const [violationsError, setViolationsError] = useState<string | null>(null);
  const [violationsNextCursor, setViolationsNextCursor] = useState<string | null>(null);

  const [underReview, setUnderReview] = useState<UnderReviewContentItem[]>([]);
  const [underReviewStatus, setUnderReviewStatus] = useState<"loading" | "idle" | "error" | "loading-more">("loading");
  const [underReviewError, setUnderReviewError] = useState<string | null>(null);
  const [underReviewNextCursor, setUnderReviewNextCursor] = useState<string | null>(null);

  const [appealTargetType, setAppealTargetType] = useState("post_removal");
  const [appealTargetId, setAppealTargetId] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [isAppealSubmitting, setIsAppealSubmitting] = useState(false);

  const loadAppeals = useCallback(async () => {
    setAppealsStatus("loading");
    setAppealsError(null);
    try {
      const response = await fetchAppeals();
      setAppeals(response);
      setAppealsStatus("idle");
    } catch (errorValue) {
      const normalized = normalizeSettingsError(errorValue);
      setAppealsStatus("error");
      setAppealsError(normalized.message || "Unable to load appeals.");
    }
  }, []);

  const loadViolations = useCallback(async ({ cursor }: { cursor?: string } = {}) => {
    if (cursor) {
      setViolationsStatus("loading-more");
    } else {
      setViolationsStatus("loading");
      setViolationsError(null);
    }

    try {
      const response = await fetchViolations({ limit: 20, cursor });
      if (!cursor) setViolations(response.items);
      else setViolations((current) => [...current, ...response.items]);
      setViolationsNextCursor(response.nextCursor);
      setViolationsStatus("idle");
    } catch (errorValue) {
      const normalized = normalizeSettingsError(errorValue);
      setViolationsStatus("error");
      setViolationsError(normalized.message || "Unable to load violations.");
    }
  }, []);

  const loadUnderReview = useCallback(async ({ cursor }: { cursor?: string } = {}) => {
    if (cursor) {
      setUnderReviewStatus("loading-more");
    } else {
      setUnderReviewStatus("loading");
      setUnderReviewError(null);
    }

    try {
      const response = await fetchUnderReviewContent({
        limit: 20,
        cursor,
        userId: currentUserState.user?.id,
      });
      if (!cursor) setUnderReview(response.items);
      else setUnderReview((current) => [...current, ...response.items]);
      setUnderReviewNextCursor(response.nextCursor);
      setUnderReviewStatus("idle");
    } catch (errorValue) {
      const normalized = normalizeSettingsError(errorValue);
      setUnderReviewStatus("error");
      setUnderReviewError(normalized.message || "Unable to load content.");
    }
  }, [currentUserState.user?.id]);

  useEffect(() => {
    if (activeTab === "appeals") {
      if (appealsStatus === "loading") {
        void loadAppeals();
      }
      if (violationsStatus === "loading") {
        void loadViolations();
      }
      return;
    }

    if (activeTab === "violations" && violationsStatus === "loading") {
      void loadViolations();
      return;
    }

    if (activeTab === "under-review" && underReviewStatus === "loading") {
      void loadUnderReview();
    }
  }, [
    activeTab,
    appealsStatus,
    loadAppeals,
    loadUnderReview,
    loadViolations,
    underReviewStatus,
    violationsStatus,
  ]);

  const handleSubmitAppeal = useCallback(async () => {
    const targetId = appealTargetId.trim();
    const reason = appealReason.trim();
    if (!reason) {
      showToast({
        kind: "error",
        title: "Missing appeal details",
        message: "Reason is required.",
      });
      return;
    }

    setIsAppealSubmitting(true);
    try {
      await createAppeal({
        targetType: appealTargetType,
        ...(targetId ? { targetId } : {}),
        reason,
      });
      setAppealTargetId("");
      setAppealReason("");
      await loadAppeals();
      showToast({
        kind: "success",
        title: "Appeal submitted",
        message: "Your appeal was submitted for review.",
      });
    } catch (errorValue) {
      const normalized = normalizeSettingsError(errorValue);
      showToast({
        kind: "error",
        title: "Couldn’t submit appeal",
        message: normalized.message || "Try again.",
      });
    } finally {
      setIsAppealSubmitting(false);
    }
  }, [appealReason, appealTargetId, appealTargetType, loadAppeals, showToast]);

  const tabs: Array<{ id: ReviewTab; label: string }> = useMemo(
    () => [
      { id: "appeals", label: "Appeals" },
      { id: "violations", label: "Violations" },
      { id: "under-review", label: "Under Review" },
    ],
    []
  );
  const hasAppealableViolation = useMemo(() => violations.some(isAppealableViolation), [violations]);

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Safety Review" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Safety Review</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage violations, appeals, and content under review.</p>
        </header>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 bg-bg">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("tab", tab.id);
                    return next;
                  });
                }}
                className={`px-2 py-2 text-xs font-semibold transition ${
                  active ? "bg-brand text-white" : "text-text-secondary hover:text-strong"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "appeals" ? (
          <div className="space-y-3">
            {violationsStatus === "loading" ? (
              <section className="rounded-2xl border border-border/60 bg-bg p-4">
                <p className="text-sm text-text-secondary">Checking whether this account has appealable violations…</p>
              </section>
            ) : hasAppealableViolation ? (
              <section className="space-y-2 rounded-2xl border border-border/60 bg-bg p-4">
                <h2 className="text-sm font-semibold text-strong">Create Appeal</h2>
                <div className="space-y-2">
                  <label className="space-y-1 text-xs text-text-secondary">
                    <span>Target type</span>
                    <select
                      value={appealTargetType}
                      onChange={(event) => setAppealTargetType(event.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm text-strong outline-none"
                    >
                      <option value="post_removal">post_removal</option>
                      <option value="comment_removal">comment_removal</option>
                      <option value="account_action">account_action</option>
                      <option value="other">other</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-text-secondary">
                    <span>Target ID</span>
                    <input
                      value={appealTargetId}
                      onChange={(event) => setAppealTargetId(event.target.value)}
                      placeholder="12345"
                      className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm text-strong outline-none placeholder:text-text-light"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-text-secondary">
                    <span>Reason</span>
                    <textarea
                      value={appealReason}
                      onChange={(event) => setAppealReason(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border/70 bg-bg px-3 py-2 text-sm text-strong outline-none"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSubmitAppeal()}
                  disabled={isAppealSubmitting}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isAppealSubmitting ? "Submitting…" : "Submit appeal"}
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-border/60 bg-bg p-4">
                <p className="text-sm text-text-secondary">
                  Appeal creation is available when a violation is in an appealable state.
                </p>
              </section>
            )}

            {appealsStatus === "loading" ? <p className="text-sm text-text-secondary">Loading appeals…</p> : null}
            {appealsStatus === "error" ? <p className="text-sm text-text-secondary">{appealsError}</p> : null}
            {appealsStatus === "idle" && appeals.length === 0 ? <p className="text-sm text-text-secondary">No appeals yet.</p> : null}
            {appealsStatus === "idle" && appeals.length > 0 ? (
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                {appeals.map((item) => (
                  <div key={item.id} className="space-y-1 px-4 py-3">
                    <p className="text-sm font-semibold text-strong">
                      {normalizeLabel(item.targetType, "appeal")} · {normalizeLabel(item.status, "open")}
                    </p>
                    <p className="text-xs text-text-secondary">Target ID: {item.targetId ?? "unknown"}</p>
                    {item.reason ? <p className="text-xs text-text-secondary">{item.reason}</p> : null}
                    {item.createdAt ? <p className="text-xs text-text-light">{formatDate(item.createdAt)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "violations" ? (
          <div className="space-y-3">
            {violationsStatus === "loading" ? <p className="text-sm text-text-secondary">Loading violations…</p> : null}
            {violationsStatus === "error" ? <p className="text-sm text-text-secondary">{violationsError}</p> : null}
            {violationsStatus !== "loading" && violations.length === 0 ? <p className="text-sm text-text-secondary">No violations.</p> : null}
            {violations.length > 0 ? (
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                {violations.map((item) => (
                  <div key={item.id} className="space-y-1 px-4 py-3">
                    <p className="text-sm font-semibold text-strong">
                      {normalizeLabel(item.type, "violation")} · {normalizeLabel(item.status, "open")}
                    </p>
                    {item.targetType || item.targetId ? (
                      <p className="text-xs text-text-secondary">
                        {normalizeLabel(item.targetType, "target")} · {item.targetId ?? "unknown"}
                      </p>
                    ) : null}
                    {item.reason ? <p className="text-xs text-text-secondary">{item.reason}</p> : null}
                    {item.createdAt ? <p className="text-xs text-text-light">{formatDate(item.createdAt)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {violationsNextCursor ? (
              <button
                type="button"
                onClick={() => void loadViolations({ cursor: violationsNextCursor })}
                disabled={violationsStatus === "loading-more"}
                className="w-full rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
              >
                {violationsStatus === "loading-more" ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === "under-review" ? (
          <div className="space-y-3">
            {underReviewStatus === "loading" ? <p className="text-sm text-text-secondary">Loading content…</p> : null}
            {underReviewStatus === "error" ? <p className="text-sm text-text-secondary">{underReviewError}</p> : null}
            {underReviewStatus !== "loading" && underReview.length === 0 ? (
              <p className="text-sm text-text-secondary">No content under review.</p>
            ) : null}
            {underReview.length > 0 ? (
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                {underReview.map((item) => (
                  <div key={item.id} className="space-y-1 px-4 py-3">
                    <p className="text-sm font-semibold text-strong">
                      {normalizeLabel(item.kind, "content")} · {normalizeLabel(item.status, "under review")}
                    </p>
                    {item.preview ? <p className="line-clamp-2 text-xs text-text-secondary">{item.preview}</p> : null}
                    {item.createdAt ? <p className="text-xs text-text-light">{formatDate(item.createdAt)}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {underReviewNextCursor ? (
              <button
                type="button"
                onClick={() => void loadUnderReview({ cursor: underReviewNextCursor })}
                disabled={underReviewStatus === "loading-more"}
                className="w-full rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
              >
                {underReviewStatus === "loading-more" ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
