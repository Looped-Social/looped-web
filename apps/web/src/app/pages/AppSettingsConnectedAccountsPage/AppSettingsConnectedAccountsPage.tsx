import { useMemo, useState } from "react";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { sendPasswordReset } from "@/lib/firebaseClient";
import { useUserSession } from "@/hooks/useUserSession";

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

  const providers = useMemo(() => {
    const providerData = user?.providerData ?? [];
    const ids = providerData
      .map((entry) => entry.providerId)
      .filter((entry): entry is string => Boolean(entry))
      .filter((entry, index, array) => array.indexOf(entry) === index);
    return ids;
  }, [user?.providerData]);

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
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <span
                  key={provider}
                  className="rounded-full border border-border/70 bg-bg px-3 py-1.5 text-xs font-semibold text-text-secondary"
                >
                  {providerLabel(provider)}
                </span>
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
            Linking and unlinking providers from the web settings screen is not yet available.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
