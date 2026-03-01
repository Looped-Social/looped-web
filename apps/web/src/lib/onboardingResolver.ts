import type { SessionBootstrap } from "./sessionBootstrapApi";

export type OnboardingFlowStep =
  | "profile_setup"
  | "verification_info"
  | "org_selection"
  | "verification_intro"
  | "verification_choice"
  | "email_verification_enter_email"
  | "email_verification_enter_code"
  | "specialization_selection"
  | "skip_explainer"
  | "verification_confirmation"
  | "completed"
  | "unsupported_web_stage";

type ResolveArgs = {
  bootstrap: SessionBootstrap | null;
  localStep?: OnboardingFlowStep | null;
  hasPendingVerificationCode?: boolean;
};

const STAGE_MAP: Record<string, OnboardingFlowStep> = {
  profile_setup: "profile_setup",
  info_screen: "verification_info",
  posting_info: "verification_info",
  verification_info: "verification_info",
  org_selection: "org_selection",
  select_company: "org_selection",
  org_selected: "verification_intro",
  verification_intro: "verification_intro",
  verification_choice: "verification_choice",
  ways_to_verify: "verification_choice",
  email_verification: "email_verification_enter_email",
  email_verified: "specialization_selection",
  specialization_required: "specialization_selection",
  specialization_selection: "specialization_selection",
  specialization_selected: "verification_confirmation",
  skip_explainer: "skip_explainer",
  ready_to_finalize: "verification_confirmation",
  completed: "completed",
  finalized: "completed",
};

const LOCAL_FALLBACK_ORDER: OnboardingFlowStep[] = [
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

const ALLOWED_NEXT_PRIORITY: Array<{ keys: string[]; step: OnboardingFlowStep }> = [
  { keys: ["completed", "finalized", "ready_to_finalize"], step: "verification_confirmation" },
  { keys: ["skip_explainer"], step: "skip_explainer" },
  { keys: ["specialization_selection", "specialization_required", "specialization_selected"], step: "specialization_selection" },
  { keys: ["email_verification", "email_verified"], step: "email_verification_enter_email" },
  { keys: ["verification_choice", "ways_to_verify"], step: "verification_choice" },
  { keys: ["verification_intro"], step: "verification_intro" },
  { keys: ["org_selection", "select_company", "org_selected"], step: "org_selection" },
];

function normalizeStage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeLocalStep(localStep: OnboardingFlowStep | null | undefined): OnboardingFlowStep | null {
  if (!localStep) return null;
  if (!LOCAL_FALLBACK_ORDER.includes(localStep)) return null;
  return localStep;
}

function stepFromAllowedNext(stages: string[]): OnboardingFlowStep | null {
  const normalized = stages.map((value) => value.toLowerCase());
  for (const candidate of ALLOWED_NEXT_PRIORITY) {
    if (candidate.keys.some((key) => normalized.includes(key))) {
      return candidate.step;
    }
  }
  return null;
}

function hasSpecializationSelected(bootstrap: SessionBootstrap): boolean {
  return Boolean(bootstrap.onboardingContext.selectedSpecializationId);
}

function resolveFromContext({
  bootstrap,
  hasPendingVerificationCode,
}: {
  bootstrap: SessionBootstrap;
  hasPendingVerificationCode: boolean;
}): OnboardingFlowStep | null {
  const context = bootstrap.onboardingContext;
  const verificationPath = normalizeStage(context.verificationPath);
  const verificationStatus = normalizeStage(context.verificationStatus);
  const requiresSpecialization = Boolean(context.requiresSpecializationSelection);

  if (verificationPath === "photo_id") {
    return "unsupported_web_stage";
  }

  if (verificationPath === "skip") return "skip_explainer";

  if (verificationPath === "email") {
    if (verificationStatus === "approved") {
      if (requiresSpecialization || !hasSpecializationSelected(bootstrap)) return "specialization_selection";
      return "verification_confirmation";
    }
    return hasPendingVerificationCode ? "email_verification_enter_code" : "email_verification_enter_email";
  }

  if (verificationStatus === "approved") {
    if (requiresSpecialization || !hasSpecializationSelected(bootstrap)) return "specialization_selection";
    return "verification_confirmation";
  }

  return null;
}

export function resolveOnboardingStep({
  bootstrap,
  localStep,
  hasPendingVerificationCode = false,
}: ResolveArgs): OnboardingFlowStep {
  if (!bootstrap) return sanitizeLocalStep(localStep) ?? "profile_setup";
  if (bootstrap.onboardingComplete) return "completed";

  const fromContext = resolveFromContext({ bootstrap, hasPendingVerificationCode });
  if (fromContext) return fromContext;

  const normalizedStage = normalizeStage(bootstrap.onboardingStageV2);
  if (normalizedStage && normalizedStage in STAGE_MAP) {
    const mapped = STAGE_MAP[normalizedStage];
    if (mapped === "email_verification_enter_email" && hasPendingVerificationCode) {
      return "email_verification_enter_code";
    }
    return mapped;
  }

  if (normalizedStage === "photo_id_verification") {
    return "unsupported_web_stage";
  }

  const allowedNextStep = stepFromAllowedNext(bootstrap.allowedNextStagesV2);
  if (allowedNextStep) return allowedNextStep;

  const legacyStep = normalizeStage(bootstrap.onboardingStep);
  if (legacyStep === "profile_setup") return "profile_setup";
  if (legacyStep === "select_company") return "org_selection";
  if (legacyStep === "verification") return "verification_choice";
  if (legacyStep === "verification_notifications") return "verification_confirmation";

  return sanitizeLocalStep(localStep) ?? "profile_setup";
}

export function canGoBackFromStep(step: OnboardingFlowStep): boolean {
  if (step === "profile_setup") return false;
  if (step === "verification_confirmation") return false;
  return true;
}

export function shouldHardBlockHistoryBack(step: OnboardingFlowStep): boolean {
  return step === "profile_setup" || step === "specialization_selection" || step === "verification_confirmation";
}
