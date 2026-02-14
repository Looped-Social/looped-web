import { ApiError, getApiBase, notifyAuthGateFromHttpError } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export type CommunityRequestPayload = {
  type: "company" | "school";
  name: string;
  about: string;
  imageKey?: string;
};

export type CommunityRequestResponse = {
  id: number;
  status: string;
};

type MediaPresignResponse = {
  key?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  callbackSignature?: string;
  url?: string;
  fields?: Record<string, string>;
  imageKey?: string;
  method?: string;
};

export class CommunityApiError extends ApiError {}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    notifyAuthGateFromHttpError({ status: response.status, details, source: "communityApi" });
    throw new CommunityApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function uploadWithPresign(presign: MediaPresignResponse, file: File) {
  if (presign.url && presign.fields) {
    const formData = new FormData();
    Object.entries(presign.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append("file", file);

    const uploadResponse = await fetch(presign.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Unable to upload image.");
    }

    return;
  }

  if (presign.uploadUrl) {
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: presign.method ?? "PUT",
      headers: presign.headers ?? { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Unable to upload image.");
    }

    return;
  }

  throw new Error("Unable to upload image.");
}

export async function uploadCommunityImage(file: File): Promise<string> {
  const normalizedFile = await normalizeCommunityRequestImage(file);

  const presign = await authFetch<MediaPresignResponse>("/v1/media/presign", {
    method: "POST",
    body: JSON.stringify({
      contentType: normalizedFile.type || file.type,
      sizeBytes: normalizedFile.size,
    }),
  });

  const key = presign.key ?? presign.imageKey ?? presign.fields?.key;
  if (!key) {
    throw new Error("Upload failed. Missing media key.");
  }

  await uploadWithPresign(presign, normalizedFile);

  const dimensions = await getImageDimensions(normalizedFile);
  await authFetch("/v1/media/callback", {
    method: "POST",
    headers: {
      ...(presign.callbackSignature ? { "X-Media-Signature": presign.callbackSignature } : {}),
    },
    body: JSON.stringify({
      key,
      mimeType: normalizedFile.type || file.type,
      width: dimensions.width,
      height: dimensions.height,
      durationSeconds: null,
    }),
  });

  return key;
}

async function normalizeCommunityRequestImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    const hasAlpha = detectAlphaChannel(context, width, height);
    const targetMime = hasAlpha ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(canvas, targetMime, hasAlpha ? undefined : 0.9);
    if (!blob) return file;

    const extension = hasAlpha ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "community-image";
    return new File([blob], `${baseName}.${extension}`, { type: targetMime });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

function detectAlphaChannel(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 255) return true;
  }
  return false;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function submitCommunityRequest(
  payload: CommunityRequestPayload
): Promise<CommunityRequestResponse> {
  return authFetch<CommunityRequestResponse>("/v1/community-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      return { width, height };
    }

    const image = await loadImage(objectUrl);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read image dimensions."));
    img.src = src;
  });
}
