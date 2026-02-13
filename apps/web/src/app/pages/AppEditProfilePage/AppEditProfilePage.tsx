import { type ChangeEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";
import { CameraIcon } from "@/app/components/AppIcons/AppIcons";
import { AvatarCropModal } from "@/app/components/AvatarCropModal/AvatarCropModal";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  ProfileEditApiError,
  fetchDefaultProfileImageUrl,
  fetchJoinedSpecializations,
  fetchProfileCommunities,
  fetchUsernameAvailability,
  isUsernameAvailable,
  updateMyDisplayCommunity,
  updateMyDisplaySpecialization,
  updateMyIdentity,
  updateMyProfile,
  uploadProfilePhoto,
} from "@/lib/profileEditApi";
import { fetchUserMe, fetchUserProfile } from "@/lib/userApi";
import { isValidUsername, normalizeUsername } from "@/lib/settingsValidation";
import { refreshCurrentUser } from "@/stores/currentUserStore";

const DEFAULT_PROFILE_IMAGE_SRC = "/ios-icons/pfp2.svg";

type SelectOption = {
  id: string;
  label: string;
};

type EditProfileForm = {
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  bio: string;
  displayCommunityId: string;
  displaySpecializationId: string;
};

type UsernameStatus = "idle" | "checking" | "available" | "owned" | "taken" | "invalid" | "error";

