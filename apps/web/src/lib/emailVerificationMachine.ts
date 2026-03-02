import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EmailVerificationState =
  | "loading_domains"
  | "domains_error"
  | "enter_email"
  | "sending_code"
  | "enter_email_error"
  | "enter_code"
  | "verifying_code"
  | "enter_code_error"
  | "verified_local"
  | "done";

export type EmailVerificationDraft = {
  emailLocalPart: string;
  selectedDomain: string;
  submittedEmail: string;
  pendingCode: string;
  cooldownUntil: number | null;
};

export type EmailVerificationApi = {
  loadDomains: (args: { communityId: string; signal?: AbortSignal }) => Promise<string[]>;
  sendCode: (args: { communityId: string; email: string }) => Promise<void>;
  verifyCode: (args: { communityId: string; email: string; code: string }) => Promise<void>;
};

export type EmailVerificationModeAdapter = {
  beforeLoadDomains?: (args: { communityId: string }) => Promise<void>;
  beforeSendCode?: (args: { communityId: string; email: string }) => Promise<void>;
  beforeSubmitCode?: (args: { communityId: string; email: string; code: string }) => Promise<void>;
  afterVerifySuccess?: (args: { communityId: string; email: string; code: string }) => Promise<void>;
  onSyncRecoverableError?: (error: unknown) => Promise<void>;
};

type UseEmailVerificationMachineArgs = {
  enabled: boolean;
  communityId: string | null;
  draft: EmailVerificationDraft;
  onDraftChange: (nextDraft: Partial<EmailVerificationDraft>) => void;
  api: EmailVerificationApi;
  adapter: EmailVerificationModeAdapter;
  initialPreferredState?: "enter_email" | "enter_code";
  defaultCooldownSeconds?: number;
  onDone?: () => void;
};

function normalizeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || !error || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  const normalized = code.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Something went wrong. Please try again.";
}

function extractRetryAfterSeconds(error: unknown): number | null {
  if (typeof error !== "object" || !error || !("retryAfterSeconds" in error)) return null;
  const value = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.ceil(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.ceil(parsed));
    }
  }
  return null;
}

function isSyncRecoverableCode(code: string | null): boolean {
  return (
    code === "onboarding_incomplete" ||
    code === "invalid_onboarding_step" ||
    code === "invalid_onboarding_stage" ||
    code === "invalid_stage"
  );
}

function mapVerificationErrorMessage({
  code,
  fallback,
  retryAfterSeconds,
}: {
  code: string | null;
  fallback: string;
  retryAfterSeconds: number | null;
}): string {
  switch (code) {
    case "invalid_code":
      return "That code is incorrect. Please try again.";
    case "code_required":
      return "Enter the 6-digit code.";
    case "invalid_email":
      return "Enter a valid email address.";
    case "email_domain_not_allowed":
    case "domain_not_allowed":
      return "That email domain is not allowed for this community.";
    case "domains_not_configured":
      return "Email verification is not configured for this community yet.";
    case "email_send_failed":
      return "We couldn't send that verification email. Please try again.";
    case "too_many_attempts":
      return "Too many attempts. Request a new code and try again.";
    case "resend_cooldown":
    case "email_start_rate_limited_hour":
    case "email_start_rate_limited_day":
      return retryAfterSeconds
        ? `Rate limited. Try again in ${retryAfterSeconds} second(s).`
        : "You're temporarily rate-limited. Try again shortly.";
    case "email_mismatch":
      return "That code does not match this email. Request a new code.";
    case "email_in_use":
      return "This email is already actively verified by another account in this community.";
    case "onboarding_incomplete":
    case "invalid_onboarding_step":
    case "invalid_onboarding_stage":
      return "Your onboarding state changed. Resyncing now.";
    default:
      return fallback;
  }
}

