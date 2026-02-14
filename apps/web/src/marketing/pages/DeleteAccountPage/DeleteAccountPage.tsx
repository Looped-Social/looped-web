import { useState } from "react";
import { Link } from "react-router";

import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import { deactivateUser, deleteUser, parseUserApiError, UserApiError } from "@/lib/userApi";

type CompletionState = {
  title: string;
  message: string;
};

export function DeleteAccountPage() {
  const { status, user, error, signOut } = useUserSession();
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [action, setAction] = useState<"idle" | "deactivate" | "delete">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePhraseInput, setDeletePhraseInput] = useState("");
  const [deleteEmailInput, setDeleteEmailInput] = useState("");

  const deletePhrase = "DELETE MY DATA";
  const normalizedEmail = (user?.email ?? "").toLowerCase();
  const isDeleteConfirmed =
    deletePhraseInput.trim() === deletePhrase && deleteEmailInput.trim().toLowerCase() === normalizedEmail;

  const handleDeactivate = async () => {
    setAction("deactivate");
    setActionError(null);

    try {
      await deactivateUser();
      setCompletion({
        title: "Account deactivated",
        message: "Your account has been deactivated. You have been signed out.",
      });
      await signOut();
    } catch (err) {
      const message =
        err instanceof UserApiError
          ? err.details || err.message
          : err instanceof Error
            ? err.message
            : "Unable to deactivate your account.";
      setActionError(message);
    } finally {
      setAction("idle");
    }
  };

  const handleDelete = async () => {
    setAction("delete");
    setActionError(null);

    try {
      const response = await deleteUser();
      const isDeletePending = response.delete_pending === true;
      setCompletion({
        title: isDeletePending ? "Delete in progress" : "Account deleted",
        message: isDeletePending
          ? "Your account deletion is in progress. You have been signed out."
          : "Your account and data have been deleted. You have been signed out.",
      });
      try {
        await signOut();
      } catch {
        // delete is terminal; keep completion state and do not retry sign-out here
      }
    } catch (err) {
      const message = getDeleteErrorMessage(err);
      setActionError(message);
    } finally {
      setAction("idle");
    }
  };

  if (completion) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Request completed
          </div>
          <h1 className="text-3xl font-semibold text-strong md:text-4xl">{completion.title}</h1>
          <p className="text-base leading-7 text-text-secondary">{completion.message}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Back to home
          </Link>
        </div>
      </PageShell>
    );
  }

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
            description="Sign in to manage account deactivation or deletion."
          >
            <div className="space-y-4">
              {error && <p className="text-sm text-brand">{error}</p>}
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
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Account deletion</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Manage your Looped data
          </h1>
          <p className="text-lg leading-8 text-text-secondary">
            Choose whether to deactivate your account or permanently delete it.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-strong">Signed in as</span>
              <span className="text-text-primary">{user?.email ?? "Unknown email"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-bg p-6 shadow-sm">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-strong">Deactivate account</h2>
              <p className="text-sm text-text-secondary">
                Deactivation is a reversible pause. Your profile is hidden, you will not show in search or feed, and
                you will not receive notifications. If you log back in, your account reactivates. If you do not
                reactivate within 90 days, your account will be deleted.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeactivateModalOpen(true)}
              disabled={action !== "idle"}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "deactivate" ? "Deactivating..." : "Deactivate account"}
            </button>
          </div>

          <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-bg p-6 shadow-sm">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-strong">Delete account & data</h2>
              <p className="text-sm text-text-secondary">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={action !== "idle"}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "delete" ? "Deleting..." : "Delete all data"}
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
            {actionError}
          </div>
        )}
      </div>

      {isDeactivateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => {
            if (action !== "idle") return;
            setIsDeactivateModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-bg p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-strong">Confirm deactivation</h2>
              <p className="text-sm text-text-secondary">
                Deactivation is reversible. Your profile will be hidden until you sign in again.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                disabled={action !== "idle"}
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDeactivateModalOpen(false);
                  await handleDeactivate();
                }}
                disabled={action !== "idle"}
                className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Deactivate account
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg p-6 shadow-xl">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-strong">Confirm data deletion</h2>
              <p className="text-sm text-text-secondary">
                This permanently deletes your account and all data. Type{" "}
                <span className="font-semibold text-strong">{deletePhrase}</span> and your email to continue.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-light" htmlFor="delete-phrase">
                  Confirmation phrase
                </label>
                <input
                  id="delete-phrase"
                  type="text"
                  value={deletePhraseInput}
                  onChange={(event) => setDeletePhraseInput(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder={deletePhrase}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-light" htmlFor="delete-email">
                  Email address
                </label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteEmailInput}
                  onChange={(event) => setDeleteEmailInput(event.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder={user?.email ?? "you@company.com"}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletePhraseInput("");
                  setDeleteEmailInput("");
                }}
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!isDeleteConfirmed) return;
                  setIsDeleteModalOpen(false);
                  setDeletePhraseInput("");
                  setDeleteEmailInput("");
                  await handleDelete();
                }}
                disabled={!isDeleteConfirmed || action !== "idle" || !normalizedEmail}
                className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete my data
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function getDeleteErrorMessage(error: unknown): string {
  if (error instanceof UserApiError) {
    const parsed = parseUserApiError(error);
    const code = (parsed.code ?? "").toLowerCase();
    const reason = (parsed.reason ?? "").toLowerCase();

    if (code === "account_not_actionable") {
      if (reason === "backend_user_missing") {
        return "This account is missing in backend and cannot be deleted from web.";
      }
      if (reason === "account_deleted") {
        return "This account has already been deleted.";
      }
      if (reason === "firebase_user_not_found") {
        return "The linked Firebase user was not found.";
      }
      return "This account cannot be changed right now.";
    }
    if (code === "account_disabled" || parsed.status === 403) {
      return "This account is disabled and cannot be changed.";
    }
    if (code === "firebase_admin_error" || parsed.status === 502) {
      return "Account deletion is temporarily unavailable. Please try again.";
    }
    if (code === "firebase_admin_not_configured" || parsed.status === 503) {
      return "Account deletion is temporarily unavailable.";
    }
    if (code === "firebase_delete_failed") {
      return "We deleted your account, but Firebase cleanup failed. Contact support if you need help signing out everywhere.";
    }
    if (code === "firebase_admin_not_configured") {
      return "We deleted your account, but Firebase cleanup is not configured yet.";
    }

    return parsed.message || "Unable to delete your account.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to delete your account.";
}
