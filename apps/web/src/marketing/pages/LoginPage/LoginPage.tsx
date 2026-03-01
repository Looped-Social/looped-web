import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { LoginCard } from "@/marketing/components/Auth/LoginCard";
import { SignupCard } from "@/marketing/components/Auth/SignupCard";
import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { useUserSession } from "@/hooks/useUserSession";
import { loginStatusFromAuthGateCode } from "@/lib/apiBase";
import { getFirebaseErrorMessage, sendPasswordReset } from "@/lib/firebaseClient";
import { consumePostLogoutNotice } from "@/lib/postLogoutNotice";

function resolvePostSignInDestination(rawSearch: string): string {
  const params = new URLSearchParams(rawSearch);
  const rawNext = params.get("next");
  if (!rawNext) return "/app";

  const next = decodeURIComponentSafely(rawNext);
  if (!next.startsWith("/") || next.startsWith("//")) return "/app";
  if (next.startsWith("/login")) return "/app";
  return next;
}

function decodeURIComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type LoginStatusCode = "delete-pending" | "onboarding-required" | "account-deleted";
type AuthMode = "login" | "signup";

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

function resolveAuthMode(pathname: string, rawSearch: string): AuthMode {
  const params = new URLSearchParams(rawSearch);
  const mode = params.get("mode");
  if (mode === "signup") return "signup";
  if (mode === "login") return "login";
  if (pathname === "/signup") return "signup";
  return "login";
}

export function LoginPage() {
  const {
    status,
    user,
    error,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut,
    authGateCode,
    accessState,
    onboardingStep,
  } = useUserSession();
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
  const initialMode = useMemo(() => resolveAuthMode(location.pathname, location.search), [location.pathname, location.search]);
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const statusCode = useMemo(() => resolveStatusCode(location.search), [location.search]);
  const statusMessage = useMemo(() => resolveStatusMessage(statusCode), [statusCode]);

  const gateStatusCode = authGateCode ? loginStatusFromAuthGateCode(authGateCode) : null;
  const effectiveStatusCode = gateStatusCode ?? statusCode;
  const isOnboardingBlocked = effectiveStatusCode === "onboarding-required" || accessState === "signed_in_blocked";
  const isDeletedBlocked = effectiveStatusCode === "account-deleted" || accessState === "deleted";
  const isDeletePendingBlocked = effectiveStatusCode === "delete-pending" || accessState === "delete_pending";
  const shouldShowBlockingCard =
    (isDeletedBlocked || isDeletePendingBlocked) ||
    (status !== "authenticated" && isOnboardingBlocked);

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (status === "authenticated") {
      if (accessState === "signed_in_blocked") {
        navigate("/onboarding", { replace: true });
      } else if (accessState === "active") {
        navigate(postSignInDestination, { replace: true });
      }
    }
  }, [accessState, navigate, postSignInDestination, status]);

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

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    const params = new URLSearchParams(location.search);
    params.set("mode", mode);
    const query = params.toString();
    navigate(query ? `/login?${query}` : "/login", { replace: true });
  };

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div className="flex-1 space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            {authMode === "signup" ? "Create your Looped account" : "Welcome back to Looped"}
          </h1>
          <p className="text-lg leading-8 text-text-secondary">
            Sign up and complete onboarding directly on web. Verification is email-only on web for now, and photo ID
            verification remains iOS-only.
          </p>
          <ul className="space-y-3 text-base text-text-secondary">
            <li>Sign up or sign in with email/password.</li>
            <li>Complete onboarding on web with organization email verification.</li>
            <li>Continue in the app when onboarding is complete.</li>
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
                  title={isDeletePendingBlocked ? "Deletion in progress" : isDeletedBlocked ? "Account unavailable" : "Finish account setup"}
                  description={
                    isDeletePendingBlocked
                      ? "Your account is still being deleted. Sign-in is blocked until processing completes."
                      : isDeletedBlocked
                      ? "This account was deleted. If this is unexpected, contact support."
                      : "Continue onboarding on web to finish account setup."
                  }
                >
                  <div className="space-y-4">
                    {!isDeletedBlocked && !isDeletePendingBlocked ? (
                      <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                        Continue onboarding to finish account setup.
                        {onboardingStep ? ` Current step: ${onboardingStep}.` : ""}
                      </div>
                    ) : isDeletePendingBlocked ? (
                      <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                        Account deletion is still processing. Try signing in again in a few minutes.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                        This account is marked as deleted.
                      </div>
                    )}

                    <div className="space-y-3">
                      {!isDeletedBlocked && !isDeletePendingBlocked ? (
                        <Link
                          to="/onboarding"
                          className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
                        >
                          Continue onboarding
                        </Link>
                      ) : null}
                      <Link
                        to={isDeletedBlocked || isDeletePendingBlocked ? "/contact" : "/faq"}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
                      >
                        {isDeletedBlocked || isDeletePendingBlocked ? "Contact support" : "Need help?"}
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
                <>
                  <div className="grid grid-cols-2 rounded-lg bg-bg-muted p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className={`rounded-md px-3 py-2 transition ${authMode === "login" ? "bg-bg text-strong" : "text-text-secondary"}`}
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className={`rounded-md px-3 py-2 transition ${authMode === "signup" ? "bg-bg text-strong" : "text-text-secondary"}`}
                    >
                      Sign up
                    </button>
                  </div>

                  {authMode === "login" ? (
                    <LoginCard
                      onSubmit={signIn}
                      onGoogle={signInWithGoogle}
                      onApple={signInWithApple}
                      onForgotPassword={handleForgotPassword}
                      error={error}
                      resetMessage={resetMessage}
                      resetTone={resetTone}
                      note="New here? Create an account and continue onboarding on web."
                      isBusy={isBusy || status === "loading"}
                    />
                  ) : (
                    <SignupCard
                      onSubmit={signUp}
                      onSwitchToLogin={() => switchMode("login")}
                      error={error}
                      isBusy={isBusy || status === "loading"}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
