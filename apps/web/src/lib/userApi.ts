import { ApiError, getApiBase } from "./apiBase";
import { getFirebaseIdToken } from "./firebaseClient";

export class UserApiError extends ApiError {}

export type UserMe = {
  id?: number | string;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  display_name?: string | null;
};

async function userFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new UserApiError(response.status, details || "Request failed.", details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchUserMe(): Promise<UserMe> {
  return userFetch<UserMe>("/v1/me");
}

export async function deactivateUser(): Promise<void> {
  await userFetch("/v1/users/me/deactivate", { method: "POST" });
}

export async function deleteUser(): Promise<void> {
  await userFetch("/v1/users/me/delete", { method: "POST" });
}
