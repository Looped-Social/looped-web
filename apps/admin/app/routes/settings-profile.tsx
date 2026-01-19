import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  AdminApiError,
  callbackMediaUpload,
  fetchAdminProfileSettings,
  presignMediaUpload,
  updateAdminProfileSettings,
} from "../lib/adminApi";
import type { AdminRouteContext } from "./admin";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : size < 10 ? 1 : 0;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // fall through
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

function getProfileSettingsErrorMessage(err: unknown): string {
  if (err instanceof TypeError && err.message === "Failed to fetch") {
    return "Upload request was blocked (likely CORS). Backend must allow headers X-Actor and X-Media-Signature on /v1/media/callback.";
  }
  if (err instanceof AdminApiError) {
    const code =
      err.errorCode ??
      (err.details?.includes("cdn_not_configured") ? "cdn_not_configured" : undefined);
    switch (code) {
      case "media_asset_not_found":
        return "That media asset id was not found.";
      case "invalid_default_profile_image_url":
        return "Enter a valid image URL (https://...) that points to an image file.";
      case "invalid_profile_image":
        return "That media asset isn't a valid profile image (must be an image).";
      case "cdn_not_configured":
        return "CDN is not configured for media assets (missing cloudfront.domain).";
      case "content_type_required":
        return "Upload requires a valid content type.";
      case "unsupported_content_type":
        return "Unsupported image type. Use PNG, JPEG, or WebP.";
      case "size_exceeds_limit":
        return "Image file is too large.";
      case "invalid_signature":
        return "Upload callback signature is invalid (backend media.callbackSecret mismatch).";
      case "user_not_provisioned":
        return "Upload callback requires a provisioned user (try using X-Actor: anon).";
      case "unauthorized":
        return "Upload callback was unauthorized.";
      default:
        break;
    }
    if (err.status === 403) return "You do not have permission to update this setting.";
  }
  return err instanceof Error ? err.message : "Unable to update profile settings.";
}

