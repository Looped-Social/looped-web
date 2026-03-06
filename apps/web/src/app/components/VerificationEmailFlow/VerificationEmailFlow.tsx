import { useMemo, useRef, useState } from "react";

import { OnboardingContinueButton } from "@/app/components/OnboardingContinueButton/OnboardingContinueButton";
import type { EmailVerificationDraft, EmailVerificationState } from "@/lib/emailVerificationMachine";

type VerificationEmailFlowProps = {
  state: EmailVerificationState;
  communityName: string;
  draft: EmailVerificationDraft;
  domains: string[];
  errorMessage: string | null;
  resendHelperText: string | null;
  canSendCode: boolean;
  canVerifyCode: boolean;
  canResendCode: boolean;
  transitionLocked: boolean;
  overlayTitle: string | null;
  showBack?: boolean;
  onBack?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
  onEmailLocalPartChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
  onResendCode: () => void;
  onRetryDomains: () => void;
};

function BackArrowIcon({ className }: { className?: string }) {
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

function buildDomainSupportCopy(domains: string[]): string {
  if (domains.length === 0) {
    return "No worries. We can help add your domain.";
  }
  if (domains.length === 1) {
    return `If your email doesn't end in "@${domains[0]}", no worries. We can help add your domain.`;
  }
  return `If your email doesn't end in "@${domains[0]}" or one of our other options, no worries. We can help add your domain.`;
}

function shouldShowEmailState(state: EmailVerificationState): boolean {
  return (
    state === "loading_domains" ||
    state === "domains_error" ||
    state === "enter_email" ||
    state === "sending_code" ||
    state === "enter_email_error"
  );
}

function shouldShowCodeState(state: EmailVerificationState): boolean {
  return (
    state === "enter_code" ||
    state === "verifying_code" ||
    state === "enter_code_error" ||
    state === "verified_local" ||
    state === "done"
  );
}

export function VerificationEmailFlow({
  state,
  communityName,
  draft,
  domains,
  errorMessage,
  resendHelperText,
  canSendCode,
  canVerifyCode,
  canResendCode,
  transitionLocked,
  overlayTitle,
  showBack = false,
  onBack,
  showSkip = false,
  onSkip,
  onEmailLocalPartChange,
  onDomainChange,
  onCodeChange,
  onSendCode,
  onVerifyCode,
  onResendCode,
  onRetryDomains,
}: VerificationEmailFlowProps) {
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const [codeFocused, setCodeFocused] = useState(false);

  const domainSupportCopy = useMemo(() => buildDomainSupportCopy(domains), [domains]);
  const hasMultipleDomains = domains.length > 1;
  const singleDomain = domains.length === 1 ? domains[0] : null;
  const fixedDomain = singleDomain ?? draft.selectedDomain.trim();
  const normalizedCode = draft.pendingCode.replace(/\D/g, "").slice(0, 6);
  const activeCodeIndex = Math.min(normalizedCode.length, 5);
  const showDomainSupport =
    state === "enter_email" ||
    state === "sending_code" ||
    state === "enter_email_error";

  return (
    <section className="space-y-4">
      <div className="relative rounded-[14px] bg-bg-muted px-[18px] py-6">
        {overlayTitle ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px] bg-bg/85">
            <div className="inline-flex items-center gap-2 rounded-full bg-bg px-4 py-2 text-sm font-semibold text-strong shadow-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              <span>{overlayTitle}</span>
            </div>
          </div>
        ) : null}

        <div className={`space-y-4 ${overlayTitle ? "pointer-events-none" : ""}`}>
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={transitionLocked}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Back"
          >
            <BackArrowIcon className="h-5 w-5" />
          </button>
        ) : null}

        {shouldShowEmailState(state) ? (
          <>
            {state === "loading_domains" ? (
              <div className="flex min-h-32 items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" aria-hidden="true" />
              </div>
            ) : null}

            {state === "domains_error" ? (
              <div className="space-y-3">
                <p className="text-sm text-brand">{errorMessage ?? "Couldn't load email domains."}</p>
                <button
                  type="button"
                  onClick={onRetryDomains}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {(state === "enter_email" || state === "sending_code" || state === "enter_email_error") ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-strong">Use your {communityName} email</p>
                  <p className="text-sm text-text-secondary">
                    An email can only be actively verified by one account in this community at a time.
                  </p>
                </div>

                <div className="rounded-[10px] border border-text-secondary/20 bg-bg px-3 py-2.5">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <input
                      type="text"
                      value={draft.emailLocalPart}
                      onChange={(event) => onEmailLocalPartChange(event.target.value)}
                      placeholder="name"
                      className="w-full border-0 bg-transparent p-0 text-sm text-strong outline-none"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={transitionLocked}
                    />
                    {hasMultipleDomains ? (
                      <select
                        value={draft.selectedDomain}
                        onChange={(event) => onDomainChange(event.target.value)}
                        disabled={transitionLocked}
                        className="min-w-[86px] max-w-[150px] rounded-lg border-0 bg-text-secondary/12 px-2 py-1.5 text-sm text-strong outline-none"
                      >
                        {domains.map((domain) => (
                          <option key={domain} value={domain}>
                            @{domain}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="min-w-[86px] max-w-[150px] rounded-lg bg-text-secondary/12 px-2 py-1.5 text-sm text-strong">
                        @{fixedDomain || "domain"}
                      </span>
                    )}
                  </div>
                </div>

                {state === "enter_email_error" && errorMessage ? (
                  <p className="text-sm text-brand">{errorMessage}</p>
                ) : null}

                <div className="space-y-2">
                  <OnboardingContinueButton
                    label="Send code"
                    loadingLabel="Sending..."
                    onClick={onSendCode}
                    isEnabled={canSendCode}
                    isLoading={state === "sending_code"}
                    variant="capsule"
                    behavior="disabled"
                    className="w-full h-[52px]"
                  />
                  {showSkip && onSkip ? (
                    <button
                      type="button"
                      onClick={onSkip}
                      disabled={transitionLocked}
                      className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                    >
                      Skip verification
                    </button>
                  ) : null}
                </div>

              </div>
            ) : null}
          </>
        ) : null}

        {shouldShowCodeState(state) ? (
          <div className="space-y-4">
            {state === "done" ? (
              <div className="rounded-xl border border-border/70 bg-bg px-3 py-3 text-sm text-text-secondary">
                Verification complete. Continuing...
              </div>
            ) : null}
            {state !== "done" ? (
              <>
                <div className="rounded-xl border border-border/70 bg-bg px-3 py-2.5">
                  <p className="text-sm font-semibold text-strong">Check spam and junk folders</p>
                  <p className="text-sm text-text-secondary">
                    Verification emails are often filtered and may not appear in your inbox.
                  </p>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => codeInputRef.current?.focus()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      codeInputRef.current?.focus();
                    }
                  }}
                  className="relative"
                >
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={normalizedCode}
                    maxLength={6}
                    onChange={(event) => onCodeChange(event.target.value)}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      if (!pasted) return;
                      event.preventDefault();
                      onCodeChange(pasted);
                    }}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    className="absolute inset-0 h-full w-full opacity-0"
                    disabled={transitionLocked}
                  />
                  <div className="mx-auto flex w-full max-w-[420px] items-center justify-center gap-3">
                    {Array.from({ length: 6 }, (_, index) => {
                      const char = normalizedCode[index] ?? "";
                      const isActive = codeFocused && normalizedCode.length < 6 && index === activeCodeIndex;
                      return (
                        <div
                          key={`verify-code-box-${index}`}
                          className={`h-12 w-11 rounded-lg border text-center text-lg font-semibold leading-[3rem] text-strong ${
                            isActive ? "border-brand" : "border-border/70"
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {state === "enter_code_error" && errorMessage ? (
                  <p className="text-sm text-brand">{errorMessage}</p>
                ) : null}

                <div className="space-y-2">
                  <OnboardingContinueButton
                    label="Verify"
                    loadingLabel="Verifying..."
                    onClick={onVerifyCode}
                    isEnabled={canVerifyCode}
                    isLoading={state === "verifying_code" || state === "verified_local"}
                    variant="capsule"
                    behavior="disabled"
                    className="w-full h-[52px]"
                  />
                  <div className={`flex items-center gap-3 ${showSkip && onSkip ? "justify-between" : "justify-center"}`}>
                    <button
                      type="button"
                      onClick={onResendCode}
                      disabled={!canResendCode}
                      className="text-sm font-semibold text-secondary underline underline-offset-2 transition hover:text-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Resend email
                    </button>
                    {showSkip && onSkip ? (
                      <button
                        type="button"
                        onClick={onSkip}
                        disabled={transitionLocked}
                        className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                      >
                        Skip verification
                      </button>
                    ) : null}
                  </div>
                  {resendHelperText ? (
                    <p className="text-center text-sm text-text-secondary">{resendHelperText}</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
      {showDomainSupport ? (
        <div className="mx-auto w-full max-w-[640px] space-y-1 text-center">
          <p className="text-sm font-semibold text-strong">Don&apos;t see your domain?</p>
          <p className="text-sm text-text-secondary">{domainSupportCopy}</p>
          <p className="text-sm text-text-secondary">
            <a
              href="/contact"
              target="_blank"
              rel="noreferrer"
              className="text-secondary underline underline-offset-2 hover:text-secondary/80"
            >
              Contact us
            </a>{" "}
            and{" "}
            <a
              href="mailto:support@looped-social.com"
              className="text-secondary underline underline-offset-2 hover:text-secondary/80"
            >
              email us here
            </a>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