function stateForLoadedDomains({
  preferredState,
  submittedEmail,
}: {
  preferredState: "enter_email" | "enter_code";
  submittedEmail: string;
}): EmailVerificationState {
  if (preferredState === "enter_code" && submittedEmail.trim().length > 0) {
    return "enter_code";
  }
  return submittedEmail.trim().length > 0 ? "enter_code" : "enter_email";
}

export function useEmailVerificationMachine({
  enabled,
  communityId,
  draft,
  onDraftChange,
  api,
  adapter,
  initialPreferredState = "enter_email",
  defaultCooldownSeconds = 60,
  onDone,
}: UseEmailVerificationMachineArgs) {
  const [state, setState] = useState<EmailVerificationState>("loading_domains");
  const [domains, setDomains] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);

  const preferredStateRef = useRef<"enter_email" | "enter_code">(initialPreferredState);
  const loadRequestRef = useRef(0);
  const selectedDomainRef = useRef(draft.selectedDomain);
  const submittedEmailRef = useRef(draft.submittedEmail);
  const apiRef = useRef(api);
  const adapterRef = useRef(adapter);
  const onDraftChangeRef = useRef(onDraftChange);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    preferredStateRef.current = initialPreferredState;
  }, [initialPreferredState]);

  useEffect(() => {
    selectedDomainRef.current = draft.selectedDomain;
    submittedEmailRef.current = draft.submittedEmail;
  }, [draft.selectedDomain, draft.submittedEmail]);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!draft.cooldownUntil || draft.cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      setClockTick((previous) => previous + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [draft.cooldownUntil]);

  const cooldownSeconds =
    draft.cooldownUntil && draft.cooldownUntil > Date.now()
      ? Math.ceil((draft.cooldownUntil - Date.now()) / 1000)
      : 0;

  const transitionLocked = state === "sending_code" || state === "verifying_code" || state === "verified_local";

  const canSendCode =
    !transitionLocked &&
    (state === "enter_email" || state === "enter_email_error") &&
    draft.emailLocalPart.trim().length > 0 &&
    draft.selectedDomain.trim().length > 0;

  const canVerifyCode =
    !transitionLocked &&
    (state === "enter_code" || state === "enter_code_error") &&
    draft.pendingCode.trim().length === 6 &&
    draft.submittedEmail.trim().length > 0;

  const canResendCode =
    !transitionLocked &&
    (state === "enter_code" || state === "enter_code_error") &&
    draft.submittedEmail.trim().length > 0 &&
    cooldownSeconds === 0;

  const onSyncRecoverableError = useCallback(async (error: unknown): Promise<boolean> => {
    const code = normalizeErrorCode(error);
    const handler = adapterRef.current.onSyncRecoverableError;
    if (!isSyncRecoverableCode(code) || !handler) {
      return false;
    }
    await handler(error);
    return true;
  }, []);

  const loadDomains = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    if (!communityId) {
      setErrorMessage("Select your school or workplace first.");
      setState("domains_error");
      return;
    }

    const requestId = ++loadRequestRef.current;
    setState("loading_domains");
    setErrorMessage(null);

    try {
      if (signal?.aborted) return;
      if (adapterRef.current.beforeLoadDomains) {
        await adapterRef.current.beforeLoadDomains({ communityId });
      }
      if (signal?.aborted) return;

      const loadedDomains = await apiRef.current.loadDomains({
        communityId,
        signal,
      });
      if (signal?.aborted) return;
      if (requestId !== loadRequestRef.current) return;

      setDomains(loadedDomains);
      const nextDomain =
        loadedDomains.includes(selectedDomainRef.current) || loadedDomains.length === 0
          ? selectedDomainRef.current
          : loadedDomains[0] ?? "";
      if (nextDomain !== selectedDomainRef.current) {
        onDraftChangeRef.current({ selectedDomain: nextDomain });
      }
      setState(
        stateForLoadedDomains({
          preferredState: preferredStateRef.current,
          submittedEmail: submittedEmailRef.current,
        })
      );
    } catch (error) {
      if (signal?.aborted) return;
      if (requestId !== loadRequestRef.current) return;
      if (await onSyncRecoverableError(error)) {
        setState("done");
        return;
      }

      const code = normalizeErrorCode(error);
      const retryAfterSeconds = extractRetryAfterSeconds(error);
      setErrorMessage(
        mapVerificationErrorMessage({
          code,
          fallback: normalizeErrorMessage(error),
          retryAfterSeconds,
        })
      );
      setState("domains_error");
    }
  }, [
    communityId,
    enabled,
    onSyncRecoverableError,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadDomains(controller.signal);
    return () => controller.abort();
  }, [enabled, communityId, loadDomains]);

  const setEmailLocalPart = useCallback(
    (value: string) => {
      onDraftChange({ emailLocalPart: value.replace(/\s+/g, "") });
      if (state === "enter_email_error") {
        setState("enter_email");
        setErrorMessage(null);
      }
    },
    [onDraftChange, state]
  );

  const setSelectedDomain = useCallback(
    (value: string) => {
      onDraftChange({ selectedDomain: value });
      if (state === "enter_email_error") {
        setState("enter_email");
        setErrorMessage(null);
      }
    },
    [onDraftChange, state]
  );

  const setCode = useCallback(
    (value: string) => {
      onDraftChange({ pendingCode: value.replace(/\D/g, "").slice(0, 6) });
      if (state === "enter_code_error") {
        setState("enter_code");
        setErrorMessage(null);
      }
    },
    [onDraftChange, state]
  );

  const sendCode = useCallback(async () => {
    if (!communityId) {
      setState("enter_email_error");
      setErrorMessage("Select your school or workplace first.");
      return;
    }

    const localPart = draft.emailLocalPart.trim();
    const domain = draft.selectedDomain.trim();
    if (!localPart || !domain) {
      setState("enter_email_error");
      setErrorMessage("Enter your work or school email.");
      return;
    }

    const email = `${localPart}@${domain}`;
    setState("sending_code");
    setErrorMessage(null);

    try {
      if (adapterRef.current.beforeSendCode) {
        await adapterRef.current.beforeSendCode({ communityId, email });
      }
      await apiRef.current.sendCode({ communityId, email });
      onDraftChangeRef.current({
        submittedEmail: email,
        pendingCode: "",
        cooldownUntil: Date.now() + defaultCooldownSeconds * 1000,
      });
      setState("enter_code");
    } catch (error) {
      if (await onSyncRecoverableError(error)) {
        setState("done");
        return;
      }

      const retryAfterSeconds = extractRetryAfterSeconds(error);
      if (retryAfterSeconds) {
        onDraftChangeRef.current({
          cooldownUntil: Date.now() + retryAfterSeconds * 1000,
        });
      }
      setState("enter_email_error");
      setErrorMessage(
        mapVerificationErrorMessage({
          code: normalizeErrorCode(error),
          fallback: normalizeErrorMessage(error),
          retryAfterSeconds,
        })
      );
    }
  }, [
    communityId,
    defaultCooldownSeconds,
    draft.emailLocalPart,
    draft.selectedDomain,
    onSyncRecoverableError,
  ]);

  const resendCode = useCallback(async () => {
    if (!communityId || !draft.submittedEmail.trim()) return;
    if (cooldownSeconds > 0) return;

    setState("sending_code");
    setErrorMessage(null);

    try {
      if (adapterRef.current.beforeSendCode) {
        await adapterRef.current.beforeSendCode({
          communityId,
          email: draft.submittedEmail.trim(),
        });
      }
      await apiRef.current.sendCode({
        communityId,
        email: draft.submittedEmail.trim(),
      });
      onDraftChangeRef.current({
        pendingCode: "",
        cooldownUntil: Date.now() + defaultCooldownSeconds * 1000,
      });
      setState("enter_code");
    } catch (error) {
      if (await onSyncRecoverableError(error)) {
        setState("done");
        return;
      }

      const retryAfterSeconds = extractRetryAfterSeconds(error);
      if (retryAfterSeconds) {
        onDraftChangeRef.current({
          cooldownUntil: Date.now() + retryAfterSeconds * 1000,
        });
      }
      setState("enter_code_error");
      setErrorMessage(
        mapVerificationErrorMessage({
          code: normalizeErrorCode(error),
          fallback: normalizeErrorMessage(error),
          retryAfterSeconds,
        })
      );
    }
  }, [
    communityId,
    cooldownSeconds,
    defaultCooldownSeconds,
    draft.submittedEmail,
    onSyncRecoverableError,
  ]);

  const verifyCode = useCallback(async () => {
    if (!communityId) {
      setState("enter_code_error");
      setErrorMessage("Select your school or workplace first.");
      return;
    }
    const submittedEmail = draft.submittedEmail.trim();
    if (!submittedEmail) {
      setState("enter_email_error");
      setErrorMessage("Enter your work or school email.");
      return;
    }
    const code = draft.pendingCode.trim();
    if (code.length !== 6) {
      setState("enter_code_error");
      setErrorMessage("Enter the 6-digit code.");
      return;
    }

    setState("verifying_code");
    setErrorMessage(null);

    try {
      if (adapterRef.current.beforeSubmitCode) {
        await adapterRef.current.beforeSubmitCode({ communityId, email: submittedEmail, code });
      }

      await apiRef.current.verifyCode({
        communityId,
        email: submittedEmail,
        code,
      });

      setState("verified_local");
      if (adapterRef.current.afterVerifySuccess) {
        await adapterRef.current.afterVerifySuccess({
          communityId,
          email: submittedEmail,
          code,
        });
      }
      setState("done");
      onDoneRef.current?.();
    } catch (error) {
      if (await onSyncRecoverableError(error)) {
        setState("done");
        return;
      }

      const codeValue = normalizeErrorCode(error);
      const retryAfterSeconds = extractRetryAfterSeconds(error);
      if (retryAfterSeconds) {
        onDraftChangeRef.current({
          cooldownUntil: Date.now() + retryAfterSeconds * 1000,
        });
      }

      const shouldResetToEmail = codeValue === "too_many_attempts" || codeValue === "email_mismatch";
      if (shouldResetToEmail) {
        onDraftChangeRef.current({
          pendingCode: "",
          submittedEmail: "",
        });
        setState("enter_email");
      } else {
        setState("enter_code_error");
      }
      setErrorMessage(
        mapVerificationErrorMessage({
          code: codeValue,
          fallback: normalizeErrorMessage(error),
          retryAfterSeconds,
        })
      );
    }
  }, [
    communityId,
    draft.pendingCode,
    draft.submittedEmail,
    onSyncRecoverableError,
  ]);

  const retryDomains = useCallback(async () => {
    await loadDomains();
  }, [loadDomains]);

  const resetToEmailEntry = useCallback(() => {
    onDraftChange({
      submittedEmail: "",
      pendingCode: "",
    });
    setState("enter_email");
    setErrorMessage(null);
  }, [onDraftChange]);

  const overlayTitle = useMemo(() => {
    if (state === "verifying_code") return "Verifying code…";
    if (state === "verified_local") return "Code verified";
    return null;
  }, [state]);

  const resendHelperText =
    cooldownSeconds > 0
      ? `You can resend email in ${cooldownSeconds} second(s).`
      : null;

  return {
    state,
    domains,
    errorMessage,
    draft,
    cooldownSeconds,
    resendHelperText,
    canSendCode,
    canVerifyCode,
    canResendCode,
    transitionLocked,
    overlayTitle,
    setEmailLocalPart,
    setSelectedDomain,
    setCode,
    sendCode,
    resendCode,
    verifyCode,
    retryDomains,
    resetToEmailEntry,
    // keep for future hooks where consumers need explicit tick updates
    _clockTick: clockTick,
  };
}
