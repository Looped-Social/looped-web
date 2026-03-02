import { useCallback, useEffect, useMemo, useState } from "react";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { VerificationEmailFlow } from "@/app/components/VerificationEmailFlow/VerificationEmailFlow";
import { useEmailVerificationMachine, type EmailVerificationDraft } from "@/lib/emailVerificationMachine";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import {
  fetchCommunityVerificationDomains,
  fetchCommunityVerifications,
  fetchJoinedSpecializations,
  finishCommunityVerification,
  startCommunityVerification,
  type CommunityVerificationItem,
  type JoinedSpecializationItem,
} from "@/lib/verificationApi";

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(item: CommunityVerificationItem): string {
  if (item.verified) return "Verified";
  if (item.status) return item.status.replaceAll("_", " ");
  return "Unverified";
}

function SpecializationList({
  title,
  items,
}: {
  title: string;
  items: JoinedSpecializationItem[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">{title}</h2>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
        {items.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <p className="truncate text-sm font-semibold text-strong">{item.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AppSettingsVerificationsPage() {
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [communityItems, setCommunityItems] = useState<CommunityVerificationItem[]>([]);
  const [joinedSpecializations, setJoinedSpecializations] = useState<JoinedSpecializationItem[]>([]);
  const [activeVerificationCommunity, setActiveVerificationCommunity] = useState<{
    communityId: string;
    communityName: string;
  } | null>(null);
  const [verificationDraft, setVerificationDraft] = useState<EmailVerificationDraft>({
    emailLocalPart: "",
    selectedDomain: "",
    submittedEmail: "",
    pendingCode: "",
    cooldownUntil: null,
  });
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const [communities, specializations] = await Promise.all([
        fetchCommunityVerifications(),
        fetchJoinedSpecializations(),
      ]);
      setCommunityItems(communities);
      setJoinedSpecializations(specializations);
      setStatus("idle");
    } catch (loadError) {
      const normalized = normalizeSettingsError(loadError);
      setStatus("error");
      setError(normalized.message || "Unable to load verifications.");
    }
  }, []);

  useEffect(() => {
    void loadVerifications();
  }, [loadVerifications]);

  useEffect(() => {
    if (!activeVerificationCommunity) return;
    setVerificationDraft({
      emailLocalPart: "",
      selectedDomain: "",
      submittedEmail: "",
      pendingCode: "",
      cooldownUntil: null,
    });
    setVerificationNotice(null);
  }, [activeVerificationCommunity]);

  const updateVerificationDraft = useCallback((nextDraft: Partial<EmailVerificationDraft>) => {
    setVerificationDraft((previous) => ({
      ...previous,
      ...nextDraft,
    }));
  }, []);

  const closeVerificationModal = useCallback(() => {
    setActiveVerificationCommunity(null);
    setVerificationNotice(null);
  }, []);

  const communityVerificationApi = useMemo(
    () => ({
      loadDomains: ({ communityId, signal }: { communityId: string; signal?: AbortSignal }) =>
        fetchCommunityVerificationDomains(communityId, { signal }),
      sendCode: ({ communityId, email }: { communityId: string; email: string }) =>
        startCommunityVerification({ communityId, method: "email", email }),
      verifyCode: ({ communityId, email, code }: { communityId: string; email: string; code: string }) =>
        finishCommunityVerification({ communityId, method: "email", code, email }),
    }),
    []
  );

  const communityVerificationAdapter = useMemo(
    () => ({
      afterVerifySuccess: async () => {
        setVerificationNotice("Verification complete.");
        await loadVerifications();
      },
    }),
    [loadVerifications]
  );

  const verificationMachine = useEmailVerificationMachine({
    enabled: Boolean(activeVerificationCommunity),
    communityId: activeVerificationCommunity?.communityId ?? null,
    draft: verificationDraft,
    onDraftChange: updateVerificationDraft,
    api: communityVerificationApi,
    adapter: communityVerificationAdapter,
    initialPreferredState: verificationDraft.submittedEmail ? "enter_code" : "enter_email",
    defaultCooldownSeconds: 60,
    onDone: () => {
      window.setTimeout(() => {
        closeVerificationModal();
      }, 350);
    },
  });

  const sortedCommunities = useMemo(() => {
    return [...communityItems].sort((a, b) => {
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return 1;
      return a.communityName.localeCompare(b.communityName);
    });
  }, [communityItems]);

  const majors = useMemo(
    () => joinedSpecializations.filter((item) => item.kind === "major").sort((a, b) => a.name.localeCompare(b.name)),
    [joinedSpecializations]
  );

  const fields = useMemo(
    () => joinedSpecializations.filter((item) => item.kind === "field").sort((a, b) => a.name.localeCompare(b.name)),
    [joinedSpecializations]
  );

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Verifications" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Community Verifications</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Read-only list of your verification statuses and joined majors/fields.
          </p>
        </header>

        {status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={`verification-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/60 bg-bg px-4 py-3">
                <div className="h-4 w-1/3 rounded-full bg-bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded-full bg-bg-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
            <p className="text-sm font-semibold text-strong">Unable to load verifications.</p>
            <p className="text-sm text-text-secondary">{error}</p>
            <button
              type="button"
              onClick={() => void loadVerifications()}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {status === "idle" ? (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">Communities</h2>
              {sortedCommunities.length > 0 ? (
                <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-bg">
                  {sortedCommunities.map((item) => {
                    const verifiedAt = formatDate(item.verifiedAt);
                    const expiresAt = formatDate(item.expiresAt);
                    return (
                      <div key={item.communityId} className="space-y-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-strong">{item.communityName}</p>
                            <p className="truncate text-xs text-text-secondary">{item.communityKind ?? "community"}</p>
                          </div>
                          <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                            {statusLabel(item)}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-text-secondary">
                          {item.verifiedEmail ? <p>Verified email: {item.verifiedEmail}</p> : item.email ? <p>Email: {item.email}</p> : null}
                          {verifiedAt ? <p>Verified: {verifiedAt}</p> : null}
                          {expiresAt ? <p>Expires: {expiresAt}</p> : null}
                          {item.rejectReason ? <p>Reason: {item.rejectReason}</p> : null}
                        </div>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveVerificationCommunity({
                                communityId: item.communityId,
                                communityName: item.communityName,
                              });
                            }}
                            className="rounded-full border border-border/70 bg-bg px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:text-strong"
                          >
                            {item.verified ? "Verify again" : "Verify email"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No community verifications yet.</p>
              )}
            </section>

            {majors.length > 0 ? <SpecializationList title="Joined Majors" items={majors} /> : null}
            {fields.length > 0 ? <SpecializationList title="Joined Fields" items={fields} /> : null}

            {majors.length === 0 && fields.length === 0 ? (
              <section className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">Specializations</h2>
                <p className="text-sm text-text-secondary">No joined majors or fields yet.</p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {activeVerificationCommunity ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-[680px] rounded-2xl border border-border/70 bg-bg p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-strong">Verify Your Email</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {activeVerificationCommunity.communityName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeVerificationModal}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:text-strong"
              >
                Close
              </button>
            </div>

            {verificationNotice ? (
              <p className="mb-3 rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary">
                {verificationNotice}
              </p>
            ) : null}

            <VerificationEmailFlow
              state={verificationMachine.state}
              communityName={activeVerificationCommunity.communityName}
              draft={verificationDraft}
              domains={verificationMachine.domains}
              errorMessage={verificationMachine.errorMessage}
              resendHelperText={verificationMachine.resendHelperText}
              canSendCode={verificationMachine.canSendCode}
              canVerifyCode={verificationMachine.canVerifyCode}
              canResendCode={verificationMachine.canResendCode}
              transitionLocked={verificationMachine.transitionLocked}
              overlayTitle={verificationMachine.overlayTitle}
              showBack={false}
              showSkip={false}
              onEmailLocalPartChange={verificationMachine.setEmailLocalPart}
              onDomainChange={verificationMachine.setSelectedDomain}
              onCodeChange={verificationMachine.setCode}
              onSendCode={() => {
                void verificationMachine.sendCode();
              }}
              onVerifyCode={() => {
                void verificationMachine.verifyCode();
              }}
              onResendCode={() => {
                void verificationMachine.resendCode();
              }}
              onRetryDomains={() => {
                void verificationMachine.retryDomains();
              }}
            />
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
