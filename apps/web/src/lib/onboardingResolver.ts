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

const EARLY_STAGE_STEPS = new Set<OnboardingFlowStep>(["profile_setup", "verification_info", "org_selection"]);
const CONTEXT_OVERRIDE_STAGES = new Set([
  "org_selected",
  "verification_intro",
  "verification_choice",
  "ways_to_verify",
  "email_verification",
  "email_verified",
  "specialization_required",
  "specialization_selection",
  "specialization_selected",
  "ready_to_finalize",
  "skip_explainer",
]);
const ORG_REQUIRED_STEPS = new Set<OnboardingFlowStep>([
  "verification_intro",
  "verification_choice",
  "email_verification_enter_email",
  "email_verification_enter_code",
  "specialization_selection",
  "skip_explainer",
  "verification_confirmation",
]);
const INFO_SCREEN_REQUIRED_STAGES = new Set([
  "org_selection",
  "select_company",
  "org_selected",
  "verification_intro",
  "verification_choice",
  "ways_to_verify",
]);
const INFO_SCREEN_REQUIRED_RESOLVED_STEPS = new Set<OnboardingFlowStep>([
  "org_selection",
  "verification_intro",
  "verification_choice",
  "email_verification_enter_email",
  "email_verification_enter_code",
  "specialization_selection",
  "skip_explainer",
  "verification_confirmation",
]);

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

function wasInfoScreenViewed(bootstrap: SessionBootstrap): boolean {
  const milestones = bootstrap.onboardingContext.milestones;
  const rawValue = milestones.info_screen_viewed_at ?? milestones.infoScreenViewedAt;
  if (typeof rawValue !== "string") return false;
  const normalized = rawValue.trim().toLowerCase();
  if (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "none" ||
    normalized === "false" ||
    normalized === "0"
  ) {
    return false;
  }
  return true;
}

function coerceCodeStep(step: OnboardingFlowStep, hasPendingVerificationCode: boolean): OnboardingFlowStep {
  if (step === "email_verification_enter_email" && hasPendingVerificationCode) {
    return "email_verification_enter_code";
  }
  return step;
}

function shouldUseContextOverride({
  normalizedStage,
  stageStep,
}: {
  normalizedStage: string | null;
  stageStep: OnboardingFlowStep | null;
}): boolean {
  if (!normalizedStage) return true;
  if (normalizedStage === "photo_id_verification") return true;
  if (CONTEXT_OVERRIDE_STAGES.has(normalizedStage)) return true;
  if (!stageStep) return true;
  return !EARLY_STAGE_STEPS.has(stageStep);
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
  const sanitizedLocalStep = sanitizeLocalStep(localStep);
  if (!bootstrap) return sanitizedLocalStep ?? "profile_setup";
  if (bootstrap.onboardingComplete) return "completed";

  const normalizedStage = normalizeStage(bootstrap.onboardingStageV2);
  const allowedNextStep = stepFromAllowedNext(bootstrap.allowedNextStagesV2);
  const fromContext = resolveFromContext({ bootstrap, hasPendingVerificationCode });
  if (fromContext === "unsupported_web_stage") return fromContext;

  let stageStep: OnboardingFlowStep | null = null;
  if (normalizedStage === "photo_id_verification") {
    stageStep = "unsupported_web_stage";
  } else if (normalizedStage && normalizedStage in STAGE_MAP) {
    stageStep = coerceCodeStep(STAGE_MAP[normalizedStage], hasPendingVerificationCode);

    if (
      normalizedStage === "org_selected" &&
      allowedNextStep &&
      allowedNextStep !== "org_selection" &&
      allowedNextStep !== "verification_intro"
    ) {
      stageStep = coerceCodeStep(allowedNextStep, hasPendingVerificationCode);
    }
  }

  let resolvedStep: OnboardingFlowStep | null = stageStep;
  if (fromContext && shouldUseContextOverride({ normalizedStage, stageStep })) {
    resolvedStep = fromContext;
  }

  if (!resolvedStep && allowedNextStep) {
    resolvedStep = coerceCodeStep(allowedNextStep, hasPendingVerificationCode);
  }

  if (!resolvedStep) {
    const legacyStep = normalizeStage(bootstrap.onboardingStep);
    if (legacyStep === "profile_setup") {
      resolvedStep = "profile_setup";
    } else if (legacyStep === "select_company") {
      resolvedStep = "org_selection";
    } else if (legacyStep === "verification") {
      resolvedStep = "verification_choice";
    } else if (legacyStep === "verification_notifications") {
      resolvedStep = "verification_confirmation";
    }
  }

  if (!resolvedStep) {
    resolvedStep = sanitizedLocalStep ?? "profile_setup";
  }

  const infoScreenViewed = wasInfoScreenViewed(bootstrap);
  if (
    !infoScreenViewed &&
    ((normalizedStage && INFO_SCREEN_REQUIRED_STAGES.has(normalizedStage)) ||
      INFO_SCREEN_REQUIRED_RESOLVED_STEPS.has(resolvedStep))
  ) {
    return "verification_info";
  }

  if (
    resolvedStep === "org_selection" &&
    sanitizedLocalStep === "verification_info"
  ) {
    return "verification_info";
  }

  const hasSelectedOrg = Boolean(bootstrap.onboardingContext.selectedOrgId);
  if (ORG_REQUIRED_STEPS.has(resolvedStep) && !hasSelectedOrg) {
    return "org_selection";
  }

  return resolvedStep;
}

export function canGoBackFromStep(step: OnboardingFlowStep): boolean {
  if (step === "profile_setup") return false;
  if (step === "verification_confirmation") return false;
  return true;
}

export function shouldHardBlockHistoryBack(step: OnboardingFlowStep): boolean {
  return step === "profile_setup" || step === "specialization_selection" || step === "verification_confirmation";
}
