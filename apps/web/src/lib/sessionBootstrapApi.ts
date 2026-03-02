import { getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export type SessionBootstrapProfileCompletion = {
  dismissedAt: string | null;
  completedAt: string | null;
  missingPhoto: boolean;
  missingBio: boolean;
  missingSpecialization: boolean;
  shouldPrompt: boolean;
};

export type SessionBootstrapOnboardingContext = {
  selectedOrgId: string | null;
  selectedOrgKind: string | null;
  verificationPath: string | null;
  verificationStatus: string | null;
  requiresSpecializationSelection: boolean;
  selectedSpecializationId: string | null;
  completionReason: string | null;
  milestones: Record<string, string | null>;
};

export type SessionBootstrap = {
  status: number;
  requestId: string | null;
  provisioned: boolean;
  onboardingComplete: boolean;
  onboardingStep: string | null;
  onboardingStageV2: string | null;
  allowedNextStagesV2: string[];
  onboardingContext: SessionBootstrapOnboardingContext;
  profileCompletion: SessionBootstrapProfileCompletion | null;
  user: Record<string, unknown> | null;
  errorCode: string | null;
};

export class SessionBootstrapError extends Error {
  status: number;
  details?: string;
  requestId?: string | null;

  constructor({
    status,
    message,
    details,
    requestId,
  }: {
    status: number;
    message: string;
    details?: string;
    requestId?: string | null;
  }) {
    super(message);
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();
    if (normalized === "null" || normalized === "undefined" || normalized === "none") {
      return null;
    }
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function parsePayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return {};
  }
}

function extractErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return getString(payload.error ?? payload.code)?.toLowerCase() ?? null;
}

function normalizeAllowedNextStages(payload: Record<string, unknown>): string[] {
  const candidates: unknown[] = [];
  if (Array.isArray(payload.allowed_next_stages_v2)) candidates.push(...payload.allowed_next_stages_v2);
  if (Array.isArray(payload.allowedNextStagesV2)) candidates.push(...payload.allowedNextStagesV2);
  if (Array.isArray(payload.allowed_next_stages)) candidates.push(...payload.allowed_next_stages);

  const unique = new Set<string>();
  for (const candidate of candidates) {
    const value = getString(candidate)?.toLowerCase();
    if (!value) continue;
    unique.add(value);
  }
  return Array.from(unique);
}

function normalizeContext(payload: Record<string, unknown>): SessionBootstrapOnboardingContext {
  const rawContext =
    (isRecord(payload.onboarding_context) ? payload.onboarding_context : null) ??
    (isRecord(payload.onboardingContext) ? payload.onboardingContext : null) ??
    {};

  const selectedOrgId =
    getString(rawContext.selected_org_id ?? rawContext.selectedOrgId) ??
    getString(payload.selected_org_id ?? payload.selectedOrgId);
  const selectedOrgKind =
    getString(rawContext.selected_org_kind ?? rawContext.selectedOrgKind) ??
    getString(payload.selected_org_kind ?? payload.selectedOrgKind);
  const verificationPath =
    getString(rawContext.verification_path ?? rawContext.verificationPath) ??
    getString(payload.verification_path ?? payload.verificationPath);
  const verificationStatus =
    getString(rawContext.verification_status ?? rawContext.verificationStatus) ??
    getString(payload.verification_status ?? payload.verificationStatus);
  const requiresSpecializationSelection =
    getBoolean(rawContext.requires_specialization_selection ?? rawContext.requiresSpecializationSelection) ??
    getBoolean(payload.requires_specialization_selection ?? payload.requiresSpecializationSelection) ??
    false;
  const selectedSpecializationId =
    getString(rawContext.selected_specialization_id ?? rawContext.selectedSpecializationId) ??
    getString(payload.selected_specialization_id ?? payload.selectedSpecializationId);
  const completionReason =
    getString(rawContext.completion_reason ?? rawContext.completionReason) ??
    getString(payload.completion_reason ?? payload.completionReason);

  const milestonesSource =
    (isRecord(rawContext.milestones) ? rawContext.milestones : null) ??
    (isRecord(payload.milestones) ? payload.milestones : null);
  const milestones: Record<string, string | null> = {};
  if (milestonesSource) {
    for (const [key, value] of Object.entries(milestonesSource)) {
      milestones[key] = getString(value);
    }
  }

  return {
    selectedOrgId,
    selectedOrgKind,
    verificationPath,
    verificationStatus,
    requiresSpecializationSelection,
    selectedSpecializationId,
    completionReason,
    milestones,
  };
}

