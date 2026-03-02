import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { type ThemePreference, useTheme } from "@looped/ui";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import { updatePreferCommunityShortNames, usePreferCommunityShortNames } from "@/lib/communityDisplayPreference";
import { fetchContentPreferences, updateContentPreferences } from "@/lib/contentPreferencesApi";
import { readContentPreferences, updateContentPreferencesCache } from "@/lib/contentPreferences";
import {
  ACCOUNTS_DELETED_NOTICE,
  assertDeleteResponseSucceeded,
  DELETE_PENDING_TIMEOUT_MS,
  DELETE_POLL_DELAYS_MS,
  DELETE_SLOW_THRESHOLD_MS,
  getDeletePendingTimeoutMessage,
  getDeleteProgressMessage,
  recordDeleteDebugEvent,
  revokeAnonIdentityForDeleteBestEffort,
} from "@/lib/deleteAccountFlow";
import { signOutUser } from "@/lib/firebaseClient";
import { persistPostLogoutNotice } from "@/lib/postLogoutNotice";
import { type MessagePermission, updateMySafetySettings } from "@/lib/settingsApi";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import { isMatchingConfirmationPhrase } from "@/lib/settingsValidation";
import {
  deactivateUser,
  deleteUser,
  fetchDeleteUserStatus,
  parseUserApiError,
  resolveDeletionStatus,
} from "@/lib/userApi";
import {
  clearCurrentUserStore,
  loadCurrentUser,
  patchCurrentUser,
  refreshCurrentUser,
  useCurrentUserStore,
} from "@/stores/currentUserStore";

const MESSAGE_PERMISSION_OPTIONS: Array<{ value: MessagePermission; label: string }> = [
  { value: "all", label: "Everyone" },
  { value: "company", label: "Company only" },
  { value: "following", label: "Following only" },
  { value: "no_one", label: "No one" },
];

const THEME_PREFERENCE_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type PendingActionKind = "deactivate" | "delete" | "logout";
type PendingActionStep = "intro" | "confirm";
type AsyncState = "idle" | "loading" | "saving" | "success" | "error";

const SETTINGS_ICON = {
  accountUser: "/icons/settings/account/user.svg",
  accountLock: "/icons/settings/account/lock.svg",
  accountShield: "/icons/settings/account/shield-solid-full.svg",
  accountBell: "/icons/settings/account/bell.svg",
  verified: "/icons/verified.svg",
  safetyFollowerCounts: "/icons/settings/saftey/follower-counts.svg",
  safetyMessagePermissions: "/icons/settings/saftey/message-perimissions.svg",
  safetyUserSlash: "/icons/settings/saftey/user-slash-solid-full.svg",
  supportQuestion: "/icons/settings/support/circle-question.svg",
  supportScroll: "/icons/settings/support/scroll.svg",
  supportTerms: "/icons/settings/support/terms.svg",
  supportUserAgreement: "/icons/settings/support/user-agreement.svg",
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function parseApiErrorMessage(error: unknown): string {
  const normalized = normalizeSettingsError(error);
  if (normalized.code === "network_error") return "Check your connection and try again.";
  if (normalized.code === "unauthorized" || normalized.code === "http_401") {
    return "Your session expired. Please sign in again.";
  }
  if (normalized.code === "forbidden" || normalized.code === "http_403") {
    return "You don't have permission to do that.";
  }
  if (normalized.message.trim().length > 0) return normalized.message;
  return normalized.code.replaceAll("_", " ");
}

function parseDeleteApiErrorMessage(error: unknown): string {
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
    return "This account cannot be changed right now.";
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
  if (parsed.message.trim().length > 0) {
    return parsed.message;
  }
  return "Unable to delete your account.";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-text-light">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-bg">{children}</div>
    </section>
  );
}

function SettingsRowLabel({
  label,
  iconSrc,
  labelClassName = "text-sm font-semibold text-strong",
}: {
  label: string;
  iconSrc?: string;
  labelClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0 object-contain"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <p className={`min-w-0 truncate ${labelClassName}`}>{label}</p>
    </div>
  );
}

