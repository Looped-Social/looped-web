import { useState } from "react";
import { Link } from "react-router";

import { AppStoreButton } from "~/components/AppStoreButton/AppStoreButton";
import { PageShell } from "~/components/PageShell/PageShell";
import { LoginCard } from "@/components/Auth/LoginCard";
import { AuthCard } from "@/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import { getFirebaseErrorMessage, sendPasswordReset } from "@/lib/firebaseClient";

export function LoginPage() {
  const { status, user, error, signIn, signInWithGoogle, signInWithApple, signOut } = useUserSession();
  const isBusy = status === "checking";
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetTone, setResetTone] = useState<"error" | "success">("success");

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
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Sign in to manage your Looped data
          </h1>
          <p className="text-lg leading-8 text-text-secondary">
            Looped is iOS-only today, but you can sign in here to{" "}
            <Link className="font-semibold text-brand hover:text-brand/90" to="/delete-account">
              deactivate or delete your account
            </Link>
            .
          </p>
          <ul className="space-y-3 text-base text-text-secondary">
            <li>Deactivate your account and stop activity.</li>
            <li>Delete your account and all associated data.</li>
            <li>Sign out automatically after you confirm.</li>
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
              description="Continue to the delete tools or sign out."
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                  Signed in as <span className="font-semibold text-strong">{user?.email ?? "your account"}</span>
                </div>
                <Link
                  to="/delete-account"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
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
              note="Accounts can only be created in the Looped iOS app."
              isBusy={isBusy || status === "loading"}
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