function normalizeProfileCompletion(payload: Record<string, unknown>): SessionBootstrapProfileCompletion | null {
  const rawCompletion =
    (isRecord(payload.profile_completion) ? payload.profile_completion : null) ??
    (isRecord(payload.profileCompletion) ? payload.profileCompletion : null);
  if (!rawCompletion) return null;

  return {
    dismissedAt: getString(rawCompletion.dismissed_at ?? rawCompletion.dismissedAt),
    completedAt: getString(rawCompletion.completed_at ?? rawCompletion.completedAt),
    missingPhoto:
      getBoolean(rawCompletion.missing_photo ?? rawCompletion.missingPhoto) ??
      false,
    missingBio:
      getBoolean(rawCompletion.missing_bio ?? rawCompletion.missingBio) ??
      false,
    missingSpecialization:
      getBoolean(rawCompletion.missing_specialization ?? rawCompletion.missingSpecialization) ??
      false,
    shouldPrompt:
      getBoolean(rawCompletion.should_prompt ?? rawCompletion.shouldPrompt) ??
      false,
  };
}

function normalizeBootstrap({
  payload,
  status,
  requestId,
}: {
  payload: unknown;
  status: number;
  requestId: string | null;
}): SessionBootstrap {
  const record = isRecord(payload) ? payload : {};
  const user = isRecord(record.user) ? record.user : null;
  const userPayload = user ?? record;

  const provisioned =
    getBoolean(record.provisioned) ??
    getBoolean(userPayload.provisioned) ??
    false;
  const onboardingComplete =
    getBoolean(record.onboarding_complete ?? record.onboardingComplete) ??
    getBoolean(userPayload.onboarding_complete ?? userPayload.onboardingComplete) ??
    false;

  const onboardingStep =
    getString(record.onboarding_step ?? record.onboardingStep) ??
    getString(record.current_step ?? record.currentStep) ??
    getString(userPayload.onboarding_step ?? userPayload.onboardingStep);
  const onboardingStageV2 =
    getString(record.onboarding_stage_v2 ?? record.onboardingStageV2) ??
    getString(record.current_stage_v2 ?? record.currentStageV2) ??
    getString(userPayload.onboarding_stage_v2 ?? userPayload.onboardingStageV2);

  return {
    status,
    requestId,
    provisioned,
    onboardingComplete,
    onboardingStep,
    onboardingStageV2,
    allowedNextStagesV2: normalizeAllowedNextStages(record),
    onboardingContext: normalizeContext(record),
    profileCompletion: normalizeProfileCompletion(record),
    user,
    errorCode: extractErrorCode(record),
  };
}

export async function fetchSessionBootstrap(): Promise<SessionBootstrap> {
  const token = await getFirebaseIdToken();
  const response = await fetch(`${getApiBase()}/v1/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const requestId = response.headers.get("X-Request-Id");
  const raw = await response.text();
  const payload = parsePayload(raw);

  if (!response.ok) {
    if (response.status === 409) {
      return normalizeBootstrap({
        payload,
        status: response.status,
        requestId,
      });
    }

    const message = (() => {
      if (response.status === 401) return "Your session could not be verified.";
      const code = extractErrorCode(payload);
      if (code) return code;
      return raw.trim() || "Unable to load account session.";
    })();

    throw new SessionBootstrapError({
      status: response.status,
      message,
      details: raw,
      requestId,
    });
  }

  return normalizeBootstrap({
    payload,
    status: response.status,
    requestId,
  });
}
