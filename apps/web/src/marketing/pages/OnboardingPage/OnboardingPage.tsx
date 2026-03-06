import { type ChangeEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Logo } from "@looped/ui";

import { CameraIcon } from "@/app/components/AppIcons/AppIcons";
import { useToast } from "@/app/components/AppToast/AppToast";
import { AvatarCropModal } from "@/app/components/AvatarCropModal/AvatarCropModal";
import { CommunityRequestFlow } from "@/app/components/CommunityRequestFlow/CommunityRequestFlow";
import { OnboardingContinueButton } from "@/app/components/OnboardingContinueButton/OnboardingContinueButton";
import { VerificationEmailFlow } from "@/app/components/VerificationEmailFlow/VerificationEmailFlow";
import { VerificationInfoContent } from "@/app/components/VerificationInfoContent/VerificationInfoContent";
import kickoffIllustration from "@/assets/illustrations/kickoff.png";
import skipVerifyIllustration from "@/assets/illustrations/skip-verify.png";
import verifiedConfirmIllustration from "@/assets/illustrations/verified-confirm.png";
import verifyFirstIllustration from "@/assets/illustrations/verify-first.png";
import verifyInfoIllustration from "@/assets/illustrations/verify-info.png";
import { useUserSession } from "@/hooks/useUserSession";
import { useEmailVerificationMachine } from "@/lib/emailVerificationMachine";
import {
  dismissProfileCompletionPrompt,
  acknowledgeSkipExplainer,
  checkUsernameAvailability,
  completeAfterCommunityRequest,
  finishCommunityEmailVerification,
  fetchCommunityVerificationDomains,
  fetchRecommendedOnboardingCommunities,
  fetchRecommendedOnboardingSpecializations,
  finalizeOnboarding,
  followOnboardingCommunity,
  joinSpecialization,
  markOnboardingEmailVerificationSuccess,
  markOnboardingInfoScreenViewed,
  OnboardingApiError,
  saveProfileCompletionDraft,
  searchOnboardingCommunities,
  searchOnboardingSpecializations,
  setOnboardingOrg,
  setOnboardingVerificationChoice,
  startCommunityEmailVerification,
  submitOnboardingProfile,
  submitOnboardingSpecialization,
  type CommunityKind,
  type CommunityOption,
  type SpecializationOption,
} from "@/lib/onboardingApi";
import { canGoBackFromStep, resolveOnboardingStep, shouldHardBlockHistoryBack, type OnboardingFlowStep } from "@/lib/onboardingResolver";
import { fetchSessionBootstrap, type SessionBootstrap } from "@/lib/sessionBootstrapApi";
import {
  clearPersistedOnboardingState,
  defaultPersistedOnboardingState,
  loadPersistedOnboardingState,
  savePersistedOnboardingState,
  type PersistedOnboardingState,
} from "@/lib/onboardingStorage";

const USERNAME_DEBOUNCE_MS = 280;
const ORG_SEARCH_DEBOUNCE_MS = 250;
const SPECIALIZATION_SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";
const LOCKED_TRANSITION_STEPS = new Set<OnboardingFlowStep>([
  "profile_setup",
  "specialization_selection",
  "verification_confirmation",
]);
const SKIP_PATH_BACK_OVERRIDE_STEPS = new Set<OnboardingFlowStep>([
  "skip_explainer",
  "verification_intro",
  "org_selection",
  "verification_info",
]);

const STEP_LABELS: Record<OnboardingFlowStep, string> = {
  profile_setup: "Profile",
  verification_info: "Info",
  org_selection: "Organization",
  verification_intro: "Verification",
  verification_choice: "Verify with email",
  email_verification_enter_email: "Email",
  email_verification_enter_code: "Code",
  specialization_selection: "Specialization",
  skip_explainer: "Review",
  verification_confirmation: "Finalize",
  completed: "Done",
  unsupported_web_stage: "Unsupported",
};

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function normalizeCommunityKind(value: string | null | undefined): CommunityKind {
  return value?.trim().toLowerCase() === "company" ? "company" : "company";
}

function isSelectableOrgKind(kind: string | null | undefined): kind is CommunityKind {
  return kind?.trim().toLowerCase() === "company";
}

function mergeCommunityLists(...lists: CommunityOption[][]): CommunityOption[] {
  const byId = new Map<string, CommunityOption>();
  for (const list of lists) {
    for (const item of list) {
      if (!isSelectableOrgKind(item.kind)) continue;
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
        continue;
      }

      const existingMemberCount = existing.memberCount ?? -1;
      const nextMemberCount = item.memberCount ?? -1;
      if (nextMemberCount > existingMemberCount) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((left, right) => {
    const memberDelta = (right.memberCount ?? 0) - (left.memberCount ?? 0);
    if (memberDelta !== 0) return memberDelta;

    const nameDelta = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    if (nameDelta !== 0) return nameDelta;

    return left.id.localeCompare(right.id);
  });
}

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
}

function normalizeVerificationPath(value: string | null | undefined): "email" | "skip" | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "email" || normalized === "skip") return normalized;
  return null;
}

