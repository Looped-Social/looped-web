import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "@/app/components/AppLayout/AppLayout";
import { useToast } from "@/app/components/AppToast/AppToast";
import {
  createPostAndHydrate,
  fetchPostableCommunities,
  type PostableCommunity,
  type PostMediaKind,
  uploadPostMediaFiles,
} from "@/lib/postCreateApi";
import { normalizeSettingsError } from "@/lib/settingsHttp";
import { useCurrentUserStore } from "@/stores/currentUserStore";

const MAX_POST_CHARACTERS = 280;
const MAX_PHOTOS = 4;
const MAX_VIDEOS = 1;
const MAX_POLL_OPTIONS = 20;
const MIN_POLL_OPTIONS = 2;
const MIN_POLL_END_SECONDS = 60;
const MAX_POLL_END_DAYS = 30;

type AsyncStatus = "idle" | "loading" | "ready" | "error";

type SelectedMedia = {
  id: string;
  file: File;
  kind: PostMediaKind;
  previewUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

type PollValidationResult = {
  valid: boolean;
  question: string;
  options: string[];
  closesAt?: string;
  error?: string;
};

type FileKind = PostMediaKind | "gif" | "unsupported";

const ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  community_not_verified: "You must be verified in this community to post.",
  specialization_not_joined: "Join this major or field to post.",
  user_not_verified: "You must be verified before posting.",
  verification_expired: "Your verification expired. Verify again to post.",
  content_required: "Add a caption, media, or a poll.",
  media_too_many: "Attach up to 4 photos or 1 video.",
  media_invalid: "That file type is not supported.",
  media_not_found: "Media is still processing. Please try posting again.",
  poll_options_invalid: "Poll options must be between 2 and 20.",
  poll_option_count_invalid: "Poll options must be between 2 and 20.",
  poll_option_duplicate: "Poll options must be unique.",
};

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-5.5-5.5L7 19" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function PollIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19h16" />
      <path d="M7 17V9" />
      <path d="M12 17V5" />
      <path d="M17 17v-6" />
    </svg>
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
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return false;
}

function isAnonymousProfile(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const profile = user as Record<string, unknown>;
  return normalizeBoolean(profile.isAnonymous ?? profile.is_anonymous);
}

function detectFileKind(file: File): FileKind {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime === "image/gif" || name.endsWith(".gif")) return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (!mime) {
    if (/\.(png|jpe?g|webp|heic|heif|bmp)$/i.test(name)) return "image";
    if (/\.(mp4|mov|m4v|webm)$/i.test(name)) return "video";
  }
  return "unsupported";
}

