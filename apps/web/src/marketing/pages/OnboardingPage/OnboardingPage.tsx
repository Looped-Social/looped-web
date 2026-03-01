import { type ChangeEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { Logo } from "@looped/ui";

import { CameraIcon } from "@/app/components/AppIcons/AppIcons";
import { AvatarCropModal } from "@/app/components/AvatarCropModal/AvatarCropModal";
import authEntryIllustration from "@/assets/illustrations/onboarding/auth-entry.svg";
import emailVerificationIllustration from "@/assets/illustrations/onboarding/email-verification.svg";
import finishProfileIllustration from "@/assets/illustrations/onboarding/finish-profile.svg";
import orgSelectionIllustration from "@/assets/illustrations/onboarding/org-selection.svg";
import profileSetupIllustration from "@/assets/illustrations/onboarding/profile-setup.svg";
import specializationIllustration from "@/assets/illustrations/onboarding/specialization-selection.svg";
import verificationConfirmationIllustration from "@/assets/illustrations/onboarding/verification-confirmation.svg";
import verificationInfoIllustration from "@/assets/illustrations/onboarding/verification-info.svg";
import { useUserSession } from "@/hooks/useUserSession";
import {
  dismissProfileCompletionPrompt,
  acknowledgeSkipExplainer,
  checkUsernameAvailability,
  completeAfterCommunityRequest,
  finishCommunityEmailVerification,
  fetchCommunityVerificationDomains,
  fetchFieldsForOnboarding,
  fetchMajorsForOnboarding,
  fetchRecommendedOnboardingCommunities,
  finalizeOnboarding,
  followOnboardingCommunity,
  joinSpecialization,
  markOnboardingEmailVerificationSuccess,
  markOnboardingInfoScreenViewed,
  OnboardingApiError,
  saveProfileCompletionDraft,
  searchOnboardingCommunities,
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
import {
  clearPersistedOnboardingState,
  defaultPersistedOnboardingState,
  loadPersistedOnboardingState,
  savePersistedOnboardingState,
  type PersistedOnboardingState,
} from "@/lib/onboardingStorage";

const SEARCH_DEBOUNCE_MS = 280;
const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";
const LOCKED_TRANSITION_STEPS = new Set<OnboardingFlowStep>([
  "profile_setup",
  "specialization_selection",
  "verification_confirmation",
]);

const RENDER_STEPS: OnboardingFlowStep[] = [
  "profile_setup",
  "verification_info",
  "org_selection",
  "verification_intro",
  "verification_choice",
  "email_verification_enter_email",
  "email_verification_enter_code",
  "specialization_selection",
  "skip_explainer",
  "verification_confirmation",
  "completed",
];

const STEP_LABELS: Record<OnboardingFlowStep, string> = {
  profile_setup: "Profile",
  verification_info: "Info",
  org_selection: "Organization",
  verification_intro: "Verification",
  verification_choice: "Method",
  email_verification_enter_email: "Email",
  email_verification_enter_code: "Code",
  specialization_selection: "Specialization",
  skip_explainer: "Review",
  verification_confirmation: "Finalize",
  completed: "Done",
  unsupported_web_stage: "Unsupported",
};

function isVerificationStep(step: OnboardingFlowStep): boolean {
  return (
    step === "verification_intro" ||
    step === "verification_choice" ||
    step === "email_verification_enter_email" ||
    step === "email_verification_enter_code" ||
    step === "skip_explainer"
  );
}

function normalizeCommunityKind(value: string | null | undefined): CommunityKind {
  return value === "school" ? "school" : "company";
}

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
}

function validateProfileDraft(draft: PersistedOnboardingState["profileDraft"]): string | null {
  if (!draft.username) return "Choose a username.";
  if (!/^[a-z0-9_]{3,30}$/.test(draft.username)) {
    return "Username must be 3-30 characters and use lowercase letters, numbers, or underscores.";
  }
  if (!draft.firstName.trim()) return "First name is required.";
  if (!draft.lastName.trim()) return "Last name is required.";
  if (!draft.dateOfBirth) return "Date of birth is required.";
  return null;
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
        return "Use an approved school or company email domain.";
      case "invalid_code":
        return "That code is invalid. Try again.";
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
        return "Your onboarding state changed. We refreshed your latest step.";
      default:
        return error.message || "Something went wrong. Please try again.";
    }
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function getStepIllustration(step: OnboardingFlowStep): string {
  if (step === "profile_setup") return profileSetupIllustration;
  if (step === "verification_info") return verificationInfoIllustration;
  if (step === "org_selection") return orgSelectionIllustration;
  if (isVerificationStep(step)) return emailVerificationIllustration;
  if (step === "specialization_selection") return specializationIllustration;
  if (step === "verification_confirmation" || step === "completed") return verificationConfirmationIllustration;
  if (step === "unsupported_web_stage") return authEntryIllustration;
  return finishProfileIllustration;
}

function nextBackStep(step: OnboardingFlowStep): OnboardingFlowStep | null {
  if (step === "verification_info") return "profile_setup";
  if (step === "org_selection") return "verification_info";
  if (step === "verification_intro") return "org_selection";
  if (step === "verification_choice") return "verification_intro";
  if (step === "email_verification_enter_email" || step === "email_verification_enter_code") return "verification_choice";
  if (step === "skip_explainer") return "verification_intro";
  return null;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { status, accessState, user, bootstrap, signOut, refreshSession } = useUserSession();
  const uid = user?.uid ?? null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [persisted, setPersisted] = useState<PersistedOnboardingState>(defaultPersistedOnboardingState());
  const [transitionLock, setTransitionLock] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [manualStepOverride, setManualStepOverride] = useState<OnboardingFlowStep | null>(null);
  const [photoFallbackAttempted, setPhotoFallbackAttempted] = useState(false);

  const [usernameCheckState, setUsernameCheckState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [orgKind, setOrgKind] = useState<CommunityKind>("company");
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendedCommunities, setRecommendedCommunities] = useState<CommunityOption[]>([]);
  const [searchedCommunities, setSearchedCommunities] = useState<CommunityOption[]>([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [isDomainsLoading, setIsDomainsLoading] = useState(false);
  const [specializationOptions, setSpecializationOptions] = useState<SpecializationOption[]>([]);
  const [specializationLoading, setSpecializationLoading] = useState(false);
  const [finishBio, setFinishBio] = useState("");
  const [finishPhotoFile, setFinishPhotoFile] = useState<File | null>(null);
  const [finishPhotoPreviewUrl, setFinishPhotoPreviewUrl] = useState<string | null>(null);
  const [finishCropSourceUrl, setFinishCropSourceUrl] = useState<string | null>(null);
  const [isApplyingFinishCrop, setIsApplyingFinishCrop] = useState(false);

  const profileCompletionPrompt = Boolean(bootstrap?.profileCompletion?.shouldPrompt);
  const hasPendingVerificationCode = Boolean(persisted.verificationDraft.submittedEmail);
  const resolvedStep = resolveOnboardingStep({
    bootstrap,
    localStep: persisted.latestStep,
    hasPendingVerificationCode,
  });
  const currentStep = manualStepOverride ?? resolvedStep;
  const selectedOrgId = bootstrap?.onboardingContext.selectedOrgId ?? persisted.orgDraft?.orgId ?? "";
  const selectedOrgKind = normalizeCommunityKind(
    bootstrap?.onboardingContext.selectedOrgKind ?? persisted.orgDraft?.orgKind ?? orgKind
  );
  const selectedCommunity =
    [...recommendedCommunities, ...searchedCommunities].find((entry) => entry.id === selectedOrgId) ??
    (selectedOrgId
      ? {
          id: selectedOrgId,
          kind: selectedOrgKind,
          name: persisted.orgDraft?.orgName || "Selected organization",
        }
      : null);

  const progressSteps = RENDER_STEPS.filter((step) => step !== "completed");
  const currentStepIndex = progressSteps.findIndex((step) => step === currentStep);
  const progressCount = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const bootstrapUser = bootstrap?.user;
  const bootstrapBio = typeof bootstrapUser?.bio === "string" ? bootstrapUser.bio : "";
  const bootstrapAvatarUrl =
    typeof bootstrapUser?.profile_image_url === "string"
      ? bootstrapUser.profile_image_url
      : typeof bootstrapUser?.profileImageUrl === "string"
        ? bootstrapUser.profileImageUrl
        : null;
  const effectiveFinishAvatarSrc =
    finishPhotoPreviewUrl ?? bootstrapAvatarUrl ?? user?.photoURL ?? DEFAULT_PROFILE_IMAGE_SRC;

  const savePersisted = (next: Partial<PersistedOnboardingState>) => {
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
    const saved = savePersistedOnboardingState(uid, next);
    setPersisted(saved);
  };

  useEffect(() => {
    if (!uid) {
      setPersisted(defaultPersistedOnboardingState());
      return;
    }
    setPersisted(loadPersistedOnboardingState(uid));
  }, [uid]);

  useEffect(() => {
    if (!selectedOrgId) return;
    if (persisted.orgDraft?.orgId === selectedOrgId) return;
    savePersisted({
      orgDraft: {
        orgId: selectedOrgId,
        orgName: persisted.orgDraft?.orgName || selectedCommunity?.name || "Selected organization",
        orgKind: selectedOrgKind,
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
    if (currentStep !== "profile_setup") return;
    const username = persisted.profileDraft.username.trim();
    if (!username) {
      setUsernameCheckState("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setUsernameCheckState("invalid");
      return;
    }

    setUsernameCheckState("checking");
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(username)
        .then((response) => {
          setUsernameCheckState(response.available || response.ownedByMe ? "available" : "taken");
        })
        .catch(() => {
          setUsernameCheckState("idle");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currentStep, persisted.profileDraft.username]);

  useEffect(() => {
    if (currentStep !== "org_selection") return;
    setIsCommunityLoading(true);
    setStepError(null);
    void fetchRecommendedOnboardingCommunities({ kind: orgKind })
      .then((items) => {
        setRecommendedCommunities(items);
      })
      .catch((error) => {
        setStepError(mapOnboardingError(error));
      })
      .finally(() => setIsCommunityLoading(false));
  }, [currentStep, orgKind]);

  useEffect(() => {
    if (currentStep !== "org_selection") return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchedCommunities([]);
      return;
    }
    setIsCommunityLoading(true);
    const timer = window.setTimeout(() => {
      void searchOnboardingCommunities({ query, kind: orgKind })
        .then((items) => {
          setSearchedCommunities(items);
        })
        .catch((error) => {
          setStepError(mapOnboardingError(error));
        })
        .finally(() => setIsCommunityLoading(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currentStep, orgKind, searchQuery]);

  useEffect(() => {
    if (currentStep !== "email_verification_enter_email" && currentStep !== "email_verification_enter_code") return;
    if (!selectedOrgId) return;
    setIsDomainsLoading(true);
    void fetchCommunityVerificationDomains(selectedOrgId)
      .then((items) => {
        setAllowedDomains(items);
        if (!persisted.verificationDraft.selectedDomain && items[0]) {
          savePersisted({
            verificationDraft: { ...persisted.verificationDraft, selectedDomain: items[0] },
          });
        }
      })
      .catch((error) => {
        setStepError(mapOnboardingError(error));
      })
      .finally(() => setIsDomainsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, selectedOrgId]);

  useEffect(() => {
    if (currentStep !== "specialization_selection") return;
    setSpecializationLoading(true);
    const loader =
      selectedOrgKind === "school" ? fetchMajorsForOnboarding : fetchFieldsForOnboarding;

    void loader()
      .then((items) => {
        setSpecializationOptions(items);
      })
      .catch((error) => {
        setStepError(mapOnboardingError(error));
      })
      .finally(() => setSpecializationLoading(false));
  }, [currentStep, selectedOrgKind]);

  useEffect(() => {
    if (!manualStepOverride) return;
    if (!canGoBackFromStep(resolvedStep)) {
      setManualStepOverride(null);
      return;
    }
    if (resolvedStep === "completed" || resolvedStep === "verification_confirmation" || resolvedStep === "specialization_selection") {
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
        setStepError(mapOnboardingError(error));
      })
      .finally(() => setTransitionLock(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, photoFallbackAttempted, refreshSession]);

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
      setStepError("Please select an image file.");
      return;
    }

    setStepError(null);
    setFinishCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }, []);

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
      setStepNotice(null);
    }
  };

  const handleBack = () => {
    if (!canGoBackFromStep(currentStep) || transitionLock) return;
    const step = nextBackStep(currentStep);
    if (!step) return;
    setManualStepOverride(step);
    savePersisted({ latestStep: step });
  };

  const handleProfileSubmit = async () => {
    const validationError = validateProfileDraft(persisted.profileDraft);
    if (validationError) {
      setStepError(validationError);
      return;
    }
    if (usernameCheckState === "taken") {
      setStepError("That username is taken.");
      return;
    }
    if (usernameCheckState === "invalid") {
      setStepError("Username format is invalid.");
      return;
    }

    setBusy(true);
    try {
      await submitOnboardingProfile({
        username: persisted.profileDraft.username,
        firstName: persisted.profileDraft.firstName.trim(),
        lastName: persisted.profileDraft.lastName.trim(),
        dateOfBirth: persisted.profileDraft.dateOfBirth,
      });
      await refreshSession();
      savePersisted({ latestStep: "verification_info" });
    } catch (error) {
      if (error instanceof OnboardingApiError && error.code === "already_onboarded") {
        await refreshSession();
        savePersisted({ latestStep: "verification_info" });
      } else {
        setStepError(mapOnboardingError(error));
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
    } catch (error) {
      if (error instanceof OnboardingApiError && error.code === "invalid_stage") {
        await refreshSession();
        savePersisted({ latestStep: "org_selection" });
      } else {
        setStepError(mapOnboardingError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOrgContinue = async () => {
    if (!selectedCommunity) {
      setStepError("Select an organization to continue.");
      return;
    }
    setBusy(true);
    try {
      await setOnboardingOrg(selectedCommunity.id);
      try {
        await followOnboardingCommunity(selectedCommunity.id);
      } catch {
        // best effort
      }
      await refreshSession();
      savePersisted({
        orgDraft: {
          orgId: selectedCommunity.id,
          orgName: selectedCommunity.shortName ?? selectedCommunity.name,
          orgKind: selectedCommunity.kind,
        },
        latestStep: "verification_intro",
      });
      setManualStepOverride("verification_intro");
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectVerificationPath = async (path: "email" | "skip") => {
    setBusy(true);
    try {
      await setOnboardingVerificationChoice(path);
      await refreshSession();
      if (path === "skip") {
        savePersisted({ latestStep: "skip_explainer" });
        setManualStepOverride("skip_explainer");
      } else {
        savePersisted({ latestStep: "email_verification_enter_email" });
        setManualStepOverride("email_verification_enter_email");
      }
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!selectedOrgId) {
      setStepError("Select an organization first.");
      return;
    }
    const localPart = persisted.verificationDraft.emailLocalPart.trim();
    const domain = persisted.verificationDraft.selectedDomain.trim();
    if (!localPart || !domain) {
      setStepError("Enter your work or school email.");
      return;
    }

    const email = `${localPart}@${domain}`;
    setBusy(true);
    try {
      await startCommunityEmailVerification({
        communityId: selectedOrgId,
        email,
      });
      savePersisted({
        verificationDraft: {
          ...persisted.verificationDraft,
          submittedEmail: email,
          pendingCode: "",
        },
        latestStep: "email_verification_enter_code",
      });
      setManualStepOverride("email_verification_enter_code");
      setStepNotice("Verification code sent. Check your inbox.");
    } catch (error) {
      if (error instanceof OnboardingApiError && error.retryAfterSeconds) {
        savePersisted({
          verificationDraft: {
            ...persisted.verificationDraft,
            cooldownUntil: Date.now() + error.retryAfterSeconds * 1000,
          },
        });
      }
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!selectedOrgId) {
      setStepError("Select an organization first.");
      return;
    }
    const code = persisted.verificationDraft.pendingCode.trim();
    const email = persisted.verificationDraft.submittedEmail.trim();
    if (code.length !== 6) {
      setStepError("Enter the 6-digit code.");
      return;
    }
    if (!email) {
      setStepError("Enter your email first.");
      return;
    }

    setBusy(true);
    try {
      await finishCommunityEmailVerification({
        communityId: selectedOrgId,
        email,
        code,
      });

      try {
        await markOnboardingEmailVerificationSuccess();
      } catch {
        await setOnboardingVerificationChoice("email");
        await markOnboardingEmailVerificationSuccess();
      }

      await refreshSession();
      savePersisted({
        verificationDraft: {
          ...persisted.verificationDraft,
          pendingCode: "",
          submittedEmail: "",
        },
        latestStep: "specialization_selection",
      });
      setManualStepOverride(null);
    } catch (error) {
      if (error instanceof OnboardingApiError && (error.code === "too_many_attempts" || error.code === "email_mismatch")) {
        savePersisted({
          verificationDraft: {
            ...persisted.verificationDraft,
            pendingCode: "",
          },
          latestStep: "email_verification_enter_email",
        });
        setManualStepOverride("email_verification_enter_email");
      }
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    if (!selectedOrgId || !persisted.verificationDraft.submittedEmail) return;
    const cooldownUntil = persisted.verificationDraft.cooldownUntil ?? 0;
    if (cooldownUntil > Date.now()) {
      setStepError(`Please wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)} seconds to resend.`);
      return;
    }
    setBusy(true);
    try {
      await startCommunityEmailVerification({
        communityId: selectedOrgId,
        email: persisted.verificationDraft.submittedEmail,
      });
      savePersisted({
        verificationDraft: {
          ...persisted.verificationDraft,
          pendingCode: "",
        },
      });
      setStepNotice("A new code was sent.");
    } catch (error) {
      if (error instanceof OnboardingApiError && error.retryAfterSeconds) {
        savePersisted({
          verificationDraft: {
            ...persisted.verificationDraft,
            cooldownUntil: Date.now() + error.retryAfterSeconds * 1000,
          },
        });
      }
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleSpecializationContinue = async () => {
    const selectedIds = persisted.specializationDraft.selectedIds.filter((entry) => entry.length > 0).slice(0, 2);
    if (!selectedIds.length) {
      setStepError("Select at least one specialization.");
      return;
    }

    setBusy(true);
    try {
      const primaryId = selectedIds[0];
      await submitOnboardingSpecialization(primaryId);
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
      setManualStepOverride(null);
    } catch (error) {
      setStepError(mapOnboardingError(error));
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
      savePersisted({ latestStep: "completed" });
      setManualStepOverride(null);
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleFinalizeContinue = async () => {
    setBusy(true);
    try {
      await finalizeOnboarding();
      await refreshSession();
      savePersisted({ latestStep: "completed" });
      setManualStepOverride(null);
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteAfterCommunityRequest = async () => {
    setBusy(true);
    try {
      await completeAfterCommunityRequest();
      await refreshSession();
      savePersisted({ latestStep: "completed" });
      setManualStepOverride(null);
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleSpecialization = (id: string) => {
    const current = persisted.specializationDraft.selectedIds;
    const exists = current.includes(id);
    const next = exists
      ? current.filter((entry) => entry !== id)
      : current.length >= 2
        ? [...current.slice(1), id]
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
      setStepNotice("Profile updated.");
      setBusy(false);
    } catch (error) {
      setStepError(mapOnboardingError(error));
      setBusy(false);
    }
  };

  const skipFinishProfile = async () => {
    setBusy(true);
    try {
      await dismissProfileCompletionPrompt();
      await refreshSession();
      setStepNotice("You can finish your profile anytime from settings.");
    } catch (error) {
      setStepError(mapOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

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

  const cooldownSeconds =
    persisted.verificationDraft.cooldownUntil && persisted.verificationDraft.cooldownUntil > Date.now()
      ? Math.ceil((persisted.verificationDraft.cooldownUntil - Date.now()) / 1000)
      : 0;
  const illustration = getStepIllustration(currentStep);
  const canBack = canGoBackFromStep(currentStep) && !transitionLock;

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
          <div className="mb-4 flex flex-wrap gap-2">
            {progressSteps.map((step, index) => (
              <div
                key={step}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  index < progressCount
                    ? "bg-brand text-white"
                    : "bg-bg-muted text-text-secondary"
                }`}
              >
                {STEP_LABELS[step]}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-light">Onboarding</p>
                <h1 className="mt-1 text-2xl font-semibold text-strong md:text-3xl">{STEP_LABELS[currentStep] ?? "Onboarding"}</h1>
              </div>

              {stepError ? (
                <div className="rounded-xl border border-brand/20 bg-brand/10 px-4 py-3 text-sm text-brand">{stepError}</div>
              ) : null}
              {stepNotice ? (
                <div className="rounded-xl border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">{stepNotice}</div>
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
                    >
                      Contact support
                    </Link>
                  </div>
                </div>
              ) : null}

              {currentStep === "profile_setup" ? (
                <div className="space-y-3">
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
                      placeholder="username"
                      autoComplete="off"
                    />
                    {usernameCheckState === "checking" ? <p className="text-xs text-text-light">Checking availability...</p> : null}
                    {usernameCheckState === "available" ? <p className="text-xs text-green-600">Username is available.</p> : null}
                    {usernameCheckState === "taken" ? <p className="text-xs text-brand">Username is already taken.</p> : null}
                    {usernameCheckState === "invalid" ? (
                      <p className="text-xs text-brand">Use 3-30 lowercase letters, numbers, or underscores.</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="onboarding-first-name" className="text-sm font-semibold text-text-secondary">First name</label>
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
                      <label htmlFor="onboarding-last-name" className="text-sm font-semibold text-text-secondary">Last name</label>
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
                    <label htmlFor="onboarding-dob" className="text-sm font-semibold text-text-secondary">Date of birth</label>
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

                  <button
                    type="button"
                    disabled={transitionLock}
                    onClick={handleProfileSubmit}
                    className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {transitionLock ? "Saving..." : "Continue"}
                  </button>
                </div>
              ) : null}

              {currentStep === "verification_info" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    Verification unlocks posting and engagement features in your work or school community. You can continue onboarding now and complete verification with email.
                  </p>
                  <div className="flex gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleVerificationInfoContinue}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "org_selection" ? (
                <div className="space-y-4">
                  <div className="inline-flex rounded-full bg-bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setOrgKind("company")}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        orgKind === "company" ? "bg-brand text-white" : "text-text-secondary"
                      }`}
                    >
                      Company
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrgKind("school")}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        orgKind === "school" ? "bg-brand text-white" : "text-text-secondary"
                      }`}
                    >
                      School
                    </button>
                  </div>

                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${orgKind === "school" ? "schools" : "companies"}...`}
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />

                  {isCommunityLoading ? <p className="text-sm text-text-light">Loading organizations...</p> : null}

                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {(searchQuery.trim().length > 0 ? searchedCommunities : recommendedCommunities).map((community) => {
                      const selected = selectedCommunity?.id === community.id;
                      return (
                        <button
                          key={community.id}
                          type="button"
                          onClick={() =>
                            savePersisted({
                              orgDraft: {
                                orgId: community.id,
                                orgName: community.shortName ?? community.name,
                                orgKind: community.kind,
                              },
                            })
                          }
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            selected ? "border-brand bg-brand/10" : "border-border bg-bg hover:border-brand/40"
                          }`}
                        >
                          <p className="text-sm font-semibold text-strong">{community.shortName ?? community.name}</p>
                          <p className="text-xs text-text-light">{community.membersLabel ?? community.kind}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleOrgContinue}
                      className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Continue
                    </button>

                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleCompleteAfterCommunityRequest}
                      className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                    >
                      Request community and continue later
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_intro" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    Verify with your organization email to unlock posting permissions. Web currently supports email verification only.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setManualStepOverride("verification_choice");
                        savePersisted({ latestStep: "verification_choice" });
                      }}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={() => handleSelectVerificationPath("skip")}
                      className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                    >
                      Skip verification
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_choice" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
                    <p className="text-sm font-semibold text-strong">Company/Student Email</p>
                    <p className="mt-1 text-xs text-text-secondary">Only email verification is available on web.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={() => handleSelectVerificationPath("email")}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "email_verification_enter_email" ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-text-secondary" htmlFor="verify-email-local">Work/School email</label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        id="verify-email-local"
                        type="text"
                        value={persisted.verificationDraft.emailLocalPart}
                        onChange={(event) =>
                          savePersisted({
                            verificationDraft: {
                              ...persisted.verificationDraft,
                              emailLocalPart: event.target.value.replace(/\s+/g, ""),
                            },
                          })
                        }
                        className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        placeholder="name"
                      />
                      <select
                        value={persisted.verificationDraft.selectedDomain}
                        onChange={(event) =>
                          savePersisted({
                            verificationDraft: {
                              ...persisted.verificationDraft,
                              selectedDomain: event.target.value,
                            },
                          })
                        }
                        className="min-w-44 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        disabled={isDomainsLoading}
                      >
                        {isDomainsLoading ? <option>Loading domains...</option> : null}
                        {!isDomainsLoading && allowedDomains.length === 0 ? <option value="">No domains configured</option> : null}
                        {!isDomainsLoading &&
                          allowedDomains.map((domain) => (
                            <option key={domain} value={domain}>
                              @{domain}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleSendVerificationCode}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Send code
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "email_verification_enter_code" ? (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-semibold text-strong">{persisted.verificationDraft.submittedEmail}</span>.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={persisted.verificationDraft.pendingCode}
                    onChange={(event) =>
                      savePersisted({
                        verificationDraft: {
                          ...persisted.verificationDraft,
                          pendingCode: event.target.value.replace(/\D/g, "").slice(0, 6),
                        },
                      })
                    }
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-center text-2xl tracking-[0.4em] text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="000000"
                  />
                  <div className="flex flex-wrap gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleVerifyCode}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      disabled={transitionLock || cooldownSeconds > 0}
                      onClick={handleResendCode}
                      className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:opacity-60"
                    >
                      {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"}
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "specialization_selection" ? (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Pick up to 2 {selectedOrgKind === "school" ? "majors" : "fields"}.
                  </p>
                  {specializationLoading ? <p className="text-sm text-text-light">Loading options...</p> : null}
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {specializationOptions.map((option) => {
                      const selected = persisted.specializationDraft.selectedIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleSpecialization(option.id)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selected ? "border-brand bg-brand/10" : "border-border bg-bg hover:border-brand/40"
                          }`}
                        >
                          <p className="text-sm font-semibold text-strong">{option.name}</p>
                          <p className="text-xs text-text-light">{option.type}</p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={transitionLock}
                    onClick={handleSpecializationContinue}
                    className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {currentStep === "skip_explainer" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    If you skip verification now, some posting and interaction features stay restricted.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {canBack ? (
                      <button
                        type="button"
                        onClick={handleBack}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong"
                      >
                        Back
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={transitionLock}
                      onClick={handleSkipContinue}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                    >
                      Continue anyway
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep === "verification_confirmation" ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    You are ready to finish onboarding. Continue to enter the app.
                  </p>
                  <button
                    type="button"
                    disabled={transitionLock}
                    onClick={handleFinalizeContinue}
                    className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                  >
                    Finalize onboarding
                  </button>
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

            <div className="flex items-start justify-center">
              <img
                src={illustration}
                alt=""
                className="w-full max-w-md rounded-2xl border border-border bg-bg-muted object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
      <AvatarCropModal
        open={Boolean(finishCropSourceUrl)}
        imageSrc={finishCropSourceUrl}
        title="Adjust profile photo"
        isApplying={isApplyingFinishCrop}
        onCancel={handleCancelFinishCrop}
        onApply={handleApplyFinishCrop}
      />
    </div>
  );
}
