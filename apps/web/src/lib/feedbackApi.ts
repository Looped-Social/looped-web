import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export type FeedbackPayload = {
  title: string;
  message: string;
  email?: string;
};

export type FeedbackResponse = {
  id: number;
  status: string;
};

export class FeedbackApiError extends ApiError {}

async function getOptionalToken(): Promise<string | null> {
  try {
    return await getFirebaseIdToken();
  } catch {
    return null;
  }
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
  const base = getApiBase();
  const token = await getOptionalToken();
  const response = await fetch(`${base}/v1/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new FeedbackApiError(response.status, details || "Request failed.", details);
  }

  return response.json() as Promise<FeedbackResponse>;
}
