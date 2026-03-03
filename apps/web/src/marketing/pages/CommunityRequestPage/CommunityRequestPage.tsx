import { Link, useNavigate } from "react-router";

import { CommunityRequestFlow } from "@/app/components/CommunityRequestFlow/CommunityRequestFlow";
import { useUserSession } from "@/hooks/useUserSession";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { PageShell } from "@/marketing/components/PageShell/PageShell";

export function CommunityRequestPage() {
  const navigate = useNavigate();
  const { status, error: authError } = useUserSession();

  if (status === "loading" || status === "checking") {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-2xl justify-center">
          <AuthCard title="Checking your session" description="One moment while we verify your sign-in." />
        </div>
      </PageShell>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-2xl justify-center">
          <AuthCard
            title="Sign in required"
            description="You must be signed in to request a new community."
          >
            <div className="space-y-4">
              {authError ? <p className="text-sm text-brand">{authError}</p> : null}
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
              >
                Go to sign in
              </Link>
            </div>
          </AuthCard>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="space-y-1 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">Request a new community</h1>
          <p className="text-sm leading-6 text-text-secondary md:text-base">
            Tell us the company, school, field, or major you want to see on Looped.
          </p>
        </header>
        <div className="rounded-2xl border border-border bg-bg p-4 shadow-sm md:p-6">
          <CommunityRequestFlow
            mode="standard"
            onStandardComplete={() => {
              navigate("/app/settings", { replace: true });
            }}
          />
        </div>
      </div>
    </PageShell>
  );
}
