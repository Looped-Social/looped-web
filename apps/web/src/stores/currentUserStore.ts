import { useEffect, useSyncExternalStore } from "react";

import { fetchMySettingsProfile, type UserSettingsProfile } from "@/lib/settingsApi";
import { normalizeSettingsError, type NormalizedApiError } from "@/lib/settingsHttp";

export type CurrentUserAsyncState = "idle" | "loading" | "success" | "error";

export type CurrentUserStoreState = {
  status: CurrentUserAsyncState;
  user: UserSettingsProfile | null;
  error: NormalizedApiError | null;
  lastUpdatedAt: number | null;
};

const listeners = new Set<() => void>();

let state: CurrentUserStoreState = {
  status: "idle",
  user: null,
  error: null,
  lastUpdatedAt: null,
};

let pendingLoad: Promise<UserSettingsProfile> | null = null;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(updater: (current: CurrentUserStoreState) => CurrentUserStoreState) {
  state = updater(state);
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CurrentUserStoreState {
  return state;
}

export async function loadCurrentUser({ force = false }: { force?: boolean } = {}): Promise<UserSettingsProfile> {
  if (pendingLoad && !force) return pendingLoad;

  setState((current) => ({
    ...current,
    status: "loading",
    error: null,
  }));

  pendingLoad = fetchMySettingsProfile();
  try {
    const profile = await pendingLoad;
    setState(() => ({
      status: "success",
      user: profile,
      error: null,
      lastUpdatedAt: Date.now(),
    }));
    return profile;
  } catch (error) {
    const normalized = normalizeSettingsError(error);
    setState((current) => ({
      ...current,
      status: "error",
      error: normalized,
    }));
    throw error;
  } finally {
    pendingLoad = null;
  }
}

export async function refreshCurrentUser(): Promise<UserSettingsProfile> {
  return loadCurrentUser({ force: true });
}

export function patchCurrentUser(patch: Partial<UserSettingsProfile>) {
  setState((current) => {
    if (!current.user) return current;
    return {
      ...current,
      user: {
        ...current.user,
        ...patch,
      },
    };
  });
}

export function clearCurrentUserStore() {
  state = {
    status: "idle",
    user: null,
    error: null,
    lastUpdatedAt: null,
  };
  emitChange();
}

export function useCurrentUserStore({ autoLoad = true }: { autoLoad?: boolean } = {}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!autoLoad) return;
    if (snapshot.status === "idle") {
      void loadCurrentUser();
    }
  }, [autoLoad, snapshot.status]);

  return snapshot;
}