function LinkRow({
  label,
  to,
  iconSrc,
}: {
  label: string;
  to: string;
  iconSrc?: string;
}) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-bg-muted/30">
      <SettingsRowLabel label={label} iconSrc={iconSrc} />
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-light" />
    </Link>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
  iconSrc,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  iconSrc?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <SettingsRowLabel label={label} iconSrc={iconSrc} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`inline-flex h-7 w-12 items-center rounded-full px-1 transition ${
          checked ? "bg-secondary" : "bg-border"
        } disabled:opacity-60`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  disabled,
  onChange,
  iconSrc,
}: {
  label: string;
  value: MessagePermission;
  disabled?: boolean;
  onChange: (value: MessagePermission) => void;
  iconSrc?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <SettingsRowLabel label={label} iconSrc={iconSrc} />
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as MessagePermission)}
        className="rounded-lg border border-border/70 bg-bg px-2 py-1.5 text-xs font-semibold text-strong outline-none"
        aria-label={label}
      >
        {MESSAGE_PERMISSION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActionRow({
  label,
  destructive = false,
  disabled = false,
  onClick,
  iconSrc,
}: {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  iconSrc?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full px-4 py-3 text-left transition hover:bg-bg-muted/30 disabled:opacity-60"
    >
      <SettingsRowLabel
        label={label}
        iconSrc={iconSrc}
        labelClassName={`text-sm font-semibold ${destructive ? "text-brand" : "text-strong"}`}
      />
    </button>
  );
}

function ThemeModeRow({
  value,
  disabled,
  onChange,
}: {
  value: ThemePreference;
  disabled?: boolean;
  onChange: (next: ThemePreference) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="min-w-0 text-sm font-semibold text-strong">Theme</p>
      <div className="inline-flex rounded-lg bg-bg-muted p-1">
        {THEME_PREFERENCE_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                active ? "bg-secondary text-white" : "text-text-secondary hover:text-strong"
              } disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppSettingsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { preference: themePreference, setThemePreference } = useTheme();

  const currentUserState = useCurrentUserStore({ autoLoad: true });
  const [accountUsername, setAccountUsername] = useState("myaccount");
  const [showFollowerCount, setShowFollowerCount] = useState(true);
  const [messagePermission, setMessagePermission] = useState<MessagePermission>("following");
  const [hideAnonymousPosts, setHideAnonymousPosts] = useState(readContentPreferences().hideAnonymousPosts);
  const preferCommunityShortNames = usePreferCommunityShortNames();

  const [followerState, setFollowerState] = useState<AsyncState>("idle");
  const [messagePermissionState, setMessagePermissionState] = useState<AsyncState>("idle");
  const [hideAnonymousPostsState, setHideAnonymousPostsState] = useState<AsyncState>("idle");
  const [communityNamePreferenceState, setCommunityNamePreferenceState] = useState<AsyncState>("idle");
  const [themePreferenceState, setThemePreferenceState] = useState<AsyncState>("idle");
  const [actionState, setActionState] = useState<AsyncState>("idle");
  const [deleteProgressText, setDeleteProgressText] = useState<string | null>(null);
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);
  const [deleteLongRunning, setDeleteLongRunning] = useState(false);

  const [rowError, setRowError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingActionKind | null>(null);
  const [pendingActionStep, setPendingActionStep] = useState<PendingActionStep>("intro");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  useEffect(() => {
    const user = currentUserState.user;
    if (!user) return;
    setAccountUsername((user.username ?? "myaccount").replace(/^@/, "").toLowerCase() || "myaccount");
    setShowFollowerCount(user.showFollowerCount);
    setMessagePermission(user.messagePermission);
  }, [currentUserState.user]);

  useEffect(() => {
    let active = true;
    void fetchContentPreferences()
      .then((response) => {
        if (!active) return;
        const serverValue = response.content.hideAnonymousPosts;
        setHideAnonymousPosts(serverValue);
        updateContentPreferencesCache({ hideAnonymousPosts: serverValue }, { broadcast: false });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const requiredPhrase = useMemo(() => {
    if (pendingAction === "deactivate") return `deactivate my account for ${accountUsername}`;
    if (pendingAction === "delete") return `delete my account for ${accountUsername}`;
    return "";
  }, [accountUsername, pendingAction]);

  const flowTitle = useMemo(() => {
    if (pendingAction === "deactivate") {
      return pendingActionStep === "confirm" ? "Confirm Deactivation" : "Deactivate Account";
    }
    if (pendingAction === "delete") {
      return pendingActionStep === "confirm" ? "Confirm Delete" : "Delete Account";
    }
    if (pendingAction === "logout") return "Log Out";
    return "";
  }, [pendingAction, pendingActionStep]);

  const handleToggleFollowerCount = useCallback(async () => {
    if (followerState === "saving") return;
    const previous = showFollowerCount;
    const next = !showFollowerCount;

    setShowFollowerCount(next);
    patchCurrentUser({ showFollowerCount: next });
    setFollowerState("saving");
    setRowError(null);

    try {
      const patch = await updateMySafetySettings({
        isAnonymous: false,
        showFollowerCount: next,
        messagePermission,
      });
      if (patch) patchCurrentUser(patch);
      await refreshCurrentUser();
      setFollowerState("success");
      showToast({
        kind: "success",
        title: "Setting updated",
        message: `Show Follower Count ${next ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      setShowFollowerCount(previous);
      patchCurrentUser({ showFollowerCount: previous });
      setFollowerState("error");
      const message = parseApiErrorMessage(error);
      setRowError(message);
      showToast({
        kind: "error",
        title: "Couldn’t update setting",
        message,
      });
    } finally {
      setTimeout(() => setFollowerState("idle"), 0);
    }
  }, [followerState, messagePermission, showFollowerCount, showToast]);

  const handleChangeMessagePermission = useCallback(
    async (next: MessagePermission) => {
      if (next === messagePermission || messagePermissionState === "saving") return;

      setMessagePermissionState("saving");
      setRowError(null);

      try {
        const patch = await updateMySafetySettings({
          isAnonymous: false,
          showFollowerCount,
          messagePermission: next,
        });
        if (patch) patchCurrentUser(patch);
        setMessagePermission(next);
        patchCurrentUser({ messagePermission: next });
        await refreshCurrentUser();
        setMessagePermissionState("success");
      } catch (error) {
        setMessagePermissionState("error");
        const message = parseApiErrorMessage(error);
        setRowError(message);
        showToast({
          kind: "error",
          title: "Couldn’t update setting",
          message,
        });
      } finally {
        setTimeout(() => setMessagePermissionState("idle"), 0);
      }
    },
    [messagePermission, messagePermissionState, showFollowerCount, showToast]
  );

  const handleToggleHideAnonymousPosts = useCallback(async () => {
    if (hideAnonymousPostsState === "saving") return;
    const previous = hideAnonymousPosts;
    const next = !hideAnonymousPosts;

    setHideAnonymousPosts(next);
    setHideAnonymousPostsState("saving");
    setRowError(null);

    try {
      const response = await updateContentPreferences({ hideAnonymousPosts: next });
      const serverValue = response.content.hideAnonymousPosts;
      setHideAnonymousPosts(serverValue);
      updateContentPreferencesCache({ hideAnonymousPosts: serverValue }, { broadcast: true });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("looped:content-refresh"));
      }
      setHideAnonymousPostsState("success");
      showToast({
        kind: "success",
        title: "Setting updated",
        message: `Hide Anonymous Posts ${serverValue ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      setHideAnonymousPosts(previous);
      updateContentPreferencesCache({ hideAnonymousPosts: previous }, { broadcast: false });
      setHideAnonymousPostsState("error");
      const message = parseApiErrorMessage(error);
      setRowError(message);
      showToast({
        kind: "error",
        title: "Couldn't update content preference",
        message,
      });
    } finally {
      setTimeout(() => setHideAnonymousPostsState("idle"), 0);
    }
  }, [hideAnonymousPosts, hideAnonymousPostsState, showToast]);

  const handleTogglePreferCommunityShortNames = useCallback(() => {
    if (communityNamePreferenceState === "saving") return;
    setCommunityNamePreferenceState("saving");
    setRowError(null);
    const next = !preferCommunityShortNames;
    try {
      updatePreferCommunityShortNames(next);
      setCommunityNamePreferenceState("success");
      showToast({
        kind: "success",
        title: "Setting updated",
        message: `Prefer Community Short Names ${next ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      setCommunityNamePreferenceState("error");
      const message = parseApiErrorMessage(error);
      setRowError(message);
      showToast({
        kind: "error",
        title: "Couldn't update setting",
        message,
      });
    }
    setTimeout(() => setCommunityNamePreferenceState("idle"), 0);
  }, [communityNamePreferenceState, preferCommunityShortNames, showToast]);

  const handleThemePreferenceChange = useCallback(
    (next: ThemePreference) => {
      if (themePreferenceState === "saving" || next === themePreference) return;
      setThemePreferenceState("saving");
      try {
        setThemePreference(next);
        setThemePreferenceState("success");
        showToast({
          kind: "success",
          title: "Theme updated",
          message: `Theme set to ${next}.`,
        });
      } catch (error) {
        setThemePreferenceState("error");
        const message = parseApiErrorMessage(error);
        showToast({
          kind: "error",
          title: "Couldn't update theme",
          message,
        });
      } finally {
        setTimeout(() => setThemePreferenceState("idle"), 0);
      }
    },
    [setThemePreference, showToast, themePreference, themePreferenceState]
  );

  const handleSignOut = useCallback(async (): Promise<boolean> => {
    if (actionState === "saving") return false;
    setActionState("saving");
    setModalError(null);

    let success = false;
    try {
      await signOutUser();
      clearCurrentUserStore();
      setActionState("success");
      success = true;
      navigate("/login", { replace: true });
    } catch (error) {
      setActionState("error");
      const message = parseApiErrorMessage(error);
      setModalError(message);
      showToast({
        kind: "error",
        title: "Couldn’t log out",
        message,
      });
    } finally {
      if (!success) {
        setActionState("idle");
      }
    }
    return success;
  }, [actionState, navigate, showToast]);

  const openPendingAction = useCallback((kind: PendingActionKind) => {
    setPendingAction(kind);
    setPendingActionStep("intro");
    setConfirmPhrase("");
    setModalError(null);
    setDeleteProgressText(null);
    setDeleteOperationId(null);
    setDeleteLongRunning(false);
  }, []);

  const closeConfirmation = useCallback(() => {
    if (actionState === "saving") return;
    setPendingAction(null);
    setPendingActionStep("intro");
    setConfirmPhrase("");
    setModalError(null);
    setDeleteProgressText(null);
    setDeleteOperationId(null);
    setDeleteLongRunning(false);
  }, [actionState]);

  const confirmDestructiveAction = useCallback(async () => {
    if (!pendingAction || actionState === "saving") return;

    if (pendingAction === "logout") {
      const success = await handleSignOut();
      if (success) {
        setPendingAction(null);
        setPendingActionStep("intro");
        setModalError(null);
      }
      return;
    }

    if (pendingActionStep !== "confirm") return;
    if (!isMatchingConfirmationPhrase(confirmPhrase, requiredPhrase)) return;

    setActionState("saving");
    setModalError(null);
    let success = false;
    let deleteSlowTimerId: number | null = null;

    try {
      if (pendingAction === "deactivate") {
        await deactivateUser();
        await signOutUser();
        clearCurrentUserStore();
        showToast({
          kind: "success",
          title: "Account deactivated",
          message: "Your account has been deactivated.",
        });
        setActionState("success");
        success = true;
        navigate("/login", { replace: true });
        return;
      }

      setDeleteProgressText(getDeleteProgressMessage(false));
      setDeleteOperationId(null);
      setDeleteLongRunning(false);
      deleteSlowTimerId = window.setTimeout(() => {
        setDeleteLongRunning(true);
        setDeleteProgressText(getDeleteProgressMessage(true));
      }, DELETE_SLOW_THRESHOLD_MS);

      await revokeAnonIdentityForDeleteBestEffort();

      const response = await deleteUser();
      assertDeleteResponseSucceeded(response);
      setDeleteOperationId(response.operation_id ?? null);
      recordDeleteDebugEvent({
        source: "settings",
        stage: "start",
        operationId: response.operation_id ?? null,
        deletionStatus: response.deletion_status ?? null,
        deletePending: response.delete_pending ?? null,
        requestId: response.request_id ?? null,
      });

      const initialStatus = resolveDeletionStatus(response);
      const isPending = response.delete_pending === true || initialStatus === "pending" || initialStatus === "in_progress";
      if (isPending) {
        let statusEndpoint = response.status_endpoint;
        let pollAttempt = 0;
        const pollingStartedAt = Date.now();
        let latestOperationId = response.operation_id ?? null;

        while (true) {
          if (Date.now() - pollingStartedAt >= DELETE_PENDING_TIMEOUT_MS) {
            throw new Error(getDeletePendingTimeoutMessage(latestOperationId));
          }

          const delayMs = DELETE_POLL_DELAYS_MS[Math.min(pollAttempt, DELETE_POLL_DELAYS_MS.length - 1)];
          await sleep(delayMs);

          const statusResponse = await fetchDeleteUserStatus(statusEndpoint);
          statusEndpoint = statusResponse.status_endpoint ?? statusEndpoint;
          latestOperationId = statusResponse.operation_id ?? latestOperationId;
          setDeleteOperationId(latestOperationId);
          recordDeleteDebugEvent({
            source: "settings",
            stage: "status",
            operationId: statusResponse.operation_id ?? latestOperationId,
            deletionStatus: statusResponse.deletion_status ?? null,
            deletePending: statusResponse.delete_pending ?? null,
            requestId: statusResponse.request_id ?? null,
          });

          const pollStatus = resolveDeletionStatus(statusResponse);
          const stillPending =
            statusResponse.delete_pending === true || pollStatus === "pending" || pollStatus === "in_progress";

          if (pollStatus === "completed" || statusResponse.delete_pending === false) {
            break;
          }

          if (pollStatus === "failed") {
            throw new Error("Account deletion failed. Please try again or contact support.");
          }

          if (!stillPending) {
            throw new Error("Unable to confirm account deletion status. Please try again.");
          }

          pollAttempt += 1;
        }
      } else if (initialStatus !== "completed" && response.delete_pending !== false) {
        throw new Error("Unable to confirm account deletion status. Please try again.");
      }

      if (deleteSlowTimerId !== null) {
        window.clearTimeout(deleteSlowTimerId);
        deleteSlowTimerId = null;
      }

      persistPostLogoutNotice(ACCOUNTS_DELETED_NOTICE);
      try {
        await signOutUser();
      } catch {
        // terminal path: continue local cleanup even if Firebase sign-out throws
      }
      clearCurrentUserStore();
      showToast({
        kind: "success",
        title: ACCOUNTS_DELETED_NOTICE,
        message: ACCOUNTS_DELETED_NOTICE,
      });
      setActionState("success");
      success = true;
      navigate("/login", { replace: true });
      return;
    } catch (error) {
      setActionState("error");
      const message =
        pendingAction === "delete"
          ? parseDeleteApiErrorMessage(error)
          : parseApiErrorMessage(error);
      setModalError(message);
      showToast({
        kind: "error",
        title: pendingAction === "deactivate" ? "Couldn’t deactivate account" : "Couldn’t delete account",
        message,
      });
    } finally {
      if (deleteSlowTimerId !== null) {
        window.clearTimeout(deleteSlowTimerId);
      }
      if (!success) {
        setActionState("idle");
        setDeleteProgressText(null);
        setDeleteOperationId(null);
        setDeleteLongRunning(false);
      }
      if (success) {
        setPendingAction(null);
        setPendingActionStep("intro");
        setConfirmPhrase("");
        setModalError(null);
        setDeleteProgressText(null);
        setDeleteOperationId(null);
        setDeleteLongRunning(false);
      }
    }
  }, [
    actionState,
    confirmPhrase,
    handleSignOut,
    navigate,
    pendingAction,
    pendingActionStep,
    requiredPhrase,
    showToast,
  ]);

  const isLoading = currentUserState.status === "idle" || currentUserState.status === "loading";
  const isActionPending = actionState === "saving";
  const isDeleteProcessing = pendingAction === "delete" && isActionPending;

  useEffect(() => {
    if (!isDeleteProcessing) return;

    const marker = { deleteProcessingGuard: true, at: Date.now() };
    window.history.pushState(marker, "", window.location.href);

    const handlePopState = () => {
      window.history.pushState(marker, "", window.location.href);
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDeleteProcessing]);

  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Settings" showAction={false} showBack backHref="/app/profile" />

      <div className="mx-auto w-full max-w-[560px] space-y-6 bg-bg px-4 py-4">
        <header>
          <h1 className="text-xl font-semibold text-strong">Settings</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your account, safety, and support settings.</p>
        </header>

        {isLoading && !currentUserState.user ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={`settings-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/70 bg-bg px-4 py-3">
                <div className="h-3 w-1/3 rounded-full bg-bg-muted" aria-hidden="true" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-bg-muted" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : null}

        {currentUserState.status === "error" && !currentUserState.user ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-bg px-4 py-3">
            <p className="text-sm font-semibold text-strong">Unable to load settings.</p>
            <p className="text-sm text-text-secondary">{currentUserState.error?.message ?? "Try again."}</p>
            <button
              type="button"
              onClick={() => void loadCurrentUser({ force: true })}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : null}

        {currentUserState.user ? (
          <>
            <Section title="Account">
              <div className="divide-y divide-border/60">
                <LinkRow label="Edit Profile" to="/app/profile/edit" iconSrc={SETTINGS_ICON.accountUser} />
                <LinkRow label="Privacy & Data" to="/privacy-policy" iconSrc={SETTINGS_ICON.accountLock} />
                <LinkRow label="Connected Accounts" to="/app/settings/connected" iconSrc={SETTINGS_ICON.accountShield} />
              </div>
            </Section>

            <Section title="Appearance">
              <div className="divide-y divide-border/60">
                <ThemeModeRow
                  value={themePreference}
                  disabled={themePreferenceState === "saving"}
                  onChange={handleThemePreferenceChange}
                />
              </div>
              <p className="px-4 py-2 text-xs text-text-light">Default is System unless you choose Light or Dark.</p>
            </Section>

            <Section title="Safety">
              <div className="divide-y divide-border/60">
                <ToggleRow
                  label="Show Follower Count"
                  iconSrc={SETTINGS_ICON.safetyFollowerCounts}
                  checked={showFollowerCount}
                  disabled={followerState === "saving"}
                  onChange={() => void handleToggleFollowerCount()}
                />
                <SelectRow
                  label="Messaging Permissions"
                  iconSrc={SETTINGS_ICON.safetyMessagePermissions}
                  value={messagePermission}
                  disabled={messagePermissionState === "saving"}
                  onChange={(next) => void handleChangeMessagePermission(next)}
                />
                <ToggleRow
                  label="Hide Anonymous Posts"
                  iconSrc={SETTINGS_ICON.safetyUserSlash}
                  checked={hideAnonymousPosts}
                  disabled={hideAnonymousPostsState === "saving"}
                  onChange={() => void handleToggleHideAnonymousPosts()}
                />
                <LinkRow label="Blocked Users" to="/app/settings/blocked" iconSrc={SETTINGS_ICON.safetyUserSlash} />
                <LinkRow label="Appeals & Violations" to="/app/settings/review" iconSrc={SETTINGS_ICON.accountShield} />
              </div>
              {rowError ? <p className="px-4 py-2 text-xs text-brand">{rowError}</p> : null}
            </Section>

            <Section title="Content">
              <div className="divide-y divide-border/60">
                <ToggleRow
                  label="Prefer Community Short Names"
                  checked={preferCommunityShortNames}
                  disabled={communityNamePreferenceState === "saving"}
                  onChange={handleTogglePreferCommunityShortNames}
                />
                <LinkRow label="Posts" to="/app/settings/content?tab=posts" />
                <LinkRow label="Replies" to="/app/settings/content?tab=replies" />
                <LinkRow label="Liked" to="/app/settings/content?tab=liked" />
                <LinkRow label="Saved" to="/app/settings/content?tab=saved" />
              </div>
            </Section>

            <Section title="Verification">
              <div className="divide-y divide-border/60">
                <LinkRow
                  label="Community Verifications"
                  to="/app/settings/verifications"
                  iconSrc={SETTINGS_ICON.verified}
                />
              </div>
            </Section>

            <Section title="Support & About">
              <div className="divide-y divide-border/60">
                <LinkRow label="Feedback" to="/contact" iconSrc={SETTINGS_ICON.supportQuestion} />
                <LinkRow label="Request New Community" to="/community-request" iconSrc={SETTINGS_ICON.supportScroll} />
                <LinkRow label="Content Policy" to="/community-rules" iconSrc={SETTINGS_ICON.supportScroll} />
                <LinkRow label="Privacy Policy" to="/privacy-policy" iconSrc={SETTINGS_ICON.accountLock} />
                <LinkRow label="User Agreement" to="/terms" iconSrc={SETTINGS_ICON.supportUserAgreement} />
                <LinkRow label="Attributions" to="/attributions" iconSrc={SETTINGS_ICON.supportTerms} />
              </div>
            </Section>

            <Section title="Actions">
              <div className="divide-y divide-border/60">
                <ActionRow
                  label="Deactivate Account"
                  destructive
                  disabled={isActionPending}
                  onClick={() => openPendingAction("deactivate")}
                />
                <ActionRow
                  label="Delete Account"
                  destructive
                  disabled={isActionPending}
                  onClick={() => openPendingAction("delete")}
                />
                <ActionRow
                  label="Log Out"
                  disabled={isActionPending}
                  onClick={() => openPendingAction("logout")}
                />
              </div>
            </Section>
          </>
        ) : null}
      </div>

      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (isActionPending) return;
            closeConfirmation();
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/60 bg-bg p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              {pendingAction !== "logout" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (pendingActionStep === "confirm") {
                      setPendingActionStep("intro");
                      setConfirmPhrase("");
                      setModalError(null);
                      return;
                    }
                    closeConfirmation();
                  }}
                  disabled={isActionPending}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:opacity-60"
                  aria-label="Back"
                >
                  <BackIcon className="h-5 w-5" />
                </button>
              ) : null}
              <h2 className="flex-1 text-lg font-semibold text-strong">{flowTitle}</h2>
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={isActionPending}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:opacity-60"
                aria-label="Close dialog"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {pendingAction === "logout" ? (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">Are you sure you want to log out?</p>
                {modalError ? <p className="text-xs text-brand">{modalError}</p> : null}
                <button
                  type="button"
                  onClick={() => void confirmDestructiveAction()}
                  disabled={isActionPending}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
                >
                  {isActionPending ? "Logging out…" : "Yes, log out"}
                </button>
              </div>
            ) : null}

            {pendingAction === "deactivate" && pendingActionStep === "intro" ? (
              <div className="space-y-4">
                <h3 className="text-[2rem] leading-tight font-semibold text-strong">Need a break?</h3>
                <p className="text-[1.2rem] text-text-secondary">Deactivation is a reversible pause.</p>
                <div className="rounded-2xl bg-bg-muted px-4 py-3 text-[1.05rem] leading-snug text-strong">
                  Your profile is hidden, you will not show in search or feed, and you will not receive notifications.
                  Log back in to reactivate. If you do not reactivate within 90 days, your account will be deleted.
                </div>
                {modalError ? <p className="text-xs text-brand">{modalError}</p> : null}
                <button
                  type="button"
                  onClick={() => setPendingActionStep("confirm")}
                  disabled={isActionPending}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
                >
                  Yes, deactivate my account
                </button>
              </div>
            ) : null}

            {pendingAction === "delete" && pendingActionStep === "intro" ? (
              <div className="space-y-4">
                <h3 className="text-[2rem] leading-tight font-semibold text-strong">Sorry to see you go</h3>
                <p className="text-[1.2rem] text-text-secondary">Are you sure you want to delete your account?</p>
                <div className="rounded-2xl bg-bg-muted px-4 py-3 text-[1.05rem] leading-snug text-strong">
                  <p>This will delete both your regular account and your anonymous profile.</p>
                  <Link to="/contact" className="mt-1 inline-flex font-semibold text-secondary transition hover:opacity-90">
                    Provide feedback here
                  </Link>
                </div>
                {modalError ? <p className="text-xs text-brand">{modalError}</p> : null}
                <button
                  type="button"
                  onClick={() => setPendingActionStep("confirm")}
                  disabled={isActionPending}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
                >
                  Yes, delete my account
                </button>
              </div>
            ) : null}

            {(pendingAction === "deactivate" || pendingAction === "delete") && pendingActionStep === "confirm" ? (
              <div className="space-y-4">
                <h3 className="text-[2rem] leading-tight font-semibold text-strong">Final confirmation</h3>
                <p className="text-[1.2rem] text-text-secondary">
                  Type the phrase below to confirm {pendingAction === "deactivate" ? "deactivation" : "deletion"}.
                </p>
                <div className="rounded-xl bg-bg-muted px-4 py-3 text-[1.15rem] font-semibold text-strong">{requiredPhrase}</div>
                <input
                  value={confirmPhrase}
                  onChange={(event) => setConfirmPhrase(event.target.value)}
                  placeholder="Type phrase here"
                  className="w-full rounded-xl bg-bg-muted px-3 py-2 text-[1.05rem] text-strong outline-none placeholder:text-text-light"
                  aria-label={`Type ${requiredPhrase} to confirm`}
                />
                {pendingAction === "deactivate" ? (
                  <p className="text-[1.05rem] leading-snug text-text-secondary">
                    Deactivation is a reversible pause. Your profile is hidden, you will not show in search or feed, and
                    you will not receive notifications. Log back in to reactivate. If you do not reactivate within 90
                    days, your account will be deleted.
                  </p>
                ) : (
                  <p className="text-[1.05rem] leading-snug text-text-secondary">
                    This will delete both your regular account and your anonymous profile.
                  </p>
                )}
                {pendingAction === "delete" && isActionPending && deleteProgressText ? (
                  <div className="space-y-2 rounded-xl border border-border bg-bg-muted px-3 py-2 text-xs text-text-secondary">
                    <p>{deleteProgressText}</p>
                    {deleteLongRunning ? <p>Deletion request is still in progress.</p> : null}
                    {deleteOperationId ? <p>Operation ID: {deleteOperationId}</p> : null}
                  </div>
                ) : null}
                {modalError ? <p className="text-xs text-brand">{modalError}</p> : null}
                <button
                  type="button"
                  onClick={() => void confirmDestructiveAction()}
                  disabled={isActionPending || !isMatchingConfirmationPhrase(confirmPhrase, requiredPhrase)}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white disabled:bg-bg-muted disabled:text-text-secondary"
                >
                  {isActionPending
                    ? "Working…"
                    : pendingAction === "deactivate"
                      ? "Confirm deactivation"
                      : "Confirm delete"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