type EditableProfile = {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  bio: string;
  avatarUrl?: string;
  displayCommunityId: string;
  displayCommunityLabel?: string;
  displaySpecializationId: string;
  displaySpecializationLabel?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function normalizeOptional(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDateInput(value: unknown): string {
  const raw = normalizeOptional(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function resolveCurrentUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.user)) {
    return pickString(payload.user, ["id", "user_id", "userId"]);
  }
  return pickString(payload, ["id", "user_id", "userId"]);
}

function preferredDisplayName(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return normalizeOptional(value.short_name ?? value.shortName ?? value.name ?? value.label ?? value.title);
}

function parseSelectedReference(source: Record<string, unknown>, key: "community" | "specialization") {
  const directId =
    pickString(source, [`display_${key}_id`, `display${capitalize(key)}Id`]) ??
    pickString(source, [key === "community" ? "community_id" : "specialization_id"]);

  const node =
    (isRecord(source[`display_${key}`]) ? (source[`display_${key}`] as Record<string, unknown>) : null) ??
    (isRecord(source[`display${capitalize(key)}`]) ? (source[`display${capitalize(key)}`] as Record<string, unknown>) : null);

  const nestedId = node ? pickString(node, ["id", `${key}_id`, `${key}Id`]) : undefined;
  const label =
    (node ? preferredDisplayName(node) : undefined) ??
    normalizeOptional(source[`display_${key}_name`] ?? source[`display${capitalize(key)}Name`]);

  return {
    id: directId ?? nestedId ?? "",
    label,
  };
}

function normalizeEditableProfile(primary: Record<string, unknown>, fallback?: Record<string, unknown> | null): EditableProfile | null {
  const userId =
    pickString(primary, ["id", "user_id", "userId"]) ??
    (fallback ? pickString(fallback, ["id", "user_id", "userId"]) : undefined);
  if (!userId) return null;

  const usernameRaw =
    normalizeOptional(primary.username ?? primary.handle) ??
    (fallback ? normalizeOptional(fallback.username ?? fallback.handle) : undefined) ??
    "";

  const firstName =
    normalizeOptional(primary.first_name ?? primary.firstName) ??
    (fallback ? normalizeOptional(fallback.first_name ?? fallback.firstName) : undefined) ??
    "";

  const lastName =
    normalizeOptional(primary.last_name ?? primary.lastName) ??
    (fallback ? normalizeOptional(fallback.last_name ?? fallback.lastName) : undefined) ??
    "";

  const displayName =
    normalizeOptional(primary.display_name ?? primary.displayName ?? primary.name) ??
    (fallback ? normalizeOptional(fallback.display_name ?? fallback.displayName ?? fallback.name) : undefined) ??
    "";

  const derivedNames = displayName
    ? displayName
        .split(/\s+/)
        .filter((chunk) => chunk.length > 0)
        .reduce<{ first: string; last: string }>((acc, chunk, index, all) => {
          if (index === 0) acc.first = chunk;
          if (index > 0 && index === all.length - 1) acc.last = chunk;
          return acc;
        }, { first: "", last: "" })
    : { first: "", last: "" };

  const communityRef = parseSelectedReference(primary, "community");
  const fallbackCommunityRef = fallback ? parseSelectedReference(fallback, "community") : { id: "", label: undefined };
  const specializationRef = parseSelectedReference(primary, "specialization");
  const fallbackSpecializationRef = fallback
    ? parseSelectedReference(fallback, "specialization")
    : { id: "", label: undefined };

  return {
    userId,
    username: usernameRaw.replace(/^@/, "").toLowerCase(),
    firstName: firstName || derivedNames.first,
    lastName: lastName || derivedNames.last,
    dateOfBirth:
      normalizeDateInput(primary.date_of_birth ?? primary.dateOfBirth) ||
      (fallback ? normalizeDateInput(fallback.date_of_birth ?? fallback.dateOfBirth) : ""),
    bio:
      normalizeOptional(primary.bio) ??
      (fallback ? normalizeOptional(fallback.bio) : undefined) ??
      "",
    avatarUrl:
      normalizeOptional(primary.profile_image_url ?? primary.profileImageUrl) ??
      (fallback ? normalizeOptional(fallback.profile_image_url ?? fallback.profileImageUrl) : undefined),
    displayCommunityId: communityRef.id || fallbackCommunityRef.id,
    displayCommunityLabel: communityRef.label ?? fallbackCommunityRef.label,
    displaySpecializationId: specializationRef.id || fallbackSpecializationRef.id,
    displaySpecializationLabel: specializationRef.label ?? fallbackSpecializationRef.label,
  };
}

function parseCommunityOptions(payload: unknown[]): SelectOption[] {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  for (const item of payload) {
    if (!isRecord(item)) continue;

    const source =
      (isRecord(item.community) ? item.community : null) ??
      (isRecord(item.community_item) ? item.community_item : null) ??
      item;

    const activeRaw = item.active ?? source.active ?? source.is_active ?? source.isActive;
    const active = activeRaw === undefined ? true : activeRaw === true || activeRaw === 1 || activeRaw === "true";
    if (!active) continue;

    const id = pickString(source, ["id", "community_id", "communityId", "loop_id", "loopId"]);
    if (!id || seen.has(id)) continue;

    const label =
      normalizeOptional(source.short_name ?? source.shortName) ??
      normalizeOptional(source.name ?? source.community_name ?? source.communityName);
    if (!label) continue;

    seen.add(id);
    options.push({ id, label });
  }

  return options;
}

function parseSpecializationOptions(payload: unknown[]): SelectOption[] {
  const options: SelectOption[] = [];
  const seen = new Set<string>();

  for (const item of payload) {
    if (!isRecord(item)) continue;

    const source =
      (isRecord(item.specialization) ? item.specialization : null) ??
      (isRecord(item.community) ? item.community : null) ??
      item;

    const id = pickString(source, ["id", "specialization_id", "specializationId"]);
    if (!id || seen.has(id)) continue;

    const label =
      normalizeOptional(source.short_name ?? source.shortName) ??
      normalizeOptional(source.name ?? source.specialization_name ?? source.specializationName);
    if (!label) continue;

    seen.add(id);
    options.push({ id, label });
  }

  return options;
}

function parseApiError(error: unknown): { code?: string; message: string } {
  if (error instanceof ProfileEditApiError) {
    const raw = error.details?.trim();
    if (!raw) return { message: error.message };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const code = normalizeOptional(parsed.error);
        const message = normalizeOptional(parsed.message) ?? raw;
        return { code, message };
      }
    } catch {
      return { message: raw };
    }
    return { message: raw };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Something went wrong." };
}

function titleForProfileError(code?: string): string {
  switch (code) {
    case "invalid_profile_image":
      return "Invalid profile image";
    case "cdn_not_configured":
      return "Photos unavailable";
    case "invalid_username":
      return "Invalid username";
    case "username_taken":
      return "Username unavailable";
    case "community_not_verified":
      return "Community not verified";
    case "specialization_not_joined":
      return "Specialization not joined";
    case "specialization_not_found":
    case "community_not_found":
      return "Selection not found";
    default:
      return "Could not save profile";
  }
}

