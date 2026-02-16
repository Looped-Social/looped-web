import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { LoginCard } from "@/marketing/components/Auth/LoginCard";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import { loginStatusFromAuthGateCode } from "@/lib/apiBase";
import { getFirebaseErrorMessage, sendPasswordReset } from "@/lib/firebaseClient";
import { consumePostLogoutNotice } from "@/lib/postLogoutNotice";

function resolvePostSignInDestination(rawSearch: string): string {
  const params = new URLSearchParams(rawSearch);
  const rawNext = params.get("next");
  if (!rawNext) return "/app";

  let next = rawNext;
  try {
    next = decodeURIComponent(rawNext);
  } catch {
    next = rawNext;
  }

  if (!next.startsWith("/") || next.startsWith("//")) return "/app";
  if (next.startsWith("/login")) return "/app";
  return next;
}

type LoginStatusCode = "delete-pending" | "onboarding-required" | "account-deleted";

function resolveStatusCode(rawSearch: string): LoginStatusCode | null {
  const params = new URLSearchParams(rawSearch);
  const status = params.get("status");
  if (status === "delete-pending" || status === "onboarding-required" || status === "account-deleted") {
    return status;
  }
  return null;
}

function resolveStatusMessage(statusCode: LoginStatusCode | null): string | null {
  if (statusCode === "delete-pending") return "Your account deletion is in progress. You have been signed out.";
  return null;
}

export function LoginPage() {
  const { status, user, error, signIn, signInWithGoogle, signInWithApple, signOut, authGateCode, accessState, onboardingStep } =
    useUserSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isBusy = status === "checking";
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetTone, setResetTone] = useState<"error" | "success">("success");
  const [postLogoutNotice, setPostLogoutNotice] = useState<string | null>(null);
  const postSignInDestination = useMemo(
    () => resolvePostSignInDestination(location.search),
    [location.search]
  );
  const statusCode = useMemo(() => resolveStatusCode(location.search), [location.search]);
  const statusMessage = useMemo(() => resolveStatusMessage(statusCode), [statusCode]);

  const gateStatusCode = authGateCode ? loginStatusFromAuthGateCode(authGateCode) : null;
  const effectiveStatusCode = gateStatusCode ?? statusCode;
  const isOnboardingBlocked = effectiveStatusCode === "onboarding-required" || accessState === "signed_in_blocked";
  const isDeletedBlocked = effectiveStatusCode === "account-deleted" || accessState === "deleted";
  const shouldShowBlockingCard = status !== "authenticated" && (isOnboardingBlocked || isDeletedBlocked);

  useEffect(() => {
    if (status === "authenticated") {
      navigate(postSignInDestination, { replace: true });
    }
  }, [navigate, postSignInDestination, status]);

  useEffect(() => {
    setPostLogoutNotice(consumePostLogoutNotice());
  }, []);

  const handleForgotPassword = async (email: string) => {
    if (!email) {
      setResetTone("error");
      setResetMessage("Enter your email to reset your password.");
      return;
    }

    setResetMessage(null);
    try {
      await sendPasswordReset(email);
      setResetTone("success");
      setResetMessage("Password reset email sent.");
    } catch (err) {
      setResetTone("error");
      setResetMessage(getFirebaseErrorMessage(err));
    }
  };

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Account access
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">Sign in to Looped</h1>
          <p className="text-lg leading-8 text-text-secondary">
            <span className="font-semibold text-brand">Web sign-up is not supported.</span> Create your account in the
            iOS app first, then sign in here on web using that same account.{" "}
            <span className="font-semibold text-brand">Web is sign-in only right now.</span> Android is not available yet.
          </p>
          <ul className="space-y-3 text-base text-text-secondary">
            <li>Web sign-up is not supported.</li>
            <li>Create your account in the Looped iOS app first.</li>
            <li>After sign-up, use web to sign in and access your account.</li>
          </ul>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-text-light">Need the app?</p>
            <AppStoreButton size={5.5} />
          </div>
        </div>

        <div className="flex flex-1 justify-center lg:justify-end">
          {status === "authenticated" ? (
            <AuthCard
              title="You're signed in"
              description="Taking you to your feed."
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                  Signed in as <span className="font-semibold text-strong">{user?.email ?? "your account"}</span>
                </div>
                <Link
                  to={postSignInDestination}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
                >
                  Continue
                </Link>
                <Link
                  to="/delete-account"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                >
                  Manage account deletion
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                >
                  Sign out
                </button>
              </div>
            </AuthCard>
          ) : (
            <div className="w-full max-w-[430px] space-y-3">
              {statusMessage ? (
                <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                  {statusMessage}
                </div>
              ) : null}
              {postLogoutNotice ? (
                <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                  {postLogoutNotice}
                </div>
              ) : null}
              {shouldShowBlockingCard ? (
                <AuthCard
                  title={isDeletedBlocked ? "Account unavailable" : "Finish account setup on iOS"}
                  description={
                    isDeletedBlocked
                      ? "This account was deleted. If this is unexpected, contact support."
                      : "Finish account setup in the Looped iOS app before using web."
                  }
                >
                  <div className="space-y-4">
                    {!isDeletedBlocked ? (
                      <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                        Finish account setup on iOS to continue.
                        {onboardingStep ? ` Current step: ${onboardingStep}.` : ""}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                        This account is marked as deleted.
                      </div>
                    )}

                    <div className="space-y-3">
                      {!isDeletedBlocked ? <AppStoreButton size={5.5} /> : null}
                      <Link
                        to={isDeletedBlocked ? "/contact" : "/faq"}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                      >
                        {isDeletedBlocked ? "Contact support" : "Need help?"}
                      </Link>
                      <Link
                        to="/login"
                        replace
                        className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                      >
                        Use a different account
                      </Link>
                    </div>
                  </div>
                </AuthCard>
              ) : (
                <LoginCard
                  onSubmit={signIn}
                  onGoogle={signInWithGoogle}
                  onApple={signInWithApple}
                  onForgotPassword={handleForgotPassword}
                  error={error}
                  resetMessage={resetMessage}
                  resetTone={resetTone}
                  note="No web sign-up. Create your account in the Looped iOS app first, then sign in here."
                  isBusy={isBusy || status === "loading"}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
