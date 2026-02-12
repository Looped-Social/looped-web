import { useSyncExternalStore } from "react";

export type ContentPreferences = {
  hideAnonymousPosts: boolean;
};

const STORAGE_KEY = "contentPreferences";
const CHANGE_EVENT = "looped:content-preferences-changed";
const DEFAULT_PREFERENCES: ContentPreferences = {
  hideAnonymousPosts: false,
};

let memoryPreferences: ContentPreferences = DEFAULT_PREFERENCES;

function arePreferencesEqual(a: ContentPreferences, b: ContentPreferences): boolean {
  return a.hideAnonymousPosts === b.hideAnonymousPosts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

function normalizePreferences(value: unknown): ContentPreferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES;
  return {
    hideAnonymousPosts: getBoolean(value.hideAnonymousPosts ?? value.hide_anonymous_posts) ?? false,
  };
}

function readStorage(): ContentPreferences {
  if (typeof window === "undefined") return memoryPreferences;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return memoryPreferences;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizePreferences(parsed);
  } catch {
    return memoryPreferences;
  }
}

function writeStorage(next: ContentPreferences) {
  memoryPreferences = next;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function emitChange(next: ContentPreferences) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
}

export function readContentPreferences(): ContentPreferences {
  const next = readStorage();
  if (!arePreferencesEqual(memoryPreferences, next)) {
    memoryPreferences = {
      hideAnonymousPosts: next.hideAnonymousPosts,
    };
  }
  return next;
}

export function updateContentPreferencesCache(
  next: ContentPreferences,
  options?: {
    broadcast?: boolean;
  }
) {
  writeStorage(next);
  if (options?.broadcast !== false) emitChange(next);
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    readContentPreferences();
    listener();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot() {
  readContentPreferences();
  return memoryPreferences;
}

export function useContentPreferences(): ContentPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
