import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { AuthCard } from "@/marketing/components/Auth/AuthCard";
import { useUserSession } from "@/hooks/useUserSession";
import {
  deactivateUser,
  deleteUser,
  fetchDeleteUserStatus,
  isDeleteCompleted,
  isDeleteInProgress,
  parseUserApiError,
  resolveDeletionStatus,
  UserApiError,
} from "@/lib/userApi";

type CompletionState = {
  title: string;
  message: string;
};

const POLL_DELAYS_MS = [2_000, 3_000, 5_000];
const LONG_RUNNING_THRESHOLD_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function DeleteAccountPage() {
  const { status, user, error, signOut } = useUserSession();
  const isMountedRef = useRef(true);
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [action, setAction] = useState<"idle" | "deactivate" | "delete">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "submitting" | "polling">("idle");
  const [deleteStatusMessage, setDeleteStatusMessage] = useState("Deleting your account.");
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);
  const [deleteLongRunning, setDeleteLongRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePhraseInput, setDeletePhraseInput] = useState("");
  const [deleteEmailInput, setDeleteEmailInput] = useState("");

  const deletePhrase = "DELETE MY DATA";
  const normalizedEmail = (user?.email ?? "").toLowerCase();
  const isDeleteConfirmed =
    deletePhraseInput.trim() === deletePhrase && deleteEmailInput.trim().toLowerCase() === normalizedEmail;
  const isDeleteBusy = action === "delete" && deleteState !== "idle";

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (isMountedRef.current) {
        setAction("idle");
      }
    }
  };

  const handleDelete = async () => {
    setAction("delete");
    setDeleteState("submitting");
    setDeleteStatusMessage("Starting account deletion request...");
    setDeleteOperationId(null);
    setDeleteLongRunning(false);
    setActionError(null);

    const startedAt = Date.now();
    let statusEndpoint: string | undefined;
    let pollAttempt = 0;
    let pollNetworkFailures = 0;

    try {
      const response = await deleteUser();
      if (!isMountedRef.current) return;

      setDeleteOperationId(response.operation_id ?? null);
      statusEndpoint = response.status_endpoint;

      const deleteStatus = resolveDeletionStatus(response);
      if (isDeleteCompleted(deleteStatus)) {
        setCompletion({
          title: "Account deleted",
          message: "Your account and data have been deleted. You have been signed out.",
        });
        try {
          await signOut();
        } catch {
          // delete is terminal; keep completion state and do not retry sign-out here
        }
        setDeleteState("idle");
        setAction("idle");
        return;
      }

      if (!isDeleteInProgress(deleteStatus)) {
        throw new Error("Unable to confirm account deletion status. Please try again.");
      }

      setDeleteState("polling");
      setDeleteStatusMessage("Deleting your account. This can take up to a minute.");

      while (true) {
        if (Date.now() - startedAt >= LONG_RUNNING_THRESHOLD_MS) {
          setDeleteLongRunning(true);
          setDeleteStatusMessage("Still processing your deletion request. Keep this page open.");
        }

        const delayMs = POLL_DELAYS_MS[Math.min(pollAttempt, POLL_DELAYS_MS.length - 1)];
        await sleep(delayMs);
        if (!isMountedRef.current) return;

        let pollResponse: Awaited<ReturnType<typeof fetchDeleteUserStatus>>;
        try {
          pollResponse = await fetchDeleteUserStatus(statusEndpoint);
          pollNetworkFailures = 0;
        } catch (pollError) {
          const parsed = parseUserApiError(pollError);
          if (parsed.status === 0 && pollNetworkFailures < 3) {
            pollNetworkFailures += 1;
            setDeleteStatusMessage("This is taking longer than expected. Retrying status check...");
            pollAttempt += 1;
            continue;
          }
          throw pollError;
        }

        if (!isMountedRef.current) return;

        statusEndpoint = pollResponse.status_endpoint ?? statusEndpoint;
        if (pollResponse.operation_id) {
          setDeleteOperationId(pollResponse.operation_id);
        }

        const pollStatus = resolveDeletionStatus(pollResponse);
        if (isDeleteCompleted(pollStatus)) {
          setCompletion({
            title: "Account deleted",
            message: "Your account and data have been deleted. You have been signed out.",
          });
          try {
            await signOut();
          } catch {
            // delete is terminal; keep completion state and do not retry sign-out here
          }
          setDeleteState("idle");
          setAction("idle");
          return;
        }

        if (pollStatus === "failed") {
          throw new Error("Account deletion failed. Please try again or contact support.");
        }

        if (!isDeleteInProgress(pollStatus)) {
          throw new Error("Unable to confirm account deletion status. Please try again.");
        }

        pollAttempt += 1;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setDeleteState("idle");
      setDeleteOperationId(null);
      setDeleteLongRunning(false);
      setActionError(getDeleteErrorMessage(err));
    } finally {
      if (isMountedRef.current) {
        setAction("idle");
      }
    }
  };

  const deleteActionLabel =
    deleteState === "submitting"
      ? "Submitting request..."
      : deleteState === "polling"
        ? "Processing delete..."
        : "Delete all data";

  if (completion) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-700">
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
              {deleteActionLabel}
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
            {actionError}
          </div>
        )}
      </div>

      {isDeleteBusy ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg p-6 text-center shadow-xl">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
            <h2 className="mt-4 text-lg font-semibold text-strong">Processing account deletion</h2>
            <p className="mt-2 text-sm text-text-secondary">{deleteStatusMessage}</p>
            {deleteLongRunning ? (
              <p className="mt-3 rounded-lg border border-border bg-bg-muted px-3 py-2 text-xs text-text-secondary">
                Deletion can take longer than expected. We'll keep checking until it completes.
              </p>
            ) : null}
            {deleteOperationId ? (
              <p className="mt-3 text-xs text-text-light">Operation ID: {deleteOperationId}</p>
            ) : null}
          </div>
        </div>
      ) : null}

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

    if (code === "account_delete_pending") {
      return "Account deletion is already in progress. Please wait a moment and try again.";
    }

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
    if (code === "firebase_delete_failed" || parsed.status === 502) {
      return "We couldn't complete account deletion right now. Please try again.";
    }
    if (code === "firebase_admin_not_configured" || parsed.status === 503) {
      return "Account deletion is temporarily unavailable. Please contact support.";
    }
    if (parsed.status === 0) {
      return "Deletion is taking longer than expected due to network issues. Please try again.";
    }

    return parsed.message || "Unable to delete your account.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to delete your account.";
}
