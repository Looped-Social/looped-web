import { type ChangeEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

import { CameraIcon } from "@/app/components/AppIcons/AppIcons";
import { AvatarCropModal } from "@/app/components/AvatarCropModal/AvatarCropModal";
import { dismissProfileCompletionPrompt, saveProfileCompletionDraft } from "@/lib/onboardingApi";

const DEFAULT_PROFILE_IMAGE_SRC = "/icons/profile/default-avatar.svg";

type FinishProfilePromptProps = {
  open: boolean;
  onComplete: () => Promise<void> | void;
  defaultBio?: string;
  defaultAvatarUrl?: string;
};

export function FinishProfilePrompt({
  open,
  onComplete,
  defaultBio = "",
  defaultAvatarUrl,
}: FinishProfilePromptProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [bio, setBio] = useState(defaultBio);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAvatarSrc = photoPreviewUrl ?? avatarUrl ?? DEFAULT_PROFILE_IMAGE_SRC;

  useEffect(() => {
    if (!open) return;
    setBio(defaultBio);
    setAvatarUrl(defaultAvatarUrl);
    setPhotoFile(null);
    setError(null);
    setBusy(false);
    setIsApplyingCrop(false);
    setPhotoPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }, [defaultAvatarUrl, defaultBio, open]);

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

  const handleAvatarImageError = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = DEFAULT_PROFILE_IMAGE_SRC;
  }, []);

  const handlePhotoPicked = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setError(null);
    setCropSourceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }, []);

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
      setError(null);
    } finally {
      setIsApplyingCrop(false);
    }
  }, []);

  if (!open) return null;

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveProfileCompletionDraft({
        bio: bio.trim(),
        profilePhotoFile: photoFile,
      });
      await dismissProfileCompletionPrompt();
      await onComplete();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to save profile.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    setError(null);
    try {
      await dismissProfileCompletionPrompt();
      await onComplete();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to dismiss prompt.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-bg p-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:p-6">
          <h2 className="text-xl font-semibold text-strong md:text-2xl">Finish setting up your profile</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Add your profile photo and bio now, or skip and do it later from settings.
          </p>

          <div className="mt-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-24 w-24 overflow-visible rounded-full"
              aria-label="Change profile photo"
              disabled={busy}
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
              className="mt-3 text-[1.1rem] font-semibold text-secondary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
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

          <label className="mt-6 block">
            <span className="mb-2 block text-[1.08rem] font-semibold text-strong">Bio</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.currentTarget.value)}
              rows={4}
              className="w-full resize-y rounded-xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] text-strong outline-none transition focus:border-brand/50"
              placeholder="Tell people about yourself"
            />
          </label>

          {error ? <p className="mt-3 text-sm text-brand">{error}</p> : null}

          <div className="mt-6 space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="w-full rounded-xl bg-brand px-4 py-3 text-[1.1rem] font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save and continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSkip}
              className="w-full rounded-xl border border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>

      <AvatarCropModal
        open={Boolean(cropSourceUrl)}
        imageSrc={cropSourceUrl}
        title="Adjust profile photo"
        isApplying={isApplyingCrop}
        onCancel={handleCancelCrop}
        onApply={handleApplyCrop}
      />
    </>
  );
}