function normalizeOnboardingStage(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextStepFromVerificationContext(bootstrap: SessionBootstrap | null): OnboardingFlowStep {
  if (!bootstrap) return "specialization_selection";
  const verificationStatus = normalizeOnboardingStage(bootstrap.onboardingContext.verificationStatus);
  const requiresSpecialization = Boolean(bootstrap.onboardingContext.requiresSpecializationSelection);
  const hasSelectedSpecialization = Boolean(bootstrap.onboardingContext.selectedSpecializationId);

  if (verificationStatus === "approved" && (!requiresSpecialization || hasSelectedSpecialization)) {
    return "verification_confirmation";
  }
  return "specialization_selection";
}

const EMAIL_PATH_STAGE_HINTS = new Set([
  "email_verification",
  "email_verified",
  "specialization_required",
  "specialization_selection",
  "specialization_selected",
  "ready_to_finalize",
  "completed",
  "finalized",
]);

const SPECIALIZATION_STAGE_HINTS = new Set([
  "specialization_selection",
  "specialization_required",
  "email_verified",
]);

function buildProgressSteps({
  currentStep,
  verificationPath,
}: {
  currentStep: OnboardingFlowStep;
  verificationPath: "email" | "skip" | null;
}): OnboardingFlowStep[] {
  const skipPath = verificationPath === "skip" || currentStep === "skip_explainer";
  if (skipPath) {
    return [
      "profile_setup",
      "verification_info",
      "org_selection",
      "verification_intro",
      "skip_explainer",
    ];
  }

  return [
    "profile_setup",
    "verification_info",
    "org_selection",
    "verification_intro",
    "verification_choice",
    "email_verification_enter_email",
    "email_verification_enter_code",
    "specialization_selection",
    "verification_confirmation",
  ];
}

function validateProfileDraft(draft: PersistedOnboardingState["profileDraft"]): string | null {
  if (!USERNAME_REGEX.test(sanitizeUsername(draft.username))) {
    return "Username must be 3-30 characters using lowercase letters, numbers, or underscores.";
  }
  if (!draft.firstName.trim()) return "First name is required.";
  if (!draft.lastName.trim()) return "Last name is required.";
  if (!draft.dateOfBirth) return "Date of birth is required.";
  return null;
}

function isInvalidOnboardingStateError(error: unknown): error is OnboardingApiError {
  return (
    error instanceof OnboardingApiError &&
    (error.code === "invalid_stage" ||
      error.code === "invalid_onboarding_step" ||
      error.code === "invalid_onboarding_stage")
  );
}

function mapOnboardingError(error: unknown): string {
  if (error instanceof OnboardingApiError) {
    switch (error.code) {
      case "invalid_username":
        return "Username is invalid. Use lowercase letters, numbers, or underscores.";
      case "username_taken":
        return "That username is already taken.";
      case "email_taken":
      case "email_in_use":
        return "This email is already tied to another account.";
      case "query_required":
        return "Enter a search query.";
      case "domains_not_configured":
        return "This organization is not configured for email verification yet.";
      case "email_domain_not_allowed":
      case "domain_not_allowed":
        return "Use an approved company email domain.";
      case "invalid_email":
        return "Enter a valid email address.";
      case "code_required":
        return "Enter the 6-digit code.";
      case "invalid_code":
        return "That code is invalid. Try again.";
      case "email_send_failed":
        return "We couldn't send that verification email. Please try again.";
      case "email_mismatch":
        return "This code was sent to a different email. Start over with the same address.";
      case "too_many_attempts":
        return "Too many code attempts. Start verification again.";
      case "resend_cooldown":
      case "email_start_rate_limited_hour":
      case "email_start_rate_limited_day":
        return error.retryAfterSeconds
          ? `Try again in ${Math.max(1, Math.ceil(error.retryAfterSeconds))} seconds.`
          : "Please wait before requesting another code.";
      case "selected_org_not_verified":
        return "Complete email verification before moving forward.";
      case "specialization_required":
        return "Pick a specialization to continue.";
      case "specialization_not_joined":
        return "Unable to join the selected specialization right now.";
      case "invalid_stage":
      case "invalid_onboarding_step":
      case "invalid_onboarding_stage":
      case "onboarding_incomplete":
        return "Your onboarding state changed. We refreshed your latest step.";
      default:
        return error.message || "Something went wrong. Please try again.";
    }
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function getStepIllustration(step: OnboardingFlowStep): string {
  if (step === "profile_setup") return kickoffIllustration;
  if (step === "verification_info") return verifyInfoIllustration;
  if (step === "org_selection") return kickoffIllustration;
  if (step === "verification_intro" || step === "verification_choice") return verifyFirstIllustration;
  if (step === "email_verification_enter_email" || step === "email_verification_enter_code") {
    return verifyFirstIllustration;
  }
  if (step === "specialization_selection") return kickoffIllustration;
  if (step === "skip_explainer") return skipVerifyIllustration;
  if (step === "verification_confirmation" || step === "completed") return verifiedConfirmIllustration;
  if (step === "unsupported_web_stage") return kickoffIllustration;
  return kickoffIllustration;
}

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

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
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

function OnboardingBackButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Back"
    >
      <BackArrowIcon className="h-5 w-5" />
    </button>
  );
}

function nextBackStep(step: OnboardingFlowStep): OnboardingFlowStep | null {
  if (step === "verification_info") return "profile_setup";
  if (step === "org_selection") return "verification_info";
  if (step === "verification_intro") return "org_selection";
  if (step === "verification_choice") return "verification_intro";
  if (step === "email_verification_enter_code") return "email_verification_enter_email";
  if (step === "email_verification_enter_email") return "verification_choice";
  if (step === "skip_explainer") return "verification_intro";
  return null;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { status, accessState, user, bootstrap, signOut, refreshSession } = useUserSession();
  const uid = user?.uid ?? null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const usernameRequestRef = useRef(0);
  const orgSearchRequestRef = useRef(0);
  const specializationSearchRequestRef = useRef(0);

  const [persisted, setPersisted] = useState<PersistedOnboardingState>(defaultPersistedOnboardingState());
  const [transitionLock, setTransitionLock] = useState(false);
  const [, setStepError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [manualStepOverride, setManualStepOverride] = useState<OnboardingFlowStep | null>(null);
  const [photoFallbackAttempted, setPhotoFallbackAttempted] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityOption[]>([]);
  const [searchedCommunities, setSearchedCommunities] = useState<CommunityOption[]>([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const [orgSearchError, setOrgSearchError] = useState<string | null>(null);
  const [isOrgSearchFocused, setIsOrgSearchFocused] = useState(false);
  const [orgSearchRefreshNonce, setOrgSearchRefreshNonce] = useState(0);
  const [showCommunityRequestFlow, setShowCommunityRequestFlow] = useState(false);
  const [showOrgChoiceInfo, setShowOrgChoiceInfo] = useState(false);
  const [showVerificationHowItWorks, setShowVerificationHowItWorks] = useState(false);
  const [specializationOptions, setSpecializationOptions] = useState<SpecializationOption[]>([]);
  const [specializationLoading, setSpecializationLoading] = useState(false);
  const [specializationQuery, setSpecializationQuery] = useState("");
  const [specializationSearchError, setSpecializationSearchError] = useState<string | null>(null);
  const [specializationSearchRefreshNonce, setSpecializationSearchRefreshNonce] = useState(0);
  const [specializationSelectionError, setSpecializationSelectionError] = useState<string | null>(null);
  const [showSpecializationInfo, setShowSpecializationInfo] = useState(false);
  const [finishBio, setFinishBio] = useState("");
  const [finishPhotoFile, setFinishPhotoFile] = useState<File | null>(null);
  const [finishPhotoPreviewUrl, setFinishPhotoPreviewUrl] = useState<string | null>(null);
  const [finishCropSourceUrl, setFinishCropSourceUrl] = useState<string | null>(null);
  const [isApplyingFinishCrop, setIsApplyingFinishCrop] = useState(false);

  const showOnboardingError = useCallback((message: string) => {
    showToast({
      kind: "error",
      title: "Onboarding",
      text: message,
      durationMs: 2800,
    });
  }, [showToast]);

  const showOnboardingInfo = useCallback((message: string) => {
    showToast({
      kind: "info",
      title: "Onboarding",
      text: message,
      durationMs: 2200,
    });
  }, [showToast]);

  const showOnboardingSuccess = useCallback((message: string) => {
    showToast({
      kind: "success",
      title: "Onboarding",
      text: message,
      durationMs: 2200,
    });
  }, [showToast]);

  const profileCompletionPrompt = Boolean(bootstrap?.profileCompletion?.shouldPrompt);
  const hasPendingVerificationCode = Boolean(persisted.verificationDraft.submittedEmail);
  const resolvedStep = resolveOnboardingStep({
    bootstrap,
    localStep: persisted.latestStep,
    hasPendingVerificationCode,
  });
  const currentStep = manualStepOverride ?? resolvedStep;
  const selectedOrgId =
    currentStep === "org_selection"
      ? persisted.orgDraft?.orgId ?? bootstrap?.onboardingContext.selectedOrgId ?? ""
      : bootstrap?.onboardingContext.selectedOrgId ?? persisted.orgDraft?.orgId ?? "";
  const selectedOrgKind = normalizeCommunityKind(
    currentStep === "org_selection"
      ? persisted.orgDraft?.orgKind ?? bootstrap?.onboardingContext.selectedOrgKind ?? "company"
      : bootstrap?.onboardingContext.selectedOrgKind ?? persisted.orgDraft?.orgKind ?? "company"
  );
  const selectedOrgFromPicker =
    [...recommendedCommunities, ...searchedCommunities].find((entry) => entry.id === selectedOrgId) ?? null;
  const selectedOrgNameFromContext = bootstrap?.onboardingContext.selectedOrgName?.trim() || null;
  const selectedOrgNameFromPicker = selectedOrgFromPicker?.name?.trim() || null;
  const selectedOrgNameFromDraft = persisted.orgDraft?.orgName?.trim() || null;
  const resolvedSelectedOrgName =
    selectedOrgNameFromContext ??
    selectedOrgNameFromPicker ??
    selectedOrgNameFromDraft ??
    null;
  const selectedCommunity =
    selectedOrgFromPicker ??
    (selectedOrgId && resolvedSelectedOrgName
      ? {
          id: selectedOrgId,
          kind: selectedOrgKind,
          name: resolvedSelectedOrgName,
        }
      : null);
  const activeOrgQuery = searchQuery.trim();
  const visibleCommunities = activeOrgQuery.length > 0 ? searchedCommunities : recommendedCommunities;
  const selectedOrgLabel = resolvedSelectedOrgName ?? "your community";
  const specializationType = "field";
  const specializationTitle = "Field";
  const activeSpecializationQuery = specializationQuery.trim();

  const verificationPath = normalizeVerificationPath(bootstrap?.onboardingContext.verificationPath);
  const normalizedServerStage = normalizeOnboardingStage(bootstrap?.onboardingStageV2);
  const serverAlreadyOnSkipPath =
    verificationPath === "skip" || normalizedServerStage === "skip_explainer";
  const serverAlreadyOnEmailPath =
    verificationPath === "email" ||
    (normalizedServerStage ? EMAIL_PATH_STAGE_HINTS.has(normalizedServerStage) : false);
  const progressSteps = buildProgressSteps({
    currentStep,
    verificationPath,
  });
  const currentStepIndex = progressSteps.findIndex((step) => step === currentStep);
  const progressTotal = progressSteps.length;
  const progressCount =
    currentStep === "completed"
      ? progressTotal
      : currentStepIndex >= 0
        ? currentStepIndex + 1
        : 1;
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.max(0, Math.round((progressCount / progressTotal) * 100))) : 0;
  const bootstrapUser = bootstrap?.user;
  const bootstrapUsername =
    typeof bootstrapUser?.username === "string"
      ? sanitizeUsername(bootstrapUser.username)
      : typeof bootstrapUser?.handle === "string"
        ? sanitizeUsername(bootstrapUser.handle)
        : "";
  const bootstrapFirstName = typeof bootstrapUser?.first_name === "string" ? bootstrapUser.first_name : "";
  const bootstrapLastName = typeof bootstrapUser?.last_name === "string" ? bootstrapUser.last_name : "";
  const bootstrapDateOfBirth = typeof bootstrapUser?.date_of_birth === "string" ? bootstrapUser.date_of_birth : "";
  const bootstrapBio = typeof bootstrapUser?.bio === "string" ? bootstrapUser.bio : "";
  const bootstrapAvatarUrl =
    typeof bootstrapUser?.profile_image_url === "string"
      ? bootstrapUser.profile_image_url
      : typeof bootstrapUser?.profileImageUrl === "string"
        ? bootstrapUser.profileImageUrl
        : null;
  const effectiveFinishAvatarSrc =
    finishPhotoPreviewUrl ?? bootstrapAvatarUrl ?? user?.photoURL ?? DEFAULT_PROFILE_IMAGE_SRC;

  type PersistedOnboardingPatch = Partial<
    Omit<PersistedOnboardingState, "profileDraft" | "verificationDraft" | "specializationDraft">
  > & {
    profileDraft?: Partial<PersistedOnboardingState["profileDraft"]>;
    verificationDraft?: Partial<PersistedOnboardingState["verificationDraft"]>;
    specializationDraft?: Partial<PersistedOnboardingState["specializationDraft"]>;
  };

  const savePersisted = useCallback((next: PersistedOnboardingPatch) => {
    if (!uid) {
      setPersisted((previous) => ({
        ...previous,
        ...next,
        profileDraft: {
          ...previous.profileDraft,
          ...(next.profileDraft ?? {}),
        },
        verificationDraft: {
          ...previous.verificationDraft,
          ...(next.verificationDraft ?? {}),
        },
        specializationDraft: {
          ...previous.specializationDraft,
          ...(next.specializationDraft ?? {}),
          selectedIds: next.specializationDraft?.selectedIds ?? previous.specializationDraft.selectedIds,
        },
      }));
      return;
    }
    const current = loadPersistedOnboardingState(uid);
    const normalized: Partial<PersistedOnboardingState> = {
      ...next,
      profileDraft: next.profileDraft
        ? {
            ...current.profileDraft,
            ...next.profileDraft,
          }
        : undefined,
      verificationDraft: next.verificationDraft
        ? {
            ...current.verificationDraft,
            ...next.verificationDraft,
          }
        : undefined,
      specializationDraft: next.specializationDraft
        ? {
            ...current.specializationDraft,
            ...next.specializationDraft,
            selectedIds: next.specializationDraft.selectedIds ?? current.specializationDraft.selectedIds,
          }
        : undefined,
    };
    const saved = savePersistedOnboardingState(uid, normalized);
    setPersisted(saved);
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setPersisted(defaultPersistedOnboardingState());
      return;
    }
    setPersisted(loadPersistedOnboardingState(uid));
  }, [uid]);

  useEffect(() => {
    if (currentStep !== "profile_setup") return;

    const draft = persisted.profileDraft;
    const nextUsername = draft.username || bootstrapUsername;
    const nextFirstName = draft.firstName || bootstrapFirstName;
    const nextLastName = draft.lastName || bootstrapLastName;
    const nextDateOfBirth = draft.dateOfBirth || bootstrapDateOfBirth;

    if (
      nextUsername === draft.username &&
      nextFirstName === draft.firstName &&
      nextLastName === draft.lastName &&
      nextDateOfBirth === draft.dateOfBirth
    ) {
      return;
    }

    savePersisted({
      profileDraft: {
        username: nextUsername,
        firstName: nextFirstName,
        lastName: nextLastName,
        dateOfBirth: nextDateOfBirth,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapDateOfBirth, bootstrapFirstName, bootstrapLastName, bootstrapUsername, currentStep]);

  useEffect(() => {
    if (!selectedOrgId) return;
    if (persisted.orgDraft?.orgId === selectedOrgId) return;
    savePersisted({
      orgDraft: {
        orgId: selectedOrgId,
        orgName: persisted.orgDraft?.orgName || selectedCommunity?.name || resolvedSelectedOrgName || "",
        orgKind: selectedOrgKind,
      },
      specializationDraft: {
        primaryId: "",
        selectedIds: [],
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, selectedOrgKind]);

  useEffect(() => {
    if (persisted.latestStep === currentStep) return;
    savePersisted({ latestStep: currentStep });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, persisted.latestStep]);

  useEffect(() => {
    if (currentStep !== "profile_setup") {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    const username = sanitizeUsername(persisted.profileDraft.username);
    if (!username) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    if (!USERNAME_REGEX.test(username)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Use 3-30 lowercase letters, numbers, or underscores.");
      return;
    }

    const requestId = ++usernameRequestRef.current;
    setUsernameStatus("checking");
    setUsernameMessage("Checking username...");

    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(username)
        .then((result) => {
          if (requestId !== usernameRequestRef.current) return;
          if (result.available || result.ownedByMe) {
            setUsernameStatus("available");
            setUsernameMessage("Username is available.");
            return;
          }
          setUsernameStatus("taken");
          setUsernameMessage("That username is already taken.");
        })
        .catch((error) => {
          if (requestId !== usernameRequestRef.current) return;
          if (error instanceof OnboardingApiError && error.code === "invalid_username") {
            setUsernameStatus("invalid");
            setUsernameMessage("Use 3-30 lowercase letters, numbers, or underscores.");
            return;
          }
          setUsernameStatus("error");
          setUsernameMessage("Unable to check username right now.");
        });
    }, USERNAME_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currentStep, persisted.profileDraft.username]);

  useEffect(() => {
    if (status === "loading" || status === "checking") return;
    if (accessState === "active") {
      navigate("/app", { replace: true });
      return;
    }
    if (accessState === "delete_pending") {
      navigate("/login?status=delete-pending", { replace: true });
      return;
    }
    if (accessState === "deleted") {
      navigate("/login?status=account-deleted", { replace: true });
      return;
    }
    if (accessState === "signed_out") {
      navigate("/login?next=%2Fonboarding", { replace: true });
    }
  }, [accessState, navigate, status]);

  useEffect(() => {
    if (currentStep !== "org_selection") return;

    const querySnapshot = activeOrgQuery;
    const requestId = ++orgSearchRequestRef.current;
    const controller = new AbortController();
    let timer: number | null = null;

    const run = () => {
      setIsCommunityLoading(true);
      setOrgSearchError(null);

      const request =
        querySnapshot.length > 0
          ? searchOnboardingCommunities({
              query: querySnapshot,
              kind: "company",
              limit: 25,
              signal: controller.signal,
            })
          : fetchRecommendedOnboardingCommunities({
              kind: "company",
              limit: 40,
              signal: controller.signal,
            });

      void request
        .then((companies) => {
          if (controller.signal.aborted || requestId !== orgSearchRequestRef.current) return;
          const merged = mergeCommunityLists(companies);
          if (querySnapshot.length > 0) {
            setSearchedCommunities(merged);
          } else {
            setRecommendedCommunities(merged);
            setSearchedCommunities([]);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted || requestId !== orgSearchRequestRef.current) return;
          setOrgSearchError(mapOnboardingError(error));
          if (querySnapshot.length > 0) {
            setSearchedCommunities([]);
          } else {
            setRecommendedCommunities([]);
          }
        })
        .finally(() => {
          if (controller.signal.aborted || requestId !== orgSearchRequestRef.current) return;
          setIsCommunityLoading(false);
        });
    };

    if (querySnapshot.length > 0) {
      timer = window.setTimeout(run, ORG_SEARCH_DEBOUNCE_MS);
    } else {
      run();
    }

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeOrgQuery, currentStep, orgSearchRefreshNonce]);

  useEffect(() => {
    if (currentStep !== "specialization_selection") return;
    if (!selectedOrgId) {
      setManualStepOverride("org_selection");
      savePersisted({ latestStep: "org_selection" });
      return;
    }

    const querySnapshot = activeSpecializationQuery;
    const requestId = ++specializationSearchRequestRef.current;
    const controller = new AbortController();
    let timer: number | null = null;

    const run = () => {
      setSpecializationLoading(true);
      setSpecializationSearchError(null);

      const request =
        querySnapshot.length > 0
          ? searchOnboardingSpecializations({
              query: querySnapshot,
              kind: specializationType,
              limit: 50,
              signal: controller.signal,
            })
          : fetchRecommendedOnboardingSpecializations({
              type: "field",
              limit: 50,
              signal: controller.signal,
            });

      void request
        .then((items) => {
          if (controller.signal.aborted || requestId !== specializationSearchRequestRef.current) return;
          setSpecializationOptions(items);
        })
        .catch((error) => {
          if (controller.signal.aborted || requestId !== specializationSearchRequestRef.current) return;
          setSpecializationSearchError(mapOnboardingError(error));
          setSpecializationOptions([]);
        })
        .finally(() => {
          if (controller.signal.aborted || requestId !== specializationSearchRequestRef.current) return;
          setSpecializationLoading(false);
        });
    };

    if (querySnapshot.length > 0) {
      timer = window.setTimeout(run, SPECIALIZATION_SEARCH_DEBOUNCE_MS);
    } else {
      run();
    }

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeSpecializationQuery,
    currentStep,
    savePersisted,
    selectedOrgId,
    specializationSearchRefreshNonce,
    specializationType,
  ]);

  useEffect(() => {
    if (currentStep !== "verification_intro") return;
    if (!selectedOrgId || !resolvedSelectedOrgName) {
      setManualStepOverride("org_selection");
      savePersisted({ latestStep: "org_selection" });
    }
  }, [currentStep, resolvedSelectedOrgName, savePersisted, selectedOrgId]);

  useEffect(() => {
    if (currentStep === "org_selection") return;
    if (!showCommunityRequestFlow) return;
    setShowCommunityRequestFlow(false);
  }, [currentStep, showCommunityRequestFlow]);

  useEffect(() => {
    if (currentStep === "verification_intro") return;
    if (!showVerificationHowItWorks) return;
    setShowVerificationHowItWorks(false);
  }, [currentStep, showVerificationHowItWorks]);

  useEffect(() => {
    if (currentStep === "specialization_selection") return;
    if (!showSpecializationInfo) return;
    setShowSpecializationInfo(false);
  }, [currentStep, showSpecializationInfo]);

  useEffect(() => {
    if (!manualStepOverride) return;
    if (!canGoBackFromStep(resolvedStep)) {
      setManualStepOverride(null);
      return;
    }
    if (
      resolvedStep === "skip_explainer" &&
      !SKIP_PATH_BACK_OVERRIDE_STEPS.has(manualStepOverride)
    ) {
      setManualStepOverride(null);
      return;
    }
    if (
      (resolvedStep === "completed" ||
        resolvedStep === "verification_confirmation" ||
        resolvedStep === "specialization_selection" ||
        resolvedStep === "unsupported_web_stage") &&
      manualStepOverride !== resolvedStep
    ) {
      setManualStepOverride(null);
    }
  }, [manualStepOverride, resolvedStep]);

  useEffect(() => {
    if (!shouldHardBlockHistoryBack(currentStep)) return;
    const marker = { onboardingGuard: true, step: currentStep, at: Date.now() };
    window.history.pushState(marker, "", window.location.href);

    const handlePopState = () => {
      if (LOCKED_TRANSITION_STEPS.has(currentStep) || transitionLock) {
        window.history.pushState(marker, "", window.location.href);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentStep, transitionLock]);

  useEffect(() => {
    if (currentStep !== "unsupported_web_stage") return;
    if (photoFallbackAttempted) return;
    setPhotoFallbackAttempted(true);
    setTransitionLock(true);
    void setOnboardingVerificationChoice("email")
      .then(() => refreshSession())
      .then(() => {
        savePersisted({ latestStep: "email_verification_enter_email" });
      })
      .catch((error) => {
        showOnboardingError(mapOnboardingError(error));
      })
      .finally(() => setTransitionLock(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, photoFallbackAttempted, refreshSession, showOnboardingError]);

  useEffect(() => {
    if (currentStep !== "completed" || !profileCompletionPrompt) return;
    if (!finishBio && bootstrapBio) {
      setFinishBio(bootstrapBio);
    }
  }, [bootstrapBio, currentStep, finishBio, profileCompletionPrompt]);

  useEffect(() => {
    return () => {
      if (finishPhotoPreviewUrl) {
        URL.revokeObjectURL(finishPhotoPreviewUrl);
      }
      if (finishCropSourceUrl) {
        URL.revokeObjectURL(finishCropSourceUrl);
      }
    };
  }, [finishCropSourceUrl, finishPhotoPreviewUrl]);

  const handleFinishAvatarImageError = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = DEFAULT_PROFILE_IMAGE_SRC;
  }, []);

  const handleFinishPhotoPicked = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showOnboardingError("Please select an image file.");
      return;
    }

    setStepError(null);
    setFinishCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }, [showOnboardingError]);

  const handleCancelFinishCrop = useCallback(() => {
    setFinishCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, []);

  const handleApplyFinishCrop = useCallback(async (file: File, previewUrl: string) => {
    setIsApplyingFinishCrop(true);
    try {
      setFinishPhotoFile(file);
      setFinishPhotoPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return previewUrl;
      });
      setFinishCropSourceUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setStepError(null);
    } finally {
      setIsApplyingFinishCrop(false);
    }
  }, []);

  const setBusy = (busy: boolean) => {
    setTransitionLock(busy);
    if (busy) {
      setStepError(null);
    }
  };

  const handleBack = () => {
    if (!canGoBackFromStep(currentStep) || transitionLock) return;
    const step = nextBackStep(currentStep);
    if (!step) return;
    setManualStepOverride(step);
    savePersisted({ latestStep: step });

    if (currentStep === "skip_explainer" && step === "verification_intro") {
      void (async () => {
        try {
          await setOnboardingVerificationChoice("email");
          await refreshSession();
        } catch {
          // best effort: keep UX moving; later mutations still resync on invalid stage
        }
      })();
    }
  };

  const routeToAppAfterOnboarding = useCallback(() => {
    if (uid) {
      clearPersistedOnboardingState(uid);
    }
    setManualStepOverride(null);
    navigate("/app", { replace: true });
  }, [navigate, uid]);

  const recoverFromInvalidOnboardingStep = useCallback(async (notice: string) => {
    try {
      await refreshSession();
      setManualStepOverride(null);
      setStepError(null);
      showOnboardingInfo(notice);
    } catch (error) {
      showOnboardingError(mapOnboardingError(error));
    }
  }, [refreshSession, showOnboardingError, showOnboardingInfo]);

  const handleProfileSubmit = async () => {
    const validationError = validateProfileDraft(persisted.profileDraft);
    if (validationError) {
      showOnboardingError(validationError);
      return;
    }
    if (resolvedStep !== "profile_setup") {
      setBusy(true);
      try {
        await refreshSession();
        setManualStepOverride(null);
      } catch (error) {
        showOnboardingError(mapOnboardingError(error));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (usernameStatus === "checking") {
      showOnboardingError("Please wait for username availability to finish checking.");
      return;
    }

    const typedUsername = sanitizeUsername(persisted.profileDraft.username);

    if (bootstrap?.provisioned) {
      setBusy(true);
      try {
        await refreshSession();
        savePersisted({ latestStep: "verification_info" });
        setManualStepOverride(null);
      } catch (error) {
        showOnboardingError(mapOnboardingError(error));
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const availability = await checkUsernameAvailability(typedUsername);
      if (!availability.available && !availability.ownedByMe) {
        showOnboardingError("That username is already taken.");
        return;
      }
      await submitOnboardingProfile({
        username: typedUsername,
        firstName: persisted.profileDraft.firstName.trim(),
        lastName: persisted.profileDraft.lastName.trim(),
        dateOfBirth: persisted.profileDraft.dateOfBirth,
      });
      savePersisted({
        profileDraft: {
          ...persisted.profileDraft,
          username: typedUsername,
        },
      });
      await refreshSession();
      savePersisted({ latestStep: "verification_info" });
      setManualStepOverride(null);
    } catch (error) {
      if (error instanceof OnboardingApiError && error.code === "already_onboarded") {
        await refreshSession();
        savePersisted({ latestStep: "verification_info" });
        setManualStepOverride(null);
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerificationInfoContinue = async () => {
    setBusy(true);
    try {
      await markOnboardingInfoScreenViewed();
      await refreshSession();
      savePersisted({ latestStep: "org_selection" });
      setManualStepOverride(null);
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOrgContinue = async () => {
    if (!selectedCommunity) {
      showOnboardingError("Select an organization to continue.");
      return;
    }
    setBusy(true);
    try {
      const orgSnapshot = await setOnboardingOrg(selectedCommunity.id);
      try {
        await followOnboardingCommunity(selectedCommunity.id);
      } catch {
        // best effort
      }
      if (serverAlreadyOnSkipPath) {
        try {
          await setOnboardingVerificationChoice("email");
        } catch {
          // best effort: step will be reasserted again in verification flow
        }
      }
      await refreshSession();
      const context = orgSnapshot.onboarding_context;
      const selectedOrgNameFromResponse =
        context && typeof context === "object"
          ? (() => {
              const raw = (context as Record<string, unknown>).selected_org_name ??
                (context as Record<string, unknown>).selectedOrgName;
              if (typeof raw !== "string") return null;
              const trimmed = raw.trim();
              return trimmed.length > 0 ? trimmed : null;
            })()
          : null;
      savePersisted({
        orgDraft: {
          orgId: selectedCommunity.id,
          orgName: selectedOrgNameFromResponse ?? selectedCommunity.name ?? selectedCommunity.shortName ?? "",
          orgKind: "company",
        },
        latestStep: "verification_intro",
      });
      setManualStepOverride("verification_intro");
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        try {
          await refreshSession();
          setManualStepOverride(null);
        } catch {
          // best effort resync after org selection failure
        }
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSelectVerificationPath = async (path: "email" | "skip") => {
    if (path === "skip" && serverAlreadyOnSkipPath) {
      savePersisted({ latestStep: "skip_explainer" });
      setManualStepOverride("skip_explainer");
      return;
    }
    if (path === "email" && serverAlreadyOnEmailPath) {
      const nextStep =
        hasPendingVerificationCode
          ? "email_verification_enter_code"
          : "email_verification_enter_email";
      savePersisted({ latestStep: nextStep });
      setManualStepOverride(null);
      return;
    }

    setBusy(true);
    try {
      await setOnboardingVerificationChoice(path);
      await refreshSession();
      if (path === "skip") {
        savePersisted({ latestStep: "skip_explainer" });
        setManualStepOverride("skip_explainer");
      } else {
        const nextStep =
          hasPendingVerificationCode
            ? "email_verification_enter_code"
            : "email_verification_enter_email";
        savePersisted({ latestStep: nextStep });
        setManualStepOverride(nextStep);
      }
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerificationIntroContinue = () => {
    savePersisted({ latestStep: "verification_choice" });
    setManualStepOverride("verification_choice");
  };

  const ensureOnboardingEmailVerificationPath = useCallback(async () => {
    if (serverAlreadyOnEmailPath) return;
    await setOnboardingVerificationChoice("email");
    await refreshSession();
  }, [refreshSession, serverAlreadyOnEmailPath]);

  const handleEmailVerificationSuccess = useCallback(async () => {
    let markedOnboardingSuccess = false;
    let markError: unknown = null;
    try {
      await markOnboardingEmailVerificationSuccess();
      markedOnboardingSuccess = true;
    } catch {
      try {
        await setOnboardingVerificationChoice("email");
        await markOnboardingEmailVerificationSuccess();
        markedOnboardingSuccess = true;
      } catch (retryError) {
        markError = retryError;
      }
    }

    let latestBootstrap: SessionBootstrap | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      latestBootstrap = await fetchSessionBootstrap();
      const normalizedStage = normalizeOnboardingStage(latestBootstrap.onboardingStageV2);
      const normalizedStatus = normalizeOnboardingStage(latestBootstrap.onboardingContext.verificationStatus);
      const stageAdvanced = normalizedStage !== "email_verification";
      const statusApproved = normalizedStatus === "approved";
      if (stageAdvanced || statusApproved) {
        break;
      }
      await sleep(250);
    }

    await refreshSession();
    savePersisted({
      verificationDraft: {
        pendingCode: "",
        submittedEmail: "",
      },
    });

    if (latestBootstrap?.onboardingComplete) {
      routeToAppAfterOnboarding();
      return;
    }

    const fallbackStep = nextStepFromVerificationContext(latestBootstrap);
    if (
      markError ||
      !markedOnboardingSuccess ||
      normalizeOnboardingStage(latestBootstrap?.onboardingStageV2) === "email_verification"
    ) {
      savePersisted({ latestStep: fallbackStep });
      setManualStepOverride(fallbackStep);
      return;
    }

    setManualStepOverride(null);
  }, [refreshSession, routeToAppAfterOnboarding, savePersisted]);

  const onboardingVerificationApi = useMemo(
    () => ({
      loadDomains: ({ communityId, signal }: { communityId: string; signal?: AbortSignal }) =>
        fetchCommunityVerificationDomains(communityId, { signal }),
      sendCode: ({ communityId, email }: { communityId: string; email: string }) =>
        startCommunityEmailVerification({ communityId, email }),
      verifyCode: ({ communityId, email, code }: { communityId: string; email: string; code: string }) =>
        finishCommunityEmailVerification({ communityId, email, code }),
    }),
    []
  );

  const onboardingVerificationAdapter = useMemo(
    () => ({
      beforeLoadDomains: async () => {
        try {
          await ensureOnboardingEmailVerificationPath();
        } catch {
          // best effort on domain-load path
        }
      },
      beforeSendCode: async () => {
        await ensureOnboardingEmailVerificationPath();
      },
      beforeSubmitCode: async () => {
        await ensureOnboardingEmailVerificationPath();
      },
      afterVerifySuccess: async () => {
        await handleEmailVerificationSuccess();
      },
      onSyncRecoverableError: async () => {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      },
    }),
    [ensureOnboardingEmailVerificationPath, handleEmailVerificationSuccess, recoverFromInvalidOnboardingStep]
  );

  const handleSpecializationContinue = async () => {
    const selectedIds = Array.from(
      new Set(persisted.specializationDraft.selectedIds.filter((entry) => entry.length > 0))
    ).slice(0, 2);
    if (!selectedIds.length) {
      showOnboardingError("Select at least one specialization.");
      return;
    }

    setBusy(true);
    try {
      const primaryId = selectedIds[0];
      let primarySubmitted = false;
      try {
        await submitOnboardingSpecialization(primaryId);
        primarySubmitted = true;
      } catch (error) {
        if (isInvalidOnboardingStateError(error)) {
          await recoverFromInvalidOnboardingStep(
            "Your onboarding state changed. We refreshed your current step."
          );
          return;
        }

        const latestBootstrap = await fetchSessionBootstrap();
        const normalizedStage = normalizeOnboardingStage(latestBootstrap.onboardingStageV2);
        const allowedNext = latestBootstrap.allowedNextStagesV2.map((entry) => entry.toLowerCase());
        const stillAllowsSpecialization =
          (normalizedStage ? SPECIALIZATION_STAGE_HINTS.has(normalizedStage) : false) ||
          allowedNext.includes("specialization_selection") ||
          allowedNext.includes("specialization_required");
        if (!stillAllowsSpecialization) {
          throw error;
        }

        await submitOnboardingSpecialization(primaryId);
        primarySubmitted = true;
      }

      if (!primarySubmitted) return;

      if (selectedIds.length > 1) {
        await Promise.allSettled(selectedIds.slice(1).map((id) => joinSpecialization(id)));
      }
      savePersisted({
        specializationDraft: {
          primaryId,
          selectedIds,
        },
      });
      await refreshSession();
      savePersisted({ latestStep: "verification_confirmation" });
      setManualStepOverride("verification_confirmation");
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkipContinue = async () => {
    setBusy(true);
    try {
      await acknowledgeSkipExplainer();
      await finalizeOnboarding();
      await refreshSession();
      routeToAppAfterOnboarding();
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFinalizeContinue = async () => {
    setBusy(true);
    try {
      await finalizeOnboarding();
      await refreshSession();
      routeToAppAfterOnboarding();
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        await recoverFromInvalidOnboardingStep(
          "Your onboarding state changed. We refreshed your current step."
        );
      } else {
        showOnboardingError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteAfterCommunityRequestFlow = useCallback(async () => {
    try {
      await completeAfterCommunityRequest();
      await refreshSession();
      routeToAppAfterOnboarding();
    } catch (error) {
      if (isInvalidOnboardingStateError(error)) {
        try {
          await refreshSession();
        } catch {
          // best effort resync
        }
      }
      throw error;
    }
  }, [refreshSession, routeToAppAfterOnboarding]);

  const mapCommunityRequestCompletionError = useCallback((error: unknown) => {
    const base = "Your request was submitted, but onboarding could not be finished yet.";
    if (isInvalidOnboardingStateError(error)) {
      return `${base} We refreshed your onboarding state. Close this and choose an existing community.`;
    }
    const reason = mapOnboardingError(error);
    return `${base} ${reason}`;
  }, []);

  const toggleSpecialization = (id: string) => {
    const current = persisted.specializationDraft.selectedIds;
    const exists = current.includes(id);
    if (!exists && current.length >= 2) {
      setSpecializationSelectionError("You can select up to 2.");
      return;
    }

    setSpecializationSelectionError(null);
    const next = exists
      ? current.filter((entry) => entry !== id)
      : [...current, id];
    savePersisted({
      specializationDraft: {
        ...persisted.specializationDraft,
        selectedIds: next,
      },
    });
  };

  const saveFinishProfile = async () => {
    setBusy(true);
    try {
      await saveProfileCompletionDraft({
        bio: finishBio.trim(),
        profilePhotoFile: finishPhotoFile,
      });
      await dismissProfileCompletionPrompt();
      await refreshSession();
      showOnboardingSuccess("Profile updated.");
      setBusy(false);
    } catch (error) {
      showOnboardingError(mapOnboardingError(error));
      setBusy(false);
    }
  };

  const skipFinishProfile = async () => {
    setBusy(true);
    try {
      await dismissProfileCompletionPrompt();
      await refreshSession();
      showOnboardingInfo("You can finish your profile anytime from settings.");
    } catch (error) {
      showOnboardingError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const emailVerificationEnabled =
    currentStep === "email_verification_enter_email" ||
    currentStep === "email_verification_enter_code";

  const updateVerificationDraft = useCallback(
    (nextDraft: Partial<PersistedOnboardingState["verificationDraft"]>) => {
      savePersisted({
        verificationDraft: nextDraft,
      });
    },
    [savePersisted]
  );

  const emailVerificationMachine = useEmailVerificationMachine({
    enabled: emailVerificationEnabled,
    communityId: selectedOrgId || null,
    draft: persisted.verificationDraft,
    onDraftChange: updateVerificationDraft,
    api: onboardingVerificationApi,
    adapter: onboardingVerificationAdapter,
    initialPreferredState:
      currentStep === "email_verification_enter_code" ? "enter_code" : "enter_email",
    defaultCooldownSeconds: 60,
    onDone: () => {
      showOnboardingSuccess("Email verification complete.");
    },
  });

  useEffect(() => {
    if (!emailVerificationEnabled) return;
    let nextStep: OnboardingFlowStep | null = null;
    if (
      emailVerificationMachine.state === "loading_domains" ||
      emailVerificationMachine.state === "domains_error" ||
      emailVerificationMachine.state === "enter_email" ||
      emailVerificationMachine.state === "sending_code" ||
      emailVerificationMachine.state === "enter_email_error"
    ) {
      nextStep = "email_verification_enter_email";
    } else if (
      emailVerificationMachine.state === "enter_code" ||
      emailVerificationMachine.state === "verifying_code" ||
      emailVerificationMachine.state === "enter_code_error" ||
      emailVerificationMachine.state === "verified_local"
    ) {
      nextStep = "email_verification_enter_code";
    }

    if (!nextStep) return;
    if (persisted.latestStep !== nextStep) {
      savePersisted({ latestStep: nextStep });
    }
    if (currentStep !== nextStep) {
      setManualStepOverride(nextStep);
    }
  }, [
    currentStep,
    emailVerificationEnabled,
    emailVerificationMachine.state,
    persisted.latestStep,
    savePersisted,
  ]);

  if (status === "loading" || status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shell-bg px-4 text-sm text-text-secondary">
        Loading onboarding...
      </div>
    );
  }

  if (accessState !== "signed_in_blocked" && accessState !== "active") {
    return null;
  }

  const illustration = getStepIllustration(currentStep);
  const isEmailVerificationStep =
    currentStep === "email_verification_enter_email" || currentStep === "email_verification_enter_code";
  const isSpecializationStep = currentStep === "specialization_selection";
  const canBack =
    canGoBackFromStep(currentStep) &&
    !transitionLock &&
    (!isEmailVerificationStep || !emailVerificationMachine.transitionLocked);
  const showCornerSkip =
    (currentStep === "verification_intro" ||
      currentStep === "verification_choice" ||
      currentStep === "email_verification_enter_email" ||
      currentStep === "email_verification_enter_code") &&
    !transitionLock &&
    (!isEmailVerificationStep || !emailVerificationMachine.transitionLocked);
  const showStepIllustration =
    currentStep !== "org_selection" &&
    currentStep !== "verification_intro" &&
    currentStep !== "verification_choice" &&
    !isSpecializationStep &&
    !isEmailVerificationStep;
  const showInlineMobileIllustration = showStepIllustration && currentStep !== "verification_info";
  const centerStepHeader = currentStep === "org_selection" || isEmailVerificationStep || isSpecializationStep;
  const contentColumnClassName = "space-y-4";
  const profileContinueEnabled =
    validateProfileDraft(persisted.profileDraft) === null &&
    usernameStatus !== "checking" &&
    usernameStatus !== "taken" &&
    usernameStatus !== "invalid";
  const orgContinueEnabled = Boolean(selectedCommunity);
  const orgContinueVisible = orgContinueEnabled && !isOrgSearchFocused;
  const showOrgLoadingState = isCommunityLoading && visibleCommunities.length === 0;
  const showOrgStartTypingState =
    !isCommunityLoading &&
    !orgSearchError &&
    activeOrgQuery.length === 0 &&
    visibleCommunities.length === 0;
  const showOrgNoMatchesState =
    !isCommunityLoading &&
    !orgSearchError &&
    activeOrgQuery.length > 0 &&
    visibleCommunities.length === 0;
  const showRequestCommunityCta = showOrgNoMatchesState;
  const showSpecializationLoadingState = specializationLoading && specializationOptions.length === 0;
  const showSpecializationStartTypingState =
    !specializationLoading &&
    !specializationSearchError &&
    activeSpecializationQuery.length === 0 &&
    specializationOptions.length === 0;
  const showSpecializationNoMatchesState =
    !specializationLoading &&
    !specializationSearchError &&
    activeSpecializationQuery.length > 0 &&
    specializationOptions.length === 0;
  const specializationContinueEnabled =
    persisted.specializationDraft.selectedIds.filter((entry) => entry.length > 0).length > 0;
  const stepTitle =
    currentStep === "org_selection"
      ? "Search for your workplace"
      : currentStep === "profile_setup"
        ? "Create your profile"
      : currentStep === "specialization_selection"
        ? specializationTitle
      : currentStep === "skip_explainer"
        ? "You skipped verification"
      : currentStep === "verification_confirmation"
        ? "You're verified!"
      : currentStep === "email_verification_enter_email" || currentStep === "email_verification_enter_code"
        ? "Verify Your Email"
      : (STEP_LABELS[currentStep] ?? STEP_LABELS.profile_setup);

  return (
    <div className="min-h-screen bg-shell-bg px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <Logo to="/" imageClassName="h-12 w-auto md:h-14" />
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-full border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            Sign out
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-4 md:p-6">
          <div className="mb-5 space-y-2">
            <div className="h-2 w-full rounded-full bg-bg-muted">
              <div
                className="h-2 rounded-full bg-brand transition-[width] duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary">
              Step {Math.min(progressCount, progressTotal)}
            </p>
          </div>

          <div className={`grid gap-6 ${showStepIllustration ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
            <div className={contentColumnClassName}>
              {canBack || showCornerSkip ? (
                <div className="flex items-center justify-between">
                  {canBack ? (
                    <OnboardingBackButton
                      onClick={() => {
                        if (currentStep === "email_verification_enter_code") {
                          emailVerificationMachine.resetToEmailEntry();
                        }
                        handleBack();
                      }}
                      disabled={transitionLock}
                    />
                  ) : (
                    <div className="h-10 w-10" />
                  )}
                  {showCornerSkip ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleSelectVerificationPath("skip");
                      }}
                      disabled={transitionLock || (isEmailVerificationStep && emailVerificationMachine.transitionLocked)}
                      className="inline-flex h-10 items-center rounded-full bg-bg-muted px-4 text-sm font-medium text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Skip
                    </button>
                  ) : null}
                </div>
              ) : null}

              {currentStep !== "verification_info" && currentStep !== "verification_intro" ? (
                <div
                  className={
                    currentStep === "org_selection"
                      ? "mx-auto w-full max-w-2xl"
                      : currentStep === "specialization_selection"
                        ? "mx-auto w-full max-w-[640px]"
                      : isEmailVerificationStep
                        ? "mx-auto w-full max-w-[640px]"
                        : ""
                  }
                >
                  <h1
                    className={`mt-1 text-2xl font-semibold text-strong md:text-3xl ${centerStepHeader ? "text-center" : ""}`}
                  >
                    {stepTitle}
                  </h1>
                  {currentStep === "org_selection" ? (
                    <p className="mt-2 text-center text-sm leading-6 text-text-secondary">
                      If you're in multiple workplaces, choose one for now. You can verify others later.
                    </p>
                  ) : null}
                  {currentStep === "specialization_selection" ? (
                    <p className="mt-2 text-center text-sm leading-6 text-text-secondary">
                      Select up to 2 fields to join now.
                    </p>
                  ) : null}
                  {currentStep === "org_selection" ? (
                    <div className="mt-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowOrgChoiceInfo(true)}
                        className="inline-flex items-center gap-1 text-sm text-text-secondary transition hover:text-strong"
                      >
                        <InfoIcon className="h-4 w-4" />
                        <span>More info</span>
                      </button>
                    </div>
                  ) : null}
                  {currentStep === "specialization_selection" ? (
                    <div className="mt-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowSpecializationInfo(true)}
                        className="inline-flex items-center gap-1 text-sm text-text-secondary transition hover:text-strong"
                      >
                        <InfoIcon className="h-4 w-4" />
                        <span>More info</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showInlineMobileIllustration ? (
                <div className="flex justify-center lg:hidden">
                  <img
                    src={illustration}
                    alt=""
                    className="w-full max-w-[260px] object-contain sm:max-w-[300px]"
                    loading="lazy"
                  />
                </div>
              ) : null}

              {currentStep === "unsupported_web_stage" ? (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    This verification method is not available on web. We attempted to switch you to email verification.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFallbackAttempted(false);
                        setStepError(null);
                      }}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
                    >
                      Retry
                    </button>
                    <Link
                      to="/contact"
                      className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Contact support
                    </Link>
                  </div>
                </div>
              ) : null}

              {currentStep === "profile_setup" ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary">Choose a username and tell us a little about you.</p>

                  <div className="space-y-1">
                    <label htmlFor="onboarding-username" className="text-sm font-semibold text-text-secondary">Username</label>
                    <input
                      id="onboarding-username"
                      type="text"
                      value={persisted.profileDraft.username}
                      onChange={(event) =>
                        savePersisted({
                          profileDraft: {
                            ...persisted.profileDraft,
                            username: sanitizeUsername(event.target.value),
                          },
                        })
                      }
                      className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {usernameMessage ? (
                      <p
                        className={`text-xs ${
                          usernameStatus === "available"
                            ? "text-green-600"
                            : usernameStatus === "checking"
                              ? "text-text-light"
                              : "text-brand"
                        }`}
                      >
                        {usernameMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="onboarding-first-name" className="text-sm font-semibold text-text-secondary">First Name</label>
                      <input
                        id="onboarding-first-name"
                        type="text"
                        value={persisted.profileDraft.firstName}
                        onChange={(event) =>
                          savePersisted({
                            profileDraft: {
                              ...persisted.profileDraft,
                              firstName: event.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="onboarding-last-name" className="text-sm font-semibold text-text-secondary">Last Name</label>
                      <input
                        id="onboarding-last-name"
                        type="text"
                        value={persisted.profileDraft.lastName}
                        onChange={(event) =>
                          savePersisted({
                            profileDraft: {
                              ...persisted.profileDraft,
                              lastName: event.target.value,
                            },
                          })
                        }
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="onboarding-dob" className="text-sm font-semibold text-text-secondary">Date of Birth</label>
                    <input
                      id="onboarding-dob"
                      type="date"
                      value={persisted.profileDraft.dateOfBirth}
                      onChange={(event) =>
                        savePersisted({
                          profileDraft: {
                            ...persisted.profileDraft,
                            dateOfBirth: event.target.value,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  <OnboardingContinueButton
                    label="Continue"
                    loadingLabel="Saving..."
                    onClick={handleProfileSubmit}
                    isEnabled={profileContinueEnabled}
                    isLoading={transitionLock}
                    variant="primary"
                    behavior="disabled"
                    className="w-full"
                  />

                  <p className="pt-2 text-center text-sm text-text-secondary">
                    By signing up, you agree to our{" "}
                    <Link
                      to="/privacy-policy"
                      className="text-secondary font-normal underline underline-offset-2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/terms"
                      className="text-secondary font-normal underline underline-offset-2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      User Agreement
                    </Link>
                    .
                  </p>
                </div>
              ) : null}

              {currentStep === "verification_info" ? (
                <VerificationInfoContent
                  mode="onboarding"
                  isBusy={transitionLock}
                  onContinue={() => {
                    void handleVerificationInfoContinue();
                  }}
                />
              ) : null}

              {currentStep === "org_selection" ? (
                <div className="mx-auto w-full max-w-2xl space-y-4">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onFocus={() => setIsOrgSearchFocused(true)}
                      onBlur={() => setIsOrgSearchFocused(false)}
                      placeholder="Search"
                      className="w-full rounded-full border border-border bg-bg-muted pl-12 pr-4 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  {showOrgLoadingState ? <p className="text-sm text-text-light">Loading organizations...</p> : null}
                  {showOrgStartTypingState ? <p className="text-sm text-text-light">Start typing to search.</p> : null}
                  {showOrgNoMatchesState ? (
                    <div className="space-y-1 pb-0.5 text-center">
                      <p className="text-sm text-text-secondary">No matches found.</p>
                      <p className="text-sm font-medium text-text-secondary">Don&apos;t see your community?</p>
                      <p className="text-sm text-text-light">No worries. Request it here and we&apos;ll be on it.</p>
                    </div>
                  ) : null}
                  {orgSearchError ? (
                    <div className="rounded-xl border border-border bg-bg-muted/40 p-3">
                      <p className="text-sm text-brand">{orgSearchError}</p>
                      <button
                        type="button"
                        onClick={() => setOrgSearchRefreshNonce((previous) => previous + 1)}
                        className="mt-2 text-sm font-semibold text-secondary transition hover:opacity-90"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {visibleCommunities.map((community) => {
                      const selected = selectedCommunity?.id === community.id;
                      return (
                        <button
                          key={community.id}
                          type="button"
                          onClick={() =>
                            savePersisted({
                              orgDraft: {
                                orgId: community.id,
                                orgName: community.name ?? community.shortName ?? "",
                                orgKind: "company",
                              },
                            })
                          }
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selected ? "border-brand bg-bg" : "border-border bg-bg hover:border-brand/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-full border border-border bg-bg-muted">
                              <img
                                src={community.imageUrl ?? DEFAULT_PROFILE_IMAGE_SRC}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.src = DEFAULT_PROFILE_IMAGE_SRC;
                                }}
                              />
                            </div>
                            <p className="flex-1 text-sm font-semibold text-strong">{community.shortName ?? community.name}</p>
                            {selected ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                                <CheckIcon className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <OnboardingContinueButton
                      label="Continue"
                      loadingLabel="Continuing..."
                      onClick={handleOrgContinue}
                      isEnabled={orgContinueVisible}
                      isLoading={transitionLock}
                      variant="primary"
                      behavior="hiddenUntilValid"
                      className="w-full"
                    />

                    {showRequestCommunityCta ? (
                      <div className="text-center">
                        <button
                          type="button"
                          disabled={transitionLock}
                          onClick={() => setShowCommunityRequestFlow(true)}
                          className="inline-flex h-10 w-full max-w-[360px] items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-brand">
                            <PlusIcon className="h-3 w-3" />
                          </span>
                          Request your community
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_intro" ? (
                <div className="mx-auto w-full max-w-5xl">
                  <div className="grid items-center gap-8 md:grid-cols-[minmax(220px,340px)_1fr]">
                    <div className="flex justify-center md:justify-start">
                      <img
                        src={verifyFirstIllustration}
                        alt=""
                        className="w-full max-w-[320px] object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                      <h2 className="text-2xl font-semibold leading-tight text-strong md:text-3xl">
                        Verify your identity for {selectedOrgLabel}
                      </h2>
                      <p className="mx-auto max-w-lg text-sm leading-7 text-text-secondary md:mx-0">
                        We require verification to post, comment, and like in communities to keep your experience authentic.
                      </p>
                      <div className="mx-auto w-full max-w-sm space-y-3 md:mx-0">
                        <OnboardingContinueButton
                          label="Continue"
                          loadingLabel="Continuing..."
                          onClick={() => {
                            handleVerificationIntroContinue();
                          }}
                          isLoading={transitionLock}
                          variant="primary"
                          className="w-full"
                        />
                        <button
                          type="button"
                          onClick={() => setShowVerificationHowItWorks(true)}
                          className="w-full text-center text-secondary underline underline-offset-2 transition hover:text-strong"
                        >
                          How Verification Works
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_choice" ? (
                <div className="space-y-5">
                  <div className="max-w-3xl space-y-2">
                    <p className="text-base font-medium text-strong">Web currently supports email verification only.</p>
                    <p className="text-base leading-7 text-text-secondary">
                      If you want to verify with photo ID, download Looped on iOS. We&apos;re working on bringing photo ID
                      verification to web.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <OnboardingContinueButton
                      label="Continue"
                      loadingLabel="Continuing..."
                      onClick={() => {
                        void handleSelectVerificationPath("email");
                      }}
                      isLoading={transitionLock}
                      variant="primary"
                    />
                  </div>
                </div>
              ) : null}

              {currentStep === "email_verification_enter_email" || currentStep === "email_verification_enter_code" ? (
                <div className="mx-auto w-full max-w-[640px]">
                  <VerificationEmailFlow
                    state={emailVerificationMachine.state}
                    communityName={selectedCommunity?.name ?? "organization"}
                    draft={persisted.verificationDraft}
                    domains={emailVerificationMachine.domains}
                    errorMessage={emailVerificationMachine.errorMessage}
                    resendHelperText={emailVerificationMachine.resendHelperText}
                  canSendCode={emailVerificationMachine.canSendCode}
                  canVerifyCode={emailVerificationMachine.canVerifyCode}
                  canResendCode={emailVerificationMachine.canResendCode}
                  transitionLocked={emailVerificationMachine.transitionLocked}
                  overlayTitle={emailVerificationMachine.overlayTitle}
                  onEmailLocalPartChange={emailVerificationMachine.setEmailLocalPart}
                  onDomainChange={emailVerificationMachine.setSelectedDomain}
                  onCodeChange={emailVerificationMachine.setCode}
                  onSendCode={() => {
                      void emailVerificationMachine.sendCode();
                    }}
                    onVerifyCode={() => {
                      void emailVerificationMachine.verifyCode();
                    }}
                    onResendCode={() => {
                      void emailVerificationMachine.resendCode();
                    }}
                    onRetryDomains={() => {
                      void emailVerificationMachine.retryDomains();
                    }}
                  />
                </div>
              ) : null}

              {currentStep === "specialization_selection" ? (
                <div className="mx-auto w-full max-w-[640px] space-y-4">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
                    <input
                      type="search"
                      value={specializationQuery}
                      onChange={(event) => {
                        setSpecializationQuery(event.target.value);
                        if (specializationSelectionError) {
                          setSpecializationSelectionError(null);
                        }
                      }}
                      placeholder="Search"
                      className="w-full rounded-full border border-border bg-bg-muted pl-12 pr-4 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  {showSpecializationLoadingState ? (
                    <p className="text-sm text-text-light">Loading {specializationTitle.toLowerCase()}s...</p>
                  ) : null}
                  {showSpecializationStartTypingState ? (
                    <p className="text-sm text-text-light">Start typing to search.</p>
                  ) : null}
                  {showSpecializationNoMatchesState ? <p className="text-sm text-text-light">No matches found.</p> : null}

                  {specializationSearchError ? (
                    <div className="rounded-xl border border-border bg-bg-muted/40 p-3">
                      <p className="text-sm text-brand">{specializationSearchError}</p>
                      <button
                        type="button"
                        onClick={() => setSpecializationSearchRefreshNonce((previous) => previous + 1)}
                        className="mt-2 text-sm font-semibold text-secondary transition hover:opacity-90"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}

                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {specializationOptions.map((option) => {
                      const selectedIndex = persisted.specializationDraft.selectedIds.indexOf(option.id);
                      const selected = selectedIndex >= 0;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleSpecialization(option.id)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selected ? "border-brand bg-bg" : "border-border bg-bg hover:border-brand/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-strong">{option.name}</p>
                            {selected ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                                {selectedIndex + 1}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {specializationSelectionError ? (
                    <p className="text-sm text-brand">{specializationSelectionError}</p>
                  ) : null}
                  <OnboardingContinueButton
                    label="Continue"
                    loadingLabel="Continuing..."
                    onClick={() => {
                      void handleSpecializationContinue();
                    }}
                    isEnabled={specializationContinueEnabled}
                    isLoading={transitionLock}
                    variant="primary"
                    behavior="hiddenUntilValid"
                    className="w-full"
                  />
                </div>
              ) : null}

              {currentStep === "skip_explainer" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    You can verify later anytime in settings or on a community page. You can post, like, and comment
                    only in communities where you're verified.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <OnboardingContinueButton
                      label="Continue"
                      loadingLabel="Continuing..."
                      onClick={() => {
                        void handleSkipContinue();
                      }}
                      isLoading={transitionLock}
                      variant="primary"
                    />
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_confirmation" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    You're verified for {selectedOrgLabel}. Your field is joined. Start posting.
                  </p>
                  <OnboardingContinueButton
                    label="Continue"
                    loadingLabel="Continuing..."
                    onClick={() => {
                      void handleFinalizeContinue();
                    }}
                    isLoading={transitionLock}
                    variant="primary"
                    className="w-full max-w-xs"
                  />
                </div>
              ) : null}

              {currentStep === "completed" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    Onboarding complete. Continue to your app feed.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (uid) clearPersistedOnboardingState(uid);
                      navigate("/app", { replace: true });
                    }}
                    className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
                  >
                    Go to app
                  </button>
                </div>
              ) : null}

              {profileCompletionPrompt && currentStep === "completed" ? (
                <div className="space-y-3 rounded-xl border border-border bg-bg-muted p-4">
                  <p className="text-sm font-semibold text-strong">Finish setting up your profile</p>
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative h-24 w-24 overflow-visible rounded-full"
                      aria-label="Change profile photo"
                      disabled={transitionLock}
                    >
                      <span className="block h-24 w-24 overflow-hidden rounded-full bg-bg-muted">
                        <img
                          src={effectiveFinishAvatarSrc}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={handleFinishAvatarImageError}
                        />
                      </span>
                      <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow">
                        <CameraIcon className="h-[18px] w-[18px]" />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 text-[1.1rem] font-semibold text-secondary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={transitionLock}
                    >
                      Tap to change profile photo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleFinishPhotoPicked}
                    />
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Bio</span>
                    <textarea
                      value={finishBio}
                      onChange={(event) => setFinishBio(event.target.value.slice(0, 240))}
                      rows={4}
                      className="w-full resize-y rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={saveFinishProfile}
                      className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Save profile
                    </button>
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={skipFinishProfile}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {showStepIllustration ? (
              <div className="hidden items-start justify-center lg:flex">
                <img
                  src={illustration}
                  alt=""
                  className="w-full max-w-md object-contain"
                  loading="lazy"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {showCommunityRequestFlow && currentStep === "org_selection" ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:items-center sm:p-6">
          <div className="h-[min(92vh,760px)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-bg p-4 shadow-xl sm:p-6">
            <CommunityRequestFlow
              mode="onboarding"
              initialName={activeOrgQuery}
              onClose={() => setShowCommunityRequestFlow(false)}
              onCompleteOnboardingAfterSubmit={handleCompleteAfterCommunityRequestFlow}
              mapOnboardingCompletionError={mapCommunityRequestCompletionError}
            />
          </div>
        </div>
      ) : null}
      <AvatarCropModal
        open={Boolean(finishCropSourceUrl)}
        imageSrc={finishCropSourceUrl}
        title="Adjust profile photo"
        isApplying={isApplyingFinishCrop}
        onCancel={handleCancelFinishCrop}
        onApply={handleApplyFinishCrop}
      />
      {showOrgChoiceInfo && currentStep === "org_selection" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-5 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setShowOrgChoiceInfo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-choice-info-title"
            className="w-full max-w-[320px] rounded-[28px] bg-bg p-6 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="org-choice-info-title" className="text-[1.55rem] font-semibold text-strong">
              About your choice
            </h3>
            <p className="mt-3 text-[1.1rem] leading-7 text-text-secondary">
              You can only post in communities where you're verified. We'll ask you to verify next, so choose one
              where you can verify with a work email or ID/badge.
            </p>
            <button
              type="button"
              onClick={() => setShowOrgChoiceInfo(false)}
              className="mt-5 w-full rounded-full bg-bg-muted px-5 py-2.5 text-[1.18rem] font-semibold text-strong transition hover:bg-bg-muted/90"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
      {showSpecializationInfo && currentStep === "specialization_selection" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-5 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setShowSpecializationInfo(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="specialization-info-title"
            className="w-full max-w-[320px] rounded-[28px] bg-bg p-6 shadow-[0_20px_48px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="specialization-info-title" className="text-[1.55rem] font-semibold text-strong">
              About your selection
            </h3>
            <p className="mt-3 text-[1.1rem] leading-7 text-text-secondary">
              Pick up to 2 fields to join now. Your first selection is your primary field for onboarding.
            </p>
            <button
              type="button"
              onClick={() => setShowSpecializationInfo(false)}
              className="mt-5 w-full rounded-full bg-bg-muted px-5 py-2.5 text-[1.18rem] font-semibold text-strong transition hover:bg-bg-muted/90"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
      {showVerificationHowItWorks && currentStep === "verification_intro" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6"
          role="presentation"
          onClick={() => setShowVerificationHowItWorks(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-3xl rounded-2xl border border-border bg-bg p-4 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <VerificationInfoContent
              mode="modal"
              onClose={() => setShowVerificationHowItWorks(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