function messageForProfileError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_profile_image":
      return "That photo type is not supported.";
    case "cdn_not_configured":
      return "Profile photos are currently unavailable.";
    case "invalid_username":
      return "Use 3-30 lowercase letters, numbers, or underscores.";
    case "username_taken":
      return "That username is already taken.";
    case "community_not_verified":
      return "You can only display communities where you're verified.";
    case "specialization_not_joined":
      return "Join that specialization first before selecting it.";
    case "specialization_not_found":
    case "community_not_found":
      return "That selection is stale. Please choose another one.";
    default:
      return fallback;
  }
}

function normalizeIdForPayload(value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

function capitalize(value: string): string {
  return value.length ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
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

export function AppEditProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [defaultProfileImageUrl, setDefaultProfileImageUrl] = useState<string | undefined>();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const [communities, setCommunities] = useState<SelectOption[]>([]);
  const [specializations, setSpecializations] = useState<SelectOption[]>([]);

  const [form, setForm] = useState<EditProfileForm>({
    username: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    bio: "",
    displayCommunityId: "",
    displaySpecializationId: "",
  });
  const [initialForm, setInitialForm] = useState<EditProfileForm | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const effectiveAvatarSrc = photoPreviewUrl ?? avatarUrl ?? defaultProfileImageUrl ?? DEFAULT_PROFILE_IMAGE_SRC;

  const handleAvatarImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (defaultProfileImageUrl && image.dataset.defaultFallbackApplied !== "true") {
        image.dataset.defaultFallbackApplied = "true";
        image.src = defaultProfileImageUrl;
        return;
      }
      if (image.dataset.fallbackApplied === "true") return;
      image.dataset.fallbackApplied = "true";
      image.src = DEFAULT_PROFILE_IMAGE_SRC;
    },
    [defaultProfileImageUrl]
  );

  const loadInitialData = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);

    try {
      const [defaultAvatar, meResponse, communityPayload, specializationPayload] = await Promise.all([
        fetchDefaultProfileImageUrl().catch(() => undefined),
        fetchUserMe(),
        fetchProfileCommunities().catch(() => []),
        fetchJoinedSpecializations({ type: "all", limit: 200 }).catch(() => ({ items: [] })),
      ]);

      setDefaultProfileImageUrl(defaultAvatar);

      const meRoot = meResponse as unknown;
      const mePayload = isRecord(meRoot) && isRecord(meRoot.user) ? meRoot.user : meRoot;
      const userId = resolveCurrentUserId(meResponse);
      if (!userId) {
        throw new Error("Unable to resolve your profile.");
      }

      let profilePayload: unknown;
      try {
        profilePayload = await fetchUserProfile(userId);
      } catch {
        profilePayload = mePayload;
      }

      const normalized = normalizeEditableProfile(
        isRecord(profilePayload) ? profilePayload : {},
        isRecord(mePayload) ? mePayload : null
      );

      if (!normalized) {
        throw new Error("Unable to load profile fields.");
      }

      const communityOptions = parseCommunityOptions(Array.isArray(communityPayload) ? communityPayload : []);
      const specializationOptions = parseSpecializationOptions(
        Array.isArray(specializationPayload.items) ? specializationPayload.items : []
      );

      const mergedCommunityOptions = communityOptions.slice();
      if (
        normalized.displayCommunityId &&
        !mergedCommunityOptions.some((entry) => entry.id === normalized.displayCommunityId)
      ) {
        mergedCommunityOptions.unshift({
          id: normalized.displayCommunityId,
          label: normalized.displayCommunityLabel ?? "Current selection",
        });
      }

      const mergedSpecializationOptions = specializationOptions.slice();
      if (
        normalized.displaySpecializationId &&
        !mergedSpecializationOptions.some((entry) => entry.id === normalized.displaySpecializationId)
      ) {
        mergedSpecializationOptions.unshift({
          id: normalized.displaySpecializationId,
          label: normalized.displaySpecializationLabel ?? "Current selection",
        });
      }

      setCommunities(mergedCommunityOptions);
      setSpecializations(mergedSpecializationOptions);

      const normalizedForm: EditProfileForm = {
        username: normalized.username,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        dateOfBirth: normalized.dateOfBirth,
        bio: normalized.bio,
        displayCommunityId: normalized.displayCommunityId,
        displaySpecializationId: normalized.displaySpecializationId,
      };

      setForm(normalizedForm);
      setInitialForm(normalizedForm);
      setAvatarUrl(normalized.avatarUrl);
      setUsernameStatus("owned");
      setUsernameMessage(null);
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setCropSourceUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setStatus("idle");
    } catch (error) {
      const parsed = parseApiError(error);
      setLoadError(parsed.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl, photoPreviewUrl]);

  const normalizedUsername = normalizeUsername(form.username);

  useEffect(() => {
    if (!initialForm || status !== "idle") return;

    if (!normalizedUsername) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username is required.");
      return;
    }

    if (!isValidUsername(normalizedUsername)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Use 3-30 lowercase letters, numbers, or underscores.");
      return;
    }

    if (normalizedUsername === initialForm.username) {
      setUsernameStatus("owned");
      setUsernameMessage(null);
      return;
    }

    let active = true;
    setUsernameStatus("checking");
    setUsernameMessage(null);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetchUsernameAvailability(normalizedUsername);
        if (!active) return;

        if (isUsernameAvailable(response)) {
          const ownedByMe = response.ownedByMe === true || response.owned_by_me === true;
          setUsernameStatus(ownedByMe ? "owned" : "available");
          setUsernameMessage(null);
        } else {
          setUsernameStatus("taken");
          setUsernameMessage("That username is already taken.");
        }
      } catch (error) {
        if (!active) return;
        const parsed = parseApiError(error);
        setUsernameStatus("error");
        setUsernameMessage(parsed.message || "Unable to check username right now.");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [initialForm, normalizedUsername, status]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialForm) return false;
    return (
      Boolean(photoFile) ||
      form.username !== initialForm.username ||
      form.firstName !== initialForm.firstName ||
      form.lastName !== initialForm.lastName ||
      form.dateOfBirth !== initialForm.dateOfBirth ||
      form.bio !== initialForm.bio ||
      form.displayCommunityId !== initialForm.displayCommunityId ||
      form.displaySpecializationId !== initialForm.displaySpecializationId
    );
  }, [form, initialForm, photoFile]);
  const blocker = useBlocker(hasUnsavedChanges && !isSaving);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowExitPrompt(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const canSave =
    status === "idle" &&
    hasUnsavedChanges &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    isValidUsername(normalizedUsername) &&
    (usernameStatus === "available" || usernameStatus === "owned") &&
    !isSaving;

  const handleBack = useCallback(() => {
    navigate("/app/profile", { replace: true });
  }, [navigate]);

  const handleInput = useCallback((field: keyof EditProfileForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: field === "username" ? value.toLowerCase() : value,
    }));
  }, []);

  const handlePhotoPicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast({
          title: "Invalid profile image",
          message: "Please select an image file.",
          tone: "error",
        });
        return;
      }

      setCropSourceUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
    },
    [showToast]
  );

  const handleCancelCrop = useCallback(() => {
    setCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, []);

  const handleApplyCrop = useCallback(async (file: File, previewUrl: string) => {
    setIsApplyingCrop(true);
    try {
      setPhotoFile(file);
      setPhotoPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return previewUrl;
      });
      setCropSourceUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    } finally {
      setIsApplyingCrop(false);
    }
  }, []);

  const saveProfile = useCallback(async (): Promise<boolean> => {
    if (!canSave || !initialForm) return false;

    setIsSaving(true);

    try {
      let uploadedMediaAssetId: string | number | undefined;
      if (photoFile) {
        uploadedMediaAssetId = await uploadProfilePhoto(photoFile);
      }

      await updateMyIdentity({
        username: normalizedUsername,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || null,
      });

      await updateMyProfile({
        displayName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        bio: form.bio.trim(),
        isAnonymous: false,
        showFollowerCount: null,
        messagePermission: "all",
        ...(uploadedMediaAssetId !== undefined ? { profileMediaAssetId: uploadedMediaAssetId } : {}),
      });

      if (form.displayCommunityId !== initialForm.displayCommunityId) {
        await updateMyDisplayCommunity(normalizeIdForPayload(form.displayCommunityId));
      }

      if (form.displaySpecializationId !== initialForm.displaySpecializationId) {
        await updateMyDisplaySpecialization(normalizeIdForPayload(form.displaySpecializationId));
      }

      await fetchUserMe();
      try {
        await refreshCurrentUser();
      } catch {
        // Keep save success state even if store revalidation fails.
      }

      showToast({
        title: "Profile updated",
        message: "Your changes were saved.",
      });
      setShowExitPrompt(false);
      return true;
    } catch (error) {
      const parsed = parseApiError(error);
      showToast({
        title: titleForProfileError(parsed.code),
        message: messageForProfileError(parsed.code, parsed.message),
        tone: "error",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [canSave, form, initialForm, normalizedUsername, photoFile, showToast]);

  const handleSave = useCallback(async () => {
    await saveProfile();
  }, [saveProfile]);

  const handleSaveAndExit = useCallback(async () => {
    const saved = await saveProfile();
    if (!saved) return;
    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }
    navigate("/app/profile", { replace: true });
  }, [blocker, navigate, saveProfile]);

  const handleDiscardAndExit = useCallback(() => {
    setShowExitPrompt(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
      return;
    }
    navigate("/app/profile", { replace: true });
  }, [blocker, navigate]);

  const handleCancelExitPrompt = useCallback(() => {
    setShowExitPrompt(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  return (
    <AppLayout activeNavId="profile">
      <AppMobileHeader title="Edit Profile" showAction={false} showBack={false} />

      <section className="border-b border-border/70 bg-bg px-4 py-3">
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-text-secondary transition hover:text-strong"
            aria-label="Back"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-strong">Edit Profile</h1>
          <span className="h-10 w-10" aria-hidden="true" />
        </div>
      </section>

      {status === "loading" ? (
        <div className="space-y-4 bg-bg px-4 py-6">
          <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-bg-muted" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="space-y-3 bg-bg px-4 py-6">
          <p className="text-sm font-semibold text-strong">Unable to load edit profile.</p>
          <p className="text-sm text-text-secondary">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadInitialData()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {status === "idle" ? (
        <div className="bg-bg px-4 pb-8 pt-5">
          <div className="mx-auto w-full max-w-[560px]">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative h-24 w-24 overflow-visible rounded-full"
                aria-label="Change profile photo"
              >
                <span className="block h-24 w-24 overflow-hidden rounded-full bg-bg-muted">
                  <img
                    src={effectiveAvatarSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={handleAvatarImageError}
                  />
                </span>
                <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow">
                  <CameraIcon className="h-[18px] w-[18px]" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-[1.1rem] font-semibold text-secondary transition hover:opacity-90"
              >
                Tap to change profile photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handlePhotoPicked}
              />
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Username</span>
                <input
                  value={form.username}
                  onChange={(event) => handleInput("username", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {usernameStatus === "checking" ? (
                  <p className="mt-1.5 text-xs text-text-light">Checking username...</p>
                ) : usernameMessage ? (
                  <p className="mt-1.5 text-xs text-brand">{usernameMessage}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Display Community</span>
                <p className="mb-1.5 text-sm text-text-secondary">Choose a verified community to show on your profile and posts.</p>
                <select
                  value={form.displayCommunityId}
                  onChange={(event) => handleInput("displayCommunityId", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                >
                  <option value="">None</option>
                  {communities.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Display Specialization</span>
                <p className="mb-1.5 text-sm text-text-secondary">Choose a major or field to show on your profile.</p>
                <select
                  value={form.displaySpecializationId}
                  onChange={(event) => handleInput("displaySpecializationId", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                >
                  <option value="">None</option>
                  {specializations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">First Name</span>
                <input
                  value={form.firstName}
                  onChange={(event) => handleInput("firstName", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Last Name</span>
                <input
                  value={form.lastName}
                  onChange={(event) => handleInput("lastName", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Date of Birth</span>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => handleInput("dateOfBirth", event.currentTarget.value)}
                  className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(event) => handleInput("bio", event.currentTarget.value)}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
                />
              </label>
            </div>

            <button
              type="button"
              className="mt-8 w-full rounded-xl bg-brand px-4 py-3 text-[1.1rem] font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : null}

      <AvatarCropModal
        open={Boolean(cropSourceUrl)}
        imageSrc={cropSourceUrl}
        title="Adjust profile photo"
        isApplying={isApplyingCrop}
        onCancel={handleCancelCrop}
        onApply={handleApplyCrop}
      />

      {showExitPrompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onClick={handleCancelExitPrompt}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/70 bg-bg p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-strong">Save changes before leaving?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              You have unsaved edits. Would you like to save, or continue without saving?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleSaveAndExit()}
                disabled={isSaving || !canSave}
                className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save and leave"}
              </button>
              <button
                type="button"
                onClick={handleDiscardAndExit}
                disabled={isSaving}
                className="w-full rounded-xl border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue without saving
              </button>
              <button
                type="button"
                onClick={handleCancelExitPrompt}
                disabled={isSaving}
                className="w-full rounded-xl border border-border/70 bg-bg px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
