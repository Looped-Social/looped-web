import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { SettingsSubpageHeader } from "@/app/components/SettingsSubpageHeader/SettingsSubpageHeader";
import { useUserSession } from "@/hooks/useUserSession";
import { sendPasswordReset } from "@/lib/firebaseClient";
import { persistPostLogoutNotice } from "@/lib/postLogoutNotice";
import {
  fetchUserMe,
  parseUserApiError,
  type UnlinkProviderResponse,
  unlinkAppleProvider,
  unlinkGoogleProvider,
} from "@/lib/userApi";

type SupportedProviderId = "google.com" | "apple.com" | "password";

function providerLabel(providerId: string): string {
  if (providerId === "google.com") return "Google";
  if (providerId === "apple.com") return "Apple";
  if (providerId === "password") return "Email + Password";
  return providerId;
}

function supportedProviderId(providerId: string): SupportedProviderId | null {
  if (providerId === "google.com" || providerId === "apple.com" || providerId === "password") return providerId;
  return null;
}

function mapFriendlyProviderErrorMessage(providerId: string, message: string): string {
  const provider = providerLabel(providerId);
  const trimmed = message.trim();
  if (!trimmed) return `We couldn't update your ${provider} connection. Try again.`;
  return trimmed;
}

function isSessionError({
  status,
  code,
  reason,
  message,
}: {
  status: number | null;
  code: string | null;
  reason: string | null;
  message: string;
}): boolean {
  if (status === 401 || status === 403) return true;

  const normalizedCode = (code ?? "").toLowerCase();
  const normalizedReason = (reason ?? "").toLowerCase();
  const normalizedMessage = (message ?? "").toLowerCase();

  if (normalizedCode.includes("unauthorized") || normalizedCode.includes("unauthenticated")) return true;
  if (normalizedCode.includes("token") && (normalizedCode.includes("expired") || normalizedCode.includes("invalid"))) {
    return true;
  }
  if (normalizedReason.includes("token") && (normalizedReason.includes("expired") || normalizedReason.includes("invalid"))) {
    return true;
  }
  if (normalizedMessage.includes("session expired")) return true;
  if (normalizedMessage.includes("sign in again")) return true;
  if (normalizedMessage.includes("unauthorized") || normalizedMessage.includes("unauthenticated")) return true;
  return false;
}

function didUnlinkSucceed(payload: UnlinkProviderResponse): { success: boolean; alreadyDisconnected: boolean } {
  if (payload.unlinked === false) {
    return { success: false, alreadyDisconnected: true };
  }

  if (payload.unlinked === true) {
    return { success: true, alreadyDisconnected: false };
  }

  if (payload.disconnected === true) {
    return { success: true, alreadyDisconnected: false };
  }

  if (payload.linked === false || payload.providerLinked === false) {
    return { success: true, alreadyDisconnected: false };
  }

  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  if (status.includes("already") && (status.includes("disconnected") || status.includes("unlinked"))) {
    return { success: false, alreadyDisconnected: true };
  }
  if (status.includes("unlinked") || status.includes("disconnected") || status === "ok" || status === "success") {
    return { success: true, alreadyDisconnected: false };
  }

  return { success: true, alreadyDisconnected: false };
}

export function AppSettingsConnectedAccountsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useUserSession();
  const { showToast } = useToast();
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [isForcingSignOut, setIsForcingSignOut] = useState(false);
  const [unlinkedProviderIds, setUnlinkedProviderIds] = useState<string[]>([]);

  const providers = useMemo(() => {
    const providerData = user?.providerData ?? [];
    const ids = providerData
      .map((entry) => supportedProviderId(entry.providerId))
      .filter((entry): entry is SupportedProviderId => entry !== null)
      .filter((entry, index, array) => array.indexOf(entry) === index)
      .filter((entry) => !unlinkedProviderIds.includes(entry));
    return ids;
  }, [unlinkedProviderIds, user?.providerData]);

  const linkedMethodCount = useMemo(() => {
    return providers.filter((providerId) => providerId === "password" || providerId === "google.com" || providerId === "apple.com")
      .length;
  }, [providers]);

  const email = user?.email ?? undefined;

  const forceSignOutWithNotice = async (message: string) => {
    if (isForcingSignOut) return;
    setIsForcingSignOut(true);
    persistPostLogoutNotice(message);
    try {
      await signOut();
    } catch {
      // best-effort sign-out
    } finally {
      navigate("/login", { replace: true });
      setIsForcingSignOut(false);
    }
  };

  const handleSendReset = async () => {
    if (!email || isSendingReset || isForcingSignOut) return;
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
        title: "Connected Account Update Failed",
        message: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleUnlink = async (providerId: string) => {
    if (unlinkingProvider || isForcingSignOut) return;
    if (providerId !== "google.com" && providerId !== "apple.com") return;

    const provider = providerLabel(providerId);

    if (!providers.includes(providerId)) {
      showToast({
        kind: "error",
        title: "Connected Account Update Failed",
        message: "That account is already disconnected.",
      });
      return;
    }

    if (linkedMethodCount <= 1) {
      showToast({
        kind: "error",
        title: "Connected Account Update Failed",
        message: `You can’t disconnect ${provider} because it’s your only sign-in method. Add another sign-in method first.`,
      });
      return;
    }

    setUnlinkingProvider(providerId);
    try {
      const response =
        providerId === "google.com"
          ? await unlinkGoogleProvider()
          : await unlinkAppleProvider();

      const unlinkState = didUnlinkSucceed(response);
      if (unlinkState.alreadyDisconnected) {
        showToast({
          kind: "error",
          title: "Connected Account Update Failed",
          message: "That account is already disconnected.",
        });
        return;
      }

      if (!unlinkState.success) {
        showToast({
          kind: "error",
          title: "Connected Account Update Failed",
          message: `We couldn't disconnect ${provider}. Please try again.`,
        });
        return;
      }

      setUnlinkedProviderIds((current) => Array.from(new Set([...current, providerId])));
      showToast({
        kind: "success",
        title: `${provider} disconnected.`,
        message: `${provider} disconnected.`,
      });

      try {
        await Promise.all([
          fetchUserMe(),
          user ? user.getIdToken(true).then(() => undefined) : Promise.resolve(undefined),
        ]);
      } catch (reloadError) {
        const reloadParsed = parseUserApiError(reloadError);
        if (isSessionError(reloadParsed)) {
          await forceSignOutWithNotice(`${provider} was disconnected. Please sign in again.`);
        }
      }
    } catch (error) {
      const parsed = parseUserApiError(error);

      if (isSessionError(parsed)) {
        await forceSignOutWithNotice(
          `Your sign-in session expired while updating connected accounts. Please sign in again to confirm whether ${provider} was disconnected.`
        );
        return;
      }

      const reason = (parsed.reason ?? "").toLowerCase();
      const code = (parsed.code ?? "").toLowerCase();

      let message = mapFriendlyProviderErrorMessage(providerId, parsed.message);
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
        message = parsed.message || `Server failed to disconnect ${provider}. Please try again.`;
      } else if (code === "firebase_admin_not_configured" || parsed.status === 503) {
        message = `${provider} disconnect is temporarily unavailable.`;
      }

      showToast({
        kind: "error",
        title: "Connected Account Update Failed",
        message: mapFriendlyProviderErrorMessage(providerId, message),
      });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Connected Accounts" showAction={false} showBack={false} />
      <SettingsSubpageHeader backHref="/app/settings" />

      <div className="mx-auto w-full max-w-[560px] space-y-4 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Connected Accounts</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your linked sign-in methods for Apple and Google.
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
                      disabled={unlinkingProvider === provider || isForcingSignOut}
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
            disabled={!email || isSendingReset || isForcingSignOut}
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
