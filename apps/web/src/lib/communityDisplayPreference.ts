import { useSyncExternalStore } from "react";

const STORAGE_KEY = "preferCommunityShortNames";
const CHANGE_EVENT = "looped:community-display-preference-changed";

let memoryValue = true;

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function readStorage(): boolean {
  if (typeof window === "undefined") return memoryValue;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return memoryValue;
  return normalizeBoolean(raw, memoryValue);
}

function writeStorage(value: boolean) {
  memoryValue = value;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(value));
}

function emitChange(value: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

export function readPreferCommunityShortNames(): boolean {
  const value = readStorage();
  memoryValue = value;
  return value;
}

export function updatePreferCommunityShortNames(value: boolean) {
  writeStorage(value);
  emitChange(value);
}

export function resolveCommunityLabel({
  name,
  shortName,
  fallback,
  preferShortNames,
}: {
  name?: string;
  shortName?: string;
  fallback?: string;
  preferShortNames: boolean;
}): string {
  const normalizedName = name?.trim();
  const normalizedShort = shortName?.trim();
  if (preferShortNames && normalizedShort) return normalizedShort;
  if (normalizedName) return normalizedName;
  if (normalizedShort) return normalizedShort;
  return fallback ?? "Community";
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getSnapshot(): boolean {
  return readPreferCommunityShortNames();
}

export function usePreferCommunityShortNames(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
