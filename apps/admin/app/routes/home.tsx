import type { Route } from "./+types/home";

import { AdminHome } from "../components/AdminHome/AdminHome";
import { AdminShell } from "../components/AdminShell/AdminShell";
import { AuthCard } from "../components/Auth/AuthCard";
import { AuthLayout } from "../components/Auth/AuthLayout";
import { LoginCard } from "../components/Auth/LoginCard";
import { useAdminSession } from "../hooks/useAdminSession";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Admin" },
    { name: "description", content: "Looped admin dashboard" },
  ];
}

export default function Home() {
  const { status, admin, userEmail, error, signIn, signInWithGoogle, signInWithApple, signOut } =
    useAdminSession();
  const isBusy = status === "loading" || status === "checking";

  if (status === "unauthenticated") {
    return (
      <AuthLayout>
        <LoginCard
          onSubmit={signIn}
          onGoogle={signInWithGoogle}
          onApple={signInWithApple}
          error={error}
          isBusy={isBusy}
        />
      </AuthLayout>
    );
  }

  if (status === "unverified") {
    return (
      <AuthLayout>
        <AuthCard
          title="Verify your email"
          description="Please verify your Firebase email before accessing the admin dashboard."
        >
          <button
            type="button"
            onClick={signOut}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Sign out
          </button>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (status === "forbidden") {
    return (
      <AuthLayout>
        <AuthCard
          title="Access required"
          description="This account is not on the admin allowlist yet. Reach out to an owner to request access."
        >
          <button
            type="button"
            onClick={signOut}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Sign out
          </button>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (status === "error") {
    return (
      <AuthLayout>
        <AuthCard
          title="Unable to load admin access"
          description={error ?? "Please refresh and try again."}
        />
      </AuthLayout>
    );
  }

  if (!admin) {
    return (
      <AuthLayout>
        <AuthCard title="Checking access" description="Confirming your admin permissions..." />
      </AuthLayout>
    );
  }

  return (
    <AdminShell userEmail={userEmail} onSignOut={signOut}>
      <AdminHome admin={admin} />
    </AdminShell>
  );
}
