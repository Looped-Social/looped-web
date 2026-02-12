import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { LoginCard } from "@/marketing/components/Auth/LoginCard";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import { getFirebaseErrorMessage, sendPasswordReset } from "@/lib/firebaseClient";

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

export function LoginPage() {
  const { status, user, error, signIn, signInWithGoogle, signInWithApple, signOut } = useUserSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isBusy = status === "checking";
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetTone, setResetTone] = useState<"error" | "success">("success");
  const postSignInDestination = useMemo(
    () => resolvePostSignInDestination(location.search),
    [location.search]
  );

  useEffect(() => {
    if (status === "authenticated") {
      navigate(postSignInDestination, { replace: true });
    }
  }, [navigate, postSignInDestination, status]);

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
      </div>
    </PageShell>
  );
}
