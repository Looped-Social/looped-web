import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export type CommunityRequestPayload = {
  type: "company" | "school" | "sector" | "profession";
  name: string;
  about?: string;
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
  const presign = await authFetch<MediaPresignResponse>("/v1/media/presign", {
    method: "POST",
    body: JSON.stringify({
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });

  const key = presign.key ?? presign.imageKey ?? presign.fields?.key;
  if (!key) {
    throw new Error("Upload failed. Missing media key.");
  }

  await uploadWithPresign(presign, file);

  const dimensions = await getImageDimensions(file);
  await authFetch("/v1/media/callback", {
    method: "POST",
    headers: {
      ...(presign.callbackSignature ? { "X-Media-Signature": presign.callbackSignature } : {}),
    },
    body: JSON.stringify({
      key,
      mimeType: file.type,
      width: dimensions.width,
      height: dimensions.height,
      durationSeconds: null,
    }),
  });

  return key;
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