export default function ProfileSettingsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canManage = admin.permissions.includes("create_community");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [assetIdInput, setAssetIdInput] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const hasDefault = useMemo(() => Boolean(currentUrl?.trim()), [currentUrl]);
  const previewUrl = useMemo(() => currentUrl?.trim() || null, [currentUrl]);
  const uploadPreviewUrl = useMemo(() => {
    if (!uploadFile) return null;
    return URL.createObjectURL(uploadFile);
  }, [uploadFile]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  useEffect(() => {
    if (!canManage) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    void (async () => {
      try {
        const res = await fetchAdminProfileSettings();
        setCurrentUrl(res.default_profile_image_url);
        setUrlInput(res.default_profile_image_url ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load profile settings.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [canManage]);

  const handleSetByUrl = async () => {
    if (!canManage) return;
    setSuccess(null);
    setError(null);

    const url = urlInput.trim();
    if (!url) {
      setError("Enter an image URL, or use Clear to remove the default.");
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        setError("Image URL must start with https://");
        return;
      }
    } catch {
      setError("Enter a valid image URL (https://...)");
      return;
    }

    if (!window.confirm("Set the app-wide default profile picture to this URL?")) return;

    setIsSaving(true);
    try {
      const res = await updateAdminProfileSettings({ defaultProfileImageUrl: url });
      setCurrentUrl(res.default_profile_image_url);
      setUrlInput(res.default_profile_image_url ?? "");
      setAssetIdInput("");
      setSuccess("Saved.");
    } catch (err) {
      setError(getProfileSettingsErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetByAssetId = async () => {
    if (!canManage) return;
    setSuccess(null);
    setError(null);

    const raw = assetIdInput.trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a valid numeric media asset id.");
      return;
    }

    if (!window.confirm(`Set the default profile picture from media asset #${parsed}?`)) return;

    setIsSaving(true);
    try {
      const res = await updateAdminProfileSettings({ profileMediaAssetId: parsed });
      setCurrentUrl(res.default_profile_image_url);
      setUrlInput(res.default_profile_image_url ?? "");
      setAssetIdInput("");
      setSuccess("Saved.");
    } catch (err) {
      setError(getProfileSettingsErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAndSetDefault = async () => {
    if (!canManage) return;
    setSuccess(null);
    setError(null);

    const file = uploadFile;
    if (!file) {
      setError("Choose an image file to upload.");
      return;
    }
    if (!file.type || !ALLOWED_IMAGE_CONTENT_TYPES.has(file.type)) {
      setError("Unsupported image type. Use PNG, JPEG, or WebP.");
      return;
    }
    if (!window.confirm("Upload this image and set it as the app-wide default profile picture?")) return;

    setIsSaving(true);
    try {
      const presign = await presignMediaUpload({ contentType: file.type, sizeBytes: file.size });

      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      if (!uploadResponse.ok) {
        const text = await uploadResponse.text().catch(() => "");
        throw new Error(
          `S3 upload failed (${uploadResponse.status}).${text ? ` ${text}` : ""}`.trim()
        );
      }

      const dimensions = await getImageDimensions(file);
      const callback = await callbackMediaUpload(
        {
          key: presign.key,
          mimeType: file.type,
          width: dimensions?.width,
          height: dimensions?.height,
        },
        { callbackSignature: presign.callbackSignature }
      );
      if (!callback || typeof callback.id !== "number") {
        throw new Error("Upload callback did not return a media asset id.");
      }

      const res = await updateAdminProfileSettings({ profileMediaAssetId: callback.id });
      setCurrentUrl(res.default_profile_image_url);
      setUrlInput(res.default_profile_image_url ?? "");
      setAssetIdInput("");
      setSuccess("Uploaded and saved.");
    } catch (err) {
      setError(getProfileSettingsErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!canManage) return;
    setSuccess(null);
    setError(null);
    if (!hasDefault) {
      setSuccess("No default profile picture is set.");
      return;
    }
    if (!window.confirm("Clear the app-wide default profile picture?")) return;

    setIsSaving(true);
    try {
      const res = await updateAdminProfileSettings({ clearDefaultProfileImage: true });
      setCurrentUrl(res.default_profile_image_url);
      setUrlInput("");
      setAssetIdInput("");
      setSuccess("Cleared.");
    } catch (err) {
      setError(getProfileSettingsErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase text-text-light">Settings</p>
        <h1 className="text-2xl font-semibold text-strong">Default profile picture</h1>
        <p className="text-sm text-text-secondary">
          Sets the app-wide fallback image used when a user has not uploaded a profile picture.
        </p>
      </header>

      {!canManage && (
        <div className="rounded-2xl border border-border bg-bg px-5 py-5 text-sm text-text-secondary">
          You do not have permission to manage profile settings.
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-border bg-bg px-5 py-5">
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-text-light">Current</p>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-bg-muted">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Default profile"
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">
                      {hasDefault ? "Custom default set" : "No default set"}
                    </p>
                    <p className="mt-1 truncate text-xs text-text-light">
                      {currentUrl ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-text-light" htmlFor="default-profile-url">
                    Set by URL
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      id="default-profile-url"
                      type="url"
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      disabled={isLoading || isSaving}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="https://cdn.example.com/default-avatar.png"
                    />
                    <button
                      type="button"
                      onClick={handleSetByUrl}
                      disabled={isLoading || isSaving}
                      className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save URL"}
                    </button>
                  </div>
                  <p className="text-xs text-text-light">
                    Must be an https URL that points to an image.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-text-light" htmlFor="default-profile-asset-id">
                    Set by media asset id
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      id="default-profile-asset-id"
                      inputMode="numeric"
                      value={assetIdInput}
                      onChange={(event) => setAssetIdInput(event.target.value)}
                      disabled={isLoading || isSaving}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-xs"
                      placeholder="123"
                    />
                    <button
                      type="button"
                      onClick={handleSetByAssetId}
                      disabled={isLoading || isSaving}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Use asset"}
                    </button>
                  </div>
                  <p className="text-xs text-text-light">
                    Requires CDN configuration and an image asset.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-text-light">Upload image</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full border border-border bg-bg-muted">
                        {uploadPreviewUrl ? (
                          <img
                            src={uploadPreviewUrl}
                            alt="Upload preview"
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {uploadFile?.name ?? "No file selected"}
                        </p>
                        {uploadFile && (
                          <p className="text-xs text-text-light">
                            {uploadFile.type || "unknown type"} • {formatBytes(uploadFile.size)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                        disabled={isLoading || isSaving}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setUploadFile(file);
                        }}
                        className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-lg file:border file:border-border file:bg-bg file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-bg-muted disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={handleUploadAndSetDefault}
                        disabled={isLoading || isSaving || !uploadFile}
                        className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? "Uploading..." : "Upload & set"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-light">
                    Uses the shared presign → S3 PUT → callback flow and then sets the default by media asset id.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isLoading || isSaving}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear default
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
