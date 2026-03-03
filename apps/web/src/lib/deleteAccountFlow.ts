import { resolveDeletionStatus, type DeleteUserResponse } from "@/lib/userApi";

export const DELETE_SLOW_THRESHOLD_MS = 15_000;
export const DELETE_POLL_DELAYS_MS = [2_000, 3_000, 5_000] as const;
export const DELETE_PENDING_TIMEOUT_MS = 120_000;
export const ACCOUNT_DELETION_REQUESTED_NOTICE = "Account Deletion Requested";
export const ACCOUNTS_DELETED_NOTICE = "Accounts Deleted";
const DELETE_DEBUG_STORAGE_KEY = "looped-delete-debug";

export function assertDeleteResponseSucceeded(response: DeleteUserResponse): void {
  const status = resolveDeletionStatus(response);
  if (status === "failed") {
    throw new Error("Account deletion failed. Please try again or contact support.");
  }

  if (status === "none") {
    throw new Error("Unable to confirm account deletion status. Please try again.");
  }

  if (status === "completed" || status === "pending" || status === "in_progress") {
    return;
  }

  if (typeof response.delete_pending === "boolean") {
    return;
  }

  throw new Error("Unable to confirm account deletion status. Please try again.");
}

export function isDeletePendingResponse(response: DeleteUserResponse): boolean {
  if (response.delete_pending === true) return true;
  if (response.delete_pending === false) return false;
  const status = resolveDeletionStatus(response);
  return status === "pending" || status === "in_progress";
}

export function getDeleteCompletionNotice(response: DeleteUserResponse): string {
  return isDeletePendingResponse(response) ? ACCOUNT_DELETION_REQUESTED_NOTICE : ACCOUNTS_DELETED_NOTICE;
}

export function getDeleteProgressMessage(isTakingLongerThanExpected: boolean): string {
  if (isTakingLongerThanExpected) {
    return "Deleting is taking longer than expected. Please keep this screen open.";
  }
  return "Please keep this screen open while we delete your account.";
}

export function getDeletePendingTimeoutMessage(operationId?: string | null): string {
  const id = typeof operationId === "string" ? operationId.trim() : "";
  if (id) {
    return `Account deletion is still processing. Contact support with operation ID ${id}.`;
  }
  return "Account deletion is still processing. Please contact support.";
}

export function recordDeleteDebugEvent({
  source,
  stage,
  operationId,
  deletionStatus,
  deletePending,
  requestId,
}: {
  source: "marketing" | "settings";
  stage: "start" | "status";
  operationId?: string | null;
  deletionStatus?: string | null;
  deletePending?: boolean | null;
  requestId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(DELETE_DEBUG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const entries = Array.isArray(parsed) ? parsed : [];
    entries.push({
      at: new Date().toISOString(),
      source,
      stage,
      operation_id: operationId ?? null,
      deletion_status: deletionStatus ?? null,
      delete_pending: typeof deletePending === "boolean" ? deletePending : null,
      request_id: requestId ?? null,
    });
    const trimmed = entries.slice(-50);
    window.sessionStorage.setItem(DELETE_DEBUG_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // best effort only
  }
}

export async function revokeAnonIdentityForDeleteBestEffort(): Promise<void> {
  // Web does not currently persist anonymous persona credentials, so there is
  // nothing concrete to revoke client-side yet. Keep this hook for parity.
}
