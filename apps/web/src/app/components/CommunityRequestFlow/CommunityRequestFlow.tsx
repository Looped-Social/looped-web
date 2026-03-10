import { type ChangeEvent, useMemo, useState } from "react";

import { useTheme } from "@looped/ui";

import { appIllustrations, resolveIllustrationAsset } from "@/lib/appIllustrations";
import {
  CommunityApiError,
  submitCommunityRequest,
  uploadCommunityImage,
  type CommunityRequestPayload,
} from "@/lib/communityApi";

import { OnboardingContinueButton } from "../OnboardingContinueButton/OnboardingContinueButton";

type CommunityRequestFlowMode = "onboarding" | "standard";

type CommunityRequestFlowProps = {
  mode: CommunityRequestFlowMode;
  initialName?: string;
  onClose?: () => void;
  onStandardComplete?: () => void;
  onCompleteOnboardingAfterSubmit?: () => Promise<void>;
  mapOnboardingCompletionError?: (error: unknown) => string;
};

type FlowStep = "form" | "submitted";

const ONBOARDING_REQUEST_TYPES: Array<{ value: CommunityRequestPayload["type"]; label: string }> = [
  { value: "company", label: "Company" },
];

const STANDARD_REQUEST_TYPES: Array<{ value: CommunityRequestPayload["type"]; label: string }> = [
  { value: "company", label: "Company" },
  { value: "field", label: "Field" },
];

const OPTIONAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CommunityRequestFlow({
  mode,
  initialName = "",
  onClose,
  onStandardComplete,
  onCompleteOnboardingAfterSubmit,
  mapOnboardingCompletionError,
}: CommunityRequestFlowProps) {
  const { theme } = useTheme();
  const onboardingMode = mode === "onboarding";
  const [step, setStep] = useState<FlowStep>("form");
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<CommunityRequestPayload["type"]>("company");
  const [about, setAbout] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [onboardingCompletionError, setOnboardingCompletionError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedAbout = about.trim();
  const trimmedContactEmail = contactEmail.trim();
  const hasOptionalEmail = trimmedContactEmail.length > 0;
  const optionalEmailValid = !hasOptionalEmail || OPTIONAL_EMAIL_REGEX.test(trimmedContactEmail);
  const canSubmit = trimmedName.length > 0 && trimmedAbout.length > 0 && optionalEmailValid && !isSubmitting;
  const dismissLocked = isSubmitting || isCompletingOnboarding;
  const requestTypes = mode === "onboarding" ? ONBOARDING_REQUEST_TYPES : STANDARD_REQUEST_TYPES;
  const communityRequestIllustration = resolveIllustrationAsset(appIllustrations.communityRequest, theme);
  const requestConfirmIllustration = resolveIllustrationAsset(appIllustrations.requestConfirm, theme);

  const headline = useMemo(() => {
    if (step === "submitted") return "Request submitted";
    return "Request your community";
  }, [step]);

  const handleSubmit = async () => {
    setSubmitError(null);
    setOnboardingCompletionError(null);
    if (!trimmedName) {
      setSubmitError("Enter a community name.");
      return;
    }
    if (!trimmedAbout) {
      setSubmitError("Enter a short description.");
      return;
    }
    if (!optionalEmailValid) {
      setSubmitError("Enter a valid contact email or leave it blank.");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageKey: string | undefined;
      if (imageFile) {
        imageKey = await uploadCommunityImage(imageFile);
      }

      const shouldNotifyWhenAvailable = trimmedContactEmail.length > 0;

      await submitCommunityRequest({
        type,
        name: trimmedName,
        about: trimmedAbout,
        imageKey,
        contactEmail: trimmedContactEmail || undefined,
        notifyWhenAvailable: shouldNotifyWhenAvailable,
      });

      setStep("submitted");
    } catch (error) {
      setSubmitError(getCommunityRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!nextFile) return;
    setImageFile(nextFile);
    setImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(nextFile);
    });
  };

  const clearLocalForm = () => {
    setStep("form");
    setName("");
    setType("company");
    setAbout("");
    setContactEmail("");
    setImageFile(null);
    setImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setSubmitError(null);
    setOnboardingCompletionError(null);
  };

  const handleContinueAfterSubmit = async () => {
    if (mode !== "onboarding" || !onCompleteOnboardingAfterSubmit) return;
    setIsCompletingOnboarding(true);
    setOnboardingCompletionError(null);
    try {
      await onCompleteOnboardingAfterSubmit();
    } catch (error) {
      const fallback =
        "Your request was submitted, but onboarding could not be finished yet. You can close this and pick an existing community.";
      setOnboardingCompletionError(mapOnboardingCompletionError?.(error) ?? fallback);
    } finally {
      setIsCompletingOnboarding(false);
    }
  };

  return (
    <div className="space-y-6">
      {onboardingMode ? (
        <div className="flex justify-end">
          {onClose && step === "form" ? (
            <button
              type="button"
              onClick={onClose}
              disabled={dismissLocked}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close request flow"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-strong">{headline}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {step === "submitted"
                ? "Thanks for helping us expand Looped."
                : "Tell us what community you need and we'll review it."}
            </p>
          </div>
          {onClose && step === "form" ? (
            <button
              type="button"
              onClick={onClose}
              disabled={dismissLocked}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close request flow"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      )}

      {step === "form" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_1fr] lg:items-start">
          <div className="flex items-start justify-center lg:justify-start">
            <img
              src={communityRequestIllustration}
              alt=""
              className="w-full max-w-[320px] object-contain"
              loading="lazy"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2 lg:text-left">
              <h3 className="text-[1.75rem] font-semibold leading-tight text-strong">
                {onboardingMode ? "Sorry, we do not have your community yet." : "Request your community"}
              </h3>
              <p className="max-w-xl text-[0.98rem] leading-6 text-text-secondary">
                {onboardingMode
                  ? "Enter your information below and we will be on it."
                  : "Tell us what community you need and we'll review it."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="community-request-name" className="text-sm font-semibold text-text-secondary">
                  Community Name*
                </label>
                <input
                  id="community-request-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ususjd"
                  className="w-full rounded-xl border border-transparent bg-bg-muted px-4 py-2 text-[0.95rem] text-strong outline-none transition focus:border-brand/30"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="community-request-about" className="text-sm font-semibold text-text-secondary">
                  About*
                </label>
                <textarea
                  id="community-request-about"
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  placeholder="Who is this community for? What is it about?"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-transparent bg-bg-muted px-4 py-2 text-[0.95rem] text-strong outline-none transition focus:border-brand/30"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-text-secondary">Type*</p>
                <div className="flex flex-wrap gap-2">
                  {requestTypes.map((option) => {
                    const selected = option.value === type;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setType(option.value)}
                        className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                          selected
                            ? "border-brand text-brand bg-brand/5"
                            : "border-border text-text-secondary hover:text-strong"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="community-request-contact-email" className="text-sm font-semibold text-text-secondary">
                  Contact Email <span className="font-medium text-text-light">optional</span>
                </label>
                <input
                  id="community-request-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`w-full rounded-xl border bg-bg-muted px-4 py-2 text-[0.95rem] outline-none transition ${
                    hasOptionalEmail && !optionalEmailValid
                      ? "border-brand text-strong focus:border-brand focus:ring-2 focus:ring-brand/20"
                      : "border-transparent text-secondary focus:border-brand/30"
                  }`}
                />
                {hasOptionalEmail && !optionalEmailValid ? (
                  <p className="text-xs text-brand">Enter a valid email address or clear this field.</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-text-secondary">
                  Picture <span className="font-medium text-text-light">optional</span>
                </p>
                <label
                  htmlFor="community-request-image"
                  className="inline-flex h-[86px] w-[86px] cursor-pointer items-center justify-center rounded-2xl bg-bg-muted text-text-secondary transition hover:text-strong"
                >
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt=""
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <PlusIcon className="h-7 w-7" />
                  )}
                </label>
                <input
                  id="community-request-image"
                  type="file"
                  accept="image/*"
                  onChange={handleSelectImage}
                  className="sr-only"
                />
                {imageFile ? <p className="text-xs text-text-light">{imageFile.name}</p> : null}
              </div>

              {submitError ? (
                <div className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">
                  {submitError}
                </div>
              ) : null}

              <OnboardingContinueButton
                label="Continue"
                loadingLabel="Submitting..."
                onClick={() => {
                  void handleSubmit();
                }}
                isEnabled={canSubmit}
                isLoading={isSubmitting}
                variant="capsule"
                behavior="disabled"
                className="w-full !h-11 text-sm"
              />

              <p className="text-center text-sm text-text-secondary">
                By creating a community you agree to our{" "}
                <a
                  href="/community-rules"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary underline underline-offset-2"
                >
                  community standards and moderation guidelines
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {step === "submitted" ? (
        <div className="space-y-5">
          <div className="flex justify-center">
            <img
              src={requestConfirmIllustration}
              alt=""
              className="w-full max-w-[min(680px,92vw)] object-contain"
              loading="lazy"
            />
          </div>
          <div className="space-y-2 text-center">
            <h3 className="text-3xl font-semibold text-strong">Thank you!</h3>
            <p className="mx-auto max-w-xl text-base leading-7 text-text-secondary">
              You planted the seed for your community.
              <br />
              We&apos;ll get back to you within 48 hours.
              <br />
              You can still verify in other communities in the meantime.
            </p>
          </div>

          {onboardingCompletionError ? (
            <div className="mx-auto w-full max-w-[520px] rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">
              {onboardingCompletionError}
            </div>
          ) : null}

          {mode === "onboarding" ? (
            <div className="mx-auto w-full max-w-[520px] space-y-2">
              <OnboardingContinueButton
                label="Continue"
                loadingLabel="Finishing onboarding..."
                onClick={() => {
                  void handleContinueAfterSubmit();
                }}
                isEnabled
                isLoading={isCompletingOnboarding}
                variant="capsule"
                className="w-full"
              />
              {onboardingCompletionError && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={dismissLocked}
                  className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close and pick an existing community
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[520px]">
              <OnboardingContinueButton
                label="Done"
                loadingLabel="Done"
                onClick={() => {
                  if (onStandardComplete) {
                    onStandardComplete();
                    return;
                  }
                  if (onClose) {
                    onClose();
                    return;
                  }
                  clearLocalForm();
                }}
                variant="capsule"
                className="w-full"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function getCommunityRequestErrorMessage(error: unknown): string {
  if (error instanceof CommunityApiError) {
    const detail = (error.details || error.message || "").toString();
    const parsed = parseErrorCode(detail);
    const code = parsed ?? detail;

    const mapping: Record<string, string> = {
      request_already_pending: "You already have a pending request for this community.",
      community_exists: "That community already exists.",
      invalid_kind: "Select a valid type.",
      name_required: "Enter a community name.",
      about_required: "Tell us who this community is for.",
      contact_email_required: "Enter a contact email to enable notifications, or leave notifications off.",
      invalid_contact_email: "Enter a valid contact email.",
      invalid_image: "That image could not be processed. Try a different file.",
      image_not_owned: "We couldn't verify that image upload.",
      user_not_provisioned: "Your account is not ready for requests yet.",
    };

    const matched = Object.keys(mapping).find((key) => code.includes(key));
    if (matched) {
      return mapping[matched];
    }
  }

  if (error instanceof Error) return error.message;
  return "Unable to submit your request right now. Please try again.";
}

function parseErrorCode(detail: string): string | null {
  try {
    const parsed = JSON.parse(detail) as { code?: string; error?: string; message?: string };
    return parsed.code ?? parsed.error ?? parsed.message ?? null;
  } catch {
    return null;
  }
}
