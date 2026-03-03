import type { OnboardingFlowStep } from "./onboardingResolver";

export type OnboardingProfileDraft = {
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

export type OnboardingOrgDraft = {
  orgId: string;
  orgName: string;
  orgKind: string;
};

export type OnboardingVerificationDraft = {
  emailLocalPart: string;
  selectedDomain: string;
  submittedEmail: string;
  pendingCode: string;
  cooldownUntil: number | null;
};

export type OnboardingSpecializationDraft = {
  primaryId: string;
  selectedIds: string[];
};

export type PersistedOnboardingState = {
  latestStep: OnboardingFlowStep | null;
  profileDraft: OnboardingProfileDraft;
  orgDraft: OnboardingOrgDraft | null;
  verificationMethod: "email";
  verificationDraft: OnboardingVerificationDraft;
  specializationDraft: OnboardingSpecializationDraft;
  updatedAt: number;
};

const DEFAULT_ONBOARDING_STATE: PersistedOnboardingState = {
  latestStep: null,
  profileDraft: {
    username: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
  },
  orgDraft: null,
  verificationMethod: "email",
  verificationDraft: {
    emailLocalPart: "",
    selectedDomain: "",
    submittedEmail: "",
    pendingCode: "",
    cooldownUntil: null,
  },
  specializationDraft: {
    primaryId: "",
    selectedIds: [],
  },
  updatedAt: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function storageKey(uid: string): string {
  return `looped:onboarding-v2:${uid}`;
}

export function loadPersistedOnboardingState(uid: string): PersistedOnboardingState {
  if (typeof window === "undefined") return DEFAULT_ONBOARDING_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return DEFAULT_ONBOARDING_STATE;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return DEFAULT_ONBOARDING_STATE;

    const profileDraftRaw = isRecord(parsed.profileDraft) ? parsed.profileDraft : {};
    const orgDraftRaw = isRecord(parsed.orgDraft) ? parsed.orgDraft : null;
    const verificationRaw = isRecord(parsed.verificationDraft) ? parsed.verificationDraft : {};
    const specializationRaw = isRecord(parsed.specializationDraft) ? parsed.specializationDraft : {};

    const selectedIds = Array.isArray(specializationRaw.selectedIds)
      ? specializationRaw.selectedIds.map((entry) => getString(entry)).filter((entry) => entry.length > 0)
      : [];

    return {
      latestStep: getString(parsed.latestStep) as PersistedOnboardingState["latestStep"],
      profileDraft: {
        username: getString(profileDraftRaw.username),
        firstName: getString(profileDraftRaw.firstName),
        lastName: getString(profileDraftRaw.lastName),
        dateOfBirth: getString(profileDraftRaw.dateOfBirth),
      },
      orgDraft:
        orgDraftRaw && getString(orgDraftRaw.orgId)
          ? {
              orgId: getString(orgDraftRaw.orgId),
              orgName: getString(orgDraftRaw.orgName),
              orgKind: getString(orgDraftRaw.orgKind),
            }
          : null,
      verificationMethod: "email",
      verificationDraft: {
        emailLocalPart: getString(verificationRaw.emailLocalPart),
        selectedDomain: getString(verificationRaw.selectedDomain),
        submittedEmail: getString(verificationRaw.submittedEmail),
        pendingCode: getString(verificationRaw.pendingCode),
        cooldownUntil: getNumber(verificationRaw.cooldownUntil) || null,
      },
      specializationDraft: {
        primaryId: getString(specializationRaw.primaryId),
        selectedIds,
      },
      updatedAt: getNumber(parsed.updatedAt),
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

export function savePersistedOnboardingState(
  uid: string,
  nextState: Partial<PersistedOnboardingState>
): PersistedOnboardingState {
  const current = loadPersistedOnboardingState(uid);
  const merged: PersistedOnboardingState = {
    ...current,
    ...nextState,
    profileDraft: {
      ...current.profileDraft,
      ...(nextState.profileDraft ?? {}),
    },
    verificationDraft: {
      ...current.verificationDraft,
      ...(nextState.verificationDraft ?? {}),
    },
    specializationDraft: {
      ...current.specializationDraft,
      ...(nextState.specializationDraft ?? {}),
      selectedIds: nextState.specializationDraft?.selectedIds ?? current.specializationDraft.selectedIds,
    },
    updatedAt: Date.now(),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(uid), JSON.stringify(merged));
    } catch {
      // ignore write failures
    }
  }
  return merged;
}

export function clearPersistedOnboardingState(uid: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(uid));
  } catch {
    // ignore clear failures
  }
}

export function defaultPersistedOnboardingState(): PersistedOnboardingState {
  return DEFAULT_ONBOARDING_STATE;
}