function buildMediaId(file: File): string {
  return `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read image dimensions."));
      img.src = objectUrl;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function getVideoMetadata(previewUrl: string): Promise<{
  width?: number;
  height?: number;
  durationSeconds?: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      resolve({
        width: Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? video.videoWidth : undefined,
        height: Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? video.videoHeight : undefined,
        durationSeconds: typeof duration === "number" && duration > 0 ? duration : undefined,
      });
    };
    video.onerror = () => reject(new Error("Unable to read video metadata."));
    video.src = previewUrl;
  });
}

function parseCreateErrorMessage(error: unknown): string {
  const normalized = normalizeSettingsError(error);
  if (ERROR_MESSAGES_BY_CODE[normalized.code]) return ERROR_MESSAGES_BY_CODE[normalized.code];
  return normalized.message || "We couldn't publish your post right now.";
}

function maybeNumber(value: string): string | number {
  const parsed = Number(value);
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  return value;
}

function toIsoDate(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function validatePoll({
  enabled,
  question,
  options,
  hasEndDate,
  endDateLocal,
}: {
  enabled: boolean;
  question: string;
  options: string[];
  hasEndDate: boolean;
  endDateLocal: string;
}): PollValidationResult {
  if (!enabled) {
    return {
      valid: true,
      question: "",
      options: [],
    };
  }

  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    return {
      valid: false,
      question: normalizedQuestion,
      options: [],
      error: "Poll question is required.",
    };
  }

  const normalizedOptions = options.map((option) => option.trim()).filter((option) => option.length > 0);
  if (normalizedOptions.length < MIN_POLL_OPTIONS || normalizedOptions.length > MAX_POLL_OPTIONS) {
    return {
      valid: false,
      question: normalizedQuestion,
      options: normalizedOptions,
      error: `Poll needs ${MIN_POLL_OPTIONS}-${MAX_POLL_OPTIONS} options.`,
    };
  }

  const uniqueCount = new Set(normalizedOptions.map((option) => option.toLowerCase())).size;
  if (uniqueCount !== normalizedOptions.length) {
    return {
      valid: false,
      question: normalizedQuestion,
      options: normalizedOptions,
      error: "Poll options must be unique.",
    };
  }

  let closesAt: string | undefined;
  if (hasEndDate) {
    closesAt = toIsoDate(endDateLocal);
    if (!closesAt) {
      return {
        valid: false,
        question: normalizedQuestion,
        options: normalizedOptions,
        error: "Choose a valid end date.",
      };
    }

    const closesAtMs = new Date(closesAt).getTime();
    const minMs = Date.now() + MIN_POLL_END_SECONDS * 1000;
    const maxMs = Date.now() + MAX_POLL_END_DAYS * 24 * 60 * 60 * 1000;

    if (closesAtMs < minMs || closesAtMs > maxMs) {
      return {
        valid: false,
        question: normalizedQuestion,
        options: normalizedOptions,
        error: "End date must be 1 minute to 30 days from now.",
      };
    }
  }

  return {
    valid: true,
    question: normalizedQuestion,
    options: normalizedOptions,
    closesAt,
  };
}

function validateSelectedMediaState(media: SelectedMedia[]): { valid: true } | { valid: false; message: string } {
  if (media.length === 0) return { valid: true };

  const imageCount = media.filter((item) => item.kind === "image").length;
  const videoCount = media.filter((item) => item.kind === "video").length;

  if (videoCount > MAX_VIDEOS) {
    return { valid: false, message: "Attach only one video per post." };
  }

  if (imageCount > 0 && videoCount > 0) {
    return { valid: false, message: "Photos and video cannot be mixed in the same post." };
  }

  if (videoCount === 0 && imageCount > MAX_PHOTOS) {
    return { valid: false, message: "Attach up to 4 photos." };
  }

  return { valid: true };
}

export function AppCreatePostPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useCurrentUserStore({ autoLoad: true });

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMediaRef = useRef<SelectedMedia[]>([]);

  const [communitiesStatus, setCommunitiesStatus] = useState<AsyncStatus>("idle");
  const [communities, setCommunities] = useState<PostableCommunity[]>([]);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [showCommunityPostingInfo, setShowCommunityPostingInfo] = useState(false);

  const [content, setContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);

  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollHasEndDate, setPollHasEndDate] = useState(false);
  const [pollEndDateLocal, setPollEndDateLocal] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const anonymousBlocked = isAnonymousProfile(user);

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => {
    return () => {
      for (const media of selectedMediaRef.current) {
        URL.revokeObjectURL(media.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    setCommunitiesStatus("loading");
    setCommunitiesError(null);

    void fetchPostableCommunities()
      .then((items) => {
        if (!active) return;
        setCommunities(items);
        setCommunitiesStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        const normalized = normalizeSettingsError(error);
        setCommunities([]);
        setCommunitiesStatus("error");
        setCommunitiesError(normalized.message || "Unable to load your communities.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (communities.length === 0) {
      setSelectedCommunityId("");
      return;
    }
    const hasCurrent = communities.some((community) => community.id === selectedCommunityId);
    if (!hasCurrent) {
      setSelectedCommunityId(communities[0].id);
    }
  }, [communities, selectedCommunityId]);

  const pollValidation = useMemo(
    () =>
      validatePoll({
        enabled: pollEnabled,
        question: pollQuestion,
        options: pollOptions,
        hasEndDate: pollHasEndDate,
        endDateLocal: pollEndDateLocal,
      }),
    [pollEnabled, pollQuestion, pollOptions, pollHasEndDate, pollEndDateLocal]
  );

  const characterCount = content.length;
  const charactersRemaining = MAX_POST_CHARACTERS - characterCount;
  const hasText = content.trim().length > 0;
  const hasMedia = selectedMedia.length > 0;
  const mediaStateValidation = useMemo(() => validateSelectedMediaState(selectedMedia), [selectedMedia]);
  const hasValidPoll = pollEnabled && pollValidation.valid;
  const hasPostBody = hasText || hasMedia || hasValidPoll;
  const hasNoPostableCommunities = communitiesStatus === "ready" && communities.length === 0;
  const overCharacterLimit = characterCount > MAX_POST_CHARACTERS;

  const canSubmit =
    !isSubmitting &&
    !anonymousBlocked &&
    !hasNoPostableCommunities &&
    Boolean(selectedCommunityId) &&
    !overCharacterLimit &&
    mediaStateValidation.valid &&
    hasPostBody &&
    (!pollEnabled || pollValidation.valid);

  const handleCancel = useCallback(() => {
    if (isSubmitting) return;
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app", { replace: true });
  }, [isSubmitting, navigate]);

  const removeSelectedMedia = useCallback((mediaId: string) => {
    setSelectedMedia((previous) => {
      const target = previous.find((media) => media.id === mediaId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((media) => media.id !== mediaId);
    });
  }, []);

  const addPollOption = useCallback(() => {
    setPollOptions((previous) => {
      if (previous.length >= MAX_POLL_OPTIONS) return previous;
      return [...previous, ""];
    });
  }, []);

  const removePollOption = useCallback((index: number) => {
    setPollOptions((previous) => {
      if (previous.length <= MIN_POLL_OPTIONS) return previous;
      return previous.filter((_, optionIndex) => optionIndex !== index);
    });
  }, []);

  const updatePollOption = useCallback((index: number, value: string) => {
    setPollOptions((previous) => previous.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }, []);

  const togglePoll = useCallback(() => {
    setPollEnabled((previous) => !previous);
    setSubmitError(null);
  }, []);

  const validateMediaSelection = useCallback(
    (files: File[]): { valid: true } | { valid: false; message: string } => {
      if (files.length === 0) return { valid: true };
      const existingImageCount = selectedMedia.filter((media) => media.kind === "image").length;
      const existingVideoCount = selectedMedia.filter((media) => media.kind === "video").length;

      let incomingImageCount = 0;
      let incomingVideoCount = 0;

      for (const file of files) {
        const kind = detectFileKind(file);
        if (kind === "gif") {
          return { valid: false, message: "GIF uploads are not supported." };
        }
        if (kind === "unsupported") {
          return { valid: false, message: "Only photos and videos can be attached." };
        }
        if (kind === "image") incomingImageCount += 1;
        if (kind === "video") incomingVideoCount += 1;
      }

      if (incomingVideoCount > MAX_VIDEOS || existingVideoCount + incomingVideoCount > MAX_VIDEOS) {
        return { valid: false, message: "Attach only one video per post." };
      }

      const willHaveAnyVideo = existingVideoCount + incomingVideoCount > 0;
      const willHaveAnyImage = existingImageCount + incomingImageCount > 0;
      if (willHaveAnyVideo && willHaveAnyImage) {
        return { valid: false, message: "Photos and video cannot be mixed in the same post." };
      }

      if (!willHaveAnyVideo && existingImageCount + incomingImageCount > MAX_PHOTOS) {
        return { valid: false, message: "Attach up to 4 photos." };
      }

      return { valid: true };
    },
    [selectedMedia]
  );

  const appendMediaFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const validation = validateMediaSelection(files);
      if (!validation.valid) {
        showToast({
          kind: "error",
          text: validation.message,
        });
        return;
      }

      const nextMedia: SelectedMedia[] = [];

      for (const file of files) {
        const kind = detectFileKind(file);
        if (kind !== "image" && kind !== "video") continue;

        const previewUrl = URL.createObjectURL(file);
        const media: SelectedMedia = {
          id: buildMediaId(file),
          file,
          kind,
          previewUrl,
        };

        try {
          if (kind === "image") {
            const dimensions = await getImageDimensions(file);
            media.width = dimensions.width;
            media.height = dimensions.height;
          } else {
            const metadata = await getVideoMetadata(previewUrl);
            media.width = metadata.width;
            media.height = metadata.height;
            media.durationSeconds = metadata.durationSeconds;
          }
        } catch {
          // Metadata improves callback payload, but upload can still proceed without it.
        }

        nextMedia.push(media);
      }

      setSelectedMedia((previous) => [...previous, ...nextMedia]);
      setSubmitError(null);
    },
    [showToast, validateMediaSelection]
  );

  const onPhotoFilesSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? [...event.target.files] : [];
      event.target.value = "";
      await appendMediaFiles(files);
    },
    [appendMediaFiles]
  );

  const onMediaFilesSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? [...event.target.files] : [];
      event.target.value = "";
      await appendMediaFiles(files);
    },
    [appendMediaFiles]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (anonymousBlocked) {
        setSubmitError("Anonymous profiles cannot create posts on web.");
        return;
      }

      if (!selectedCommunityId) {
        setSubmitError("Choose a community before posting.");
        return;
      }

      if (overCharacterLimit) {
        setSubmitError(`Post text must be ${MAX_POST_CHARACTERS} characters or fewer.`);
        return;
      }

      if (pollEnabled && !pollValidation.valid) {
        setSubmitError(pollValidation.error ?? "Please finish your poll before posting.");
        return;
      }

      if (!hasPostBody) {
        setSubmitError("Add a caption, media, or a poll.");
        return;
      }

      if (!mediaStateValidation.valid) {
        setSubmitError(mediaStateValidation.message);
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const uploadedMedia = await uploadPostMediaFiles(
          selectedMedia.map((media) => ({
            file: media.file,
            kind: media.kind,
            width: media.width ?? null,
            height: media.height ?? null,
            durationSeconds: media.durationSeconds ?? null,
          }))
        );

        const mediaAssetIds = uploadedMedia.map((media) => media.mediaAssetId);
        await createPostAndHydrate({
          content: content.trim(),
          communityId: maybeNumber(selectedCommunityId),
          mediaAssetIds,
          poll: pollEnabled
            ? {
                question: pollValidation.question,
                options: pollValidation.options,
                maxSelections: 1,
                closesAt: pollValidation.closesAt,
              }
            : undefined,
        });

        showToast({
          kind: "success",
          text: "Post published.",
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("looped:content-refresh"));
        }
        navigate("/app");
      } catch (error) {
        const message = parseCreateErrorMessage(error);
        setSubmitError(message);
        showToast({
          kind: "error",
          text: message,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      anonymousBlocked,
      content,
      hasPostBody,
      isSubmitting,
      mediaStateValidation,
      navigate,
      overCharacterLimit,
      pollEnabled,
      pollValidation,
      selectedCommunityId,
      selectedMedia,
      showToast,
    ]
  );

  return (
    <AppLayout activeNavId="create">
      <form onSubmit={handleSubmit}>
        <header className="border-b border-border/70 bg-bg">
          <div className="mx-auto flex w-full max-w-[560px] items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="inline-flex items-center text-base font-medium text-secondary transition hover:text-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Cancel</span>
            </button>
            <h1 className="text-xl font-semibold text-strong">New Post</h1>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-text-secondary"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[560px] space-y-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="composer-community" className="text-[1rem] font-semibold text-text-secondary">
                Community
              </label>
              <button
                type="button"
                onClick={() => setShowCommunityPostingInfo((previous) => !previous)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-bg-muted text-sm font-semibold text-text-secondary transition hover:border-brand/40 hover:text-brand"
                aria-expanded={showCommunityPostingInfo}
                aria-controls="create-post-community-help"
                aria-label="Community posting requirements"
              >
                ?
              </button>
            </div>
            {showCommunityPostingInfo ? (
              <div
                id="create-post-community-help"
                className="rounded-xl border border-border/70 bg-bg-muted px-3 py-2.5 text-sm leading-relaxed text-text-secondary"
              >
                <p>You can only post in communities where you are verified.</p>
                <p className="mt-1.5">
                  You cannot verify in the web app at this time. Download the iOS app to verify. We are working on
                  web verification support.
                </p>
                <p className="mt-1.5">Anonymous posting is not supported on web right now.</p>
              </div>
            ) : null}
            <select
              id="composer-community"
              value={selectedCommunityId}
              onChange={(event) => setSelectedCommunityId(event.target.value)}
              disabled={communitiesStatus === "loading" || communities.length === 0 || isSubmitting}
              className="w-full rounded-xl border border-border/70 bg-bg-muted px-3 py-2.5 text-[1.03rem] text-strong outline-none transition focus:border-brand/45 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {communitiesStatus === "loading" ? <option value="">Loading communities...</option> : null}
              {communities.length > 0
                ? communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))
                : null}
              {communitiesStatus !== "loading" && communities.length === 0 ? (
                <option value="">No postable communities</option>
              ) : null}
            </select>
            {communitiesError ? <p className="text-sm text-brand">{communitiesError}</p> : null}
            {hasNoPostableCommunities ? (
              <p className="text-sm text-text-secondary">Verification required in mobile app.</p>
            ) : null}
          </section>

          <section className="space-y-1.5">
            <label htmlFor="composer-text" className="text-[1rem] font-semibold text-text-secondary">
              What&apos;s happening?
            </label>
            <textarea
              id="composer-text"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={MAX_POST_CHARACTERS}
              placeholder="Share your thoughts..."
              rows={6}
              disabled={isSubmitting}
              className="w-full resize-y rounded-2xl border border-border/70 bg-bg-muted px-3 py-3 text-[1.02rem] leading-relaxed text-strong outline-none transition placeholder:text-text-light focus:border-brand/45 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-75"
            />
          </section>

          <section className="flex flex-wrap gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPhotoFilesSelected}
              className="hidden"
            />
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={onMediaFilesSelected}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isSubmitting}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-bg-muted px-3 py-2 text-sm font-semibold text-strong transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PhotoIcon className="h-4 w-4" />
              <span>Photo</span>
            </button>

            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              disabled={isSubmitting}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-bg-muted px-3 py-2 text-sm font-semibold text-strong transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
            >
              <CameraIcon className="h-4 w-4" />
              <span>Camera/File</span>
            </button>

            <button
              type="button"
              onClick={togglePoll}
              disabled={isSubmitting}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                pollEnabled
                  ? "border-brand/30 bg-brand/8 text-brand"
                  : "border-border/70 bg-bg-muted text-strong hover:border-brand/40 hover:text-brand"
              }`}
            >
              <PollIcon className="h-4 w-4" />
              <span>{pollEnabled ? "Remove Poll" : "Poll"}</span>
            </button>
          </section>

          {pollEnabled ? (
            <section className="rounded-2xl border border-border/70 bg-bg-muted px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-base font-semibold text-brand">Poll</p>
                <button
                  type="button"
                  onClick={togglePoll}
                  disabled={isSubmitting}
                  className="text-sm font-semibold text-secondary transition hover:text-secondary/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Remove
                </button>
              </div>

              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-text-secondary" htmlFor="poll-question">
                  Question
                </label>
                <input
                  id="poll-question"
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Ask something..."
                  className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2.5 text-[1rem] text-strong outline-none transition placeholder:text-text-light focus:border-brand/45 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-75"
                />

                <p className="pt-1 text-sm font-semibold text-text-secondary">Options</p>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={`poll-option-${index}`} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(event) => updatePollOption(index, event.target.value)}
                        disabled={isSubmitting}
                        placeholder={`Option ${index + 1}`}
                        className="min-h-11 w-full rounded-xl border border-border/70 bg-bg px-3 py-2.5 text-[1rem] text-strong outline-none transition placeholder:text-text-light focus:border-brand/45 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-75"
                      />
                      {pollOptions.length > MIN_POLL_OPTIONS ? (
                        <button
                          type="button"
                          onClick={() => removePollOption(index)}
                          disabled={isSubmitting}
                          aria-label={`Remove option ${index + 1}`}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addPollOption}
                  disabled={isSubmitting || pollOptions.length >= MAX_POLL_OPTIONS}
                  className="mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-bg px-3 py-2 text-base font-semibold text-brand transition hover:bg-brand/8 disabled:cursor-not-allowed disabled:text-text-light"
                >
                  + Add option
                </button>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-text-secondary">Set end date (optional)</span>
                    <input
                      type="checkbox"
                      checked={pollHasEndDate}
                      onChange={(event) => setPollHasEndDate(event.target.checked)}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-border text-secondary focus:ring-secondary/30 disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </label>
                  {pollHasEndDate ? (
                    <input
                      type="datetime-local"
                      value={pollEndDateLocal}
                      onChange={(event) => setPollEndDateLocal(event.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-border/70 bg-bg px-3 py-2.5 text-[0.95rem] text-strong outline-none transition focus:border-brand/45 focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-75"
                    />
                  ) : null}
                </div>

                {pollEnabled && !pollValidation.valid && pollValidation.error ? (
                  <p className="text-sm text-brand">{pollValidation.error}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {selectedMedia.length > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-text-secondary">Media</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedMedia.map((media) => (
                  <article key={media.id} className="relative w-28 shrink-0 overflow-hidden rounded-xl border border-border/70">
                    {media.kind === "image" ? (
                      <img src={media.previewUrl} alt={media.file.name} className="h-24 w-full object-cover" />
                    ) : (
                      <video src={media.previewUrl} className="h-24 w-full object-cover" muted playsInline />
                    )}
                    <button
                      type="button"
                      onClick={() => removeSelectedMedia(media.id)}
                      disabled={isSubmitting}
                      aria-label={`Remove ${media.file.name}`}
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex items-center justify-end">
            <p className={`text-sm font-medium ${overCharacterLimit ? "text-brand" : "text-text-secondary"}`}>
              {charactersRemaining}
            </p>
          </section>

          {anonymousBlocked ? (
            <p className="rounded-xl border border-border/70 bg-bg-muted px-3 py-2 text-sm text-text-secondary">
              Anonymous profiles cannot create posts on web.
            </p>
          ) : null}

          {submitError ? (
            <p className="rounded-xl border border-brand/25 bg-brand/8 px-3 py-2 text-sm text-brand">{submitError}</p>
          ) : null}
        </main>
      </form>
    </AppLayout>
  );
}
