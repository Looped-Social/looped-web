import { useMemo, useState } from "react";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { sendPasswordReset } from "@/lib/firebaseClient";
import { useUserSession } from "@/hooks/useUserSession";
import {
  parseUserApiError,
  unlinkAppleProvider,
  unlinkGoogleProvider,
} from "@/lib/userApi";

function providerLabel(providerId: string): string {
  if (providerId === "google.com") return "Google";
  if (providerId === "apple.com") return "Apple";
  if (providerId === "password") return "Email + Password";
  return providerId;
}

export function AppSettingsConnectedAccountsPage() {
  const { user } = useUserSession();
  const { showToast } = useToast();
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [unlinkedProviderIds, setUnlinkedProviderIds] = useState<string[]>([]);

  const providers = useMemo(() => {
    const providerData = user?.providerData ?? [];
    const ids = providerData
      .map((entry) => entry.providerId)
      .filter((entry): entry is string => Boolean(entry))
      .filter((entry, index, array) => array.indexOf(entry) === index)
      .filter((entry) => !unlinkedProviderIds.includes(entry));
    return ids;
  }, [unlinkedProviderIds, user?.providerData]);

  const email = user?.email ?? undefined;

  const handleSendReset = async () => {
    if (!email || isSendingReset) return;
    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      showToast({
        kind: "success",
        title: "Reset email sent",
        message: `Password reset email sent to ${email}.`,
      });
    } catch (error) {
      showToast({
        kind: "error",
        title: "Couldn’t send reset email",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleUnlink = async (providerId: string) => {
    if (unlinkingProvider) return;
    if (providerId !== "google.com" && providerId !== "apple.com") return;

    setUnlinkingProvider(providerId);
    try {
      if (providerId === "google.com") {
        await unlinkGoogleProvider();
      } else {
        await unlinkAppleProvider();
      }
      setUnlinkedProviderIds((current) => Array.from(new Set([...current, providerId])));
      showToast({
        kind: "success",
        title: `${providerLabel(providerId)} unlinked`,
        message: `${providerLabel(providerId)} has been disconnected from your account.`,
      });
    } catch (error) {
      const parsed = parseUserApiError(error);
      const reason = (parsed.reason ?? "").toLowerCase();
      const code = (parsed.code ?? "").toLowerCase();

      let message = parsed.message;
      if (code === "account_not_actionable") {
        if (reason === "backend_user_missing") {
          message = "This account is missing in backend and cannot be updated.";
        } else if (reason === "account_deleted") {
          message = "This account is already deleted.";
        } else if (reason === "firebase_user_not_found") {
          message = "This Firebase user no longer exists.";
        } else {
          message = "This account can't be updated right now.";
        }
      } else if (code === "account_disabled" || parsed.status === 403) {
        message = "This account is disabled and can't be changed.";
      } else if (code === "firebase_admin_error" || parsed.status === 502) {
        message = "Provider unlink failed on server. Please try again.";
      } else if (code === "firebase_admin_not_configured" || parsed.status === 503) {
        message = "Provider unlink is temporarily unavailable.";
      }

      showToast({
        kind: "error",
        title: `Couldn’t unlink ${providerLabel(providerId)}`,
        message,
      });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Connected Accounts" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" backLabel="Back to Settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Connected Accounts</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Current web support includes viewing active providers and sending password reset emails.
          </p>
        </header>

        <section className="space-y-2 rounded-2xl border border-border/60 bg-bg p-4">
          <h2 className="text-sm font-semibold text-strong">Sign-in providers</h2>
          {providers.length > 0 ? (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-bg px-3 py-2"
                >
                  <span className="text-sm font-semibold text-strong">{providerLabel(provider)}</span>
                  {provider === "google.com" || provider === "apple.com" ? (
                    <button
                      type="button"
                      onClick={() => void handleUnlink(provider)}
                      disabled={unlinkingProvider === provider}
                      className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                    >
                      {unlinkingProvider === provider ? "Unlinking…" : "Unlink"}
                    </button>
                  ) : (
                    <span className="text-xs text-text-light">Managed by auth provider</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No providers found for this session.</p>
          )}
          {email ? <p className="text-xs text-text-secondary">Signed in as {email}</p> : null}
        </section>

        <section className="space-y-2 rounded-2xl border border-border/60 bg-bg p-4">
          <h2 className="text-sm font-semibold text-strong">Password reset</h2>
          <p className="text-sm text-text-secondary">
            Send a password reset email for your account.
          </p>
          <button
            type="button"
            onClick={() => void handleSendReset()}
            disabled={!email || isSendingReset}
            className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isSendingReset ? "Sending…" : "Send reset email"}
          </button>
        </section>

        <section className="space-y-2 rounded-2xl border border-border/60 bg-bg p-4">
          <h2 className="text-sm font-semibold text-strong">Provider linking</h2>
          <p className="text-sm text-text-secondary">
            Link flows are still managed by auth providers. Web unlink uses backend account-provider endpoints.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
