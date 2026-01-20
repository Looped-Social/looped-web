import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import {
  AdminApiError,
  createAdminModerationBlocklist,
  disableAdminModerationBlocklistItem,
  fetchAdminModerationBlocklist,
} from "../lib/adminApi";
import type { ModerationBlocklistItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const enabledOptions = [
  { label: "All", value: "all" },
  { label: "Enabled", value: "enabled" },
  { label: "Disabled", value: "disabled" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function enabledBadgeClass(enabled: boolean) {
  if (enabled) return "bg-brand/10 text-brand";
  return "bg-bg-muted text-text-secondary";
}

function mapBlocklistError(err: unknown): string {
  if (err instanceof AdminApiError) {
    if (err.status === 403) return "Forbidden: missing manage_moderation_blocklist permission.";
  }
  return err instanceof Error ? err.message : "Request failed.";
}

function parseTerms(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((term) => term.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const term of lines) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(term);
  }
  return unique;
}

export default function ModerationBlocklistRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canManage = admin.permissions.includes("manage_moderation_blocklist");

  const [enabledFilter, setEnabledFilter] = useState<(typeof enabledOptions)[number]["value"]>(
    "enabled"
  );
  const [items, setItems] = useState<ModerationBlocklistItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [termsRaw, setTermsRaw] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const enabledParam = useMemo(() => {
    if (enabledFilter === "enabled") return true;
    if (enabledFilter === "disabled") return false;
    return undefined;
  }, [enabledFilter]);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    setBanner(null);
    fetchAdminModerationBlocklist(enabledParam, undefined, 50)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(mapBlocklistError(err));
        setItems([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canManage, enabledParam, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminModerationBlocklist(enabledParam, nextCursor, 50);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(mapBlocklistError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const submitTerms = async () => {
    const terms = parseTerms(termsRaw);
    if (terms.length === 0) {
      setActionError("Add at least one term.");
      return;
    }
    setIsSaving(true);
    setActionError(null);
    setBanner(null);
    try {
      const res = await createAdminModerationBlocklist(terms);
      setBanner(`Added/re-enabled ${res.ids.length} term${res.ids.length === 1 ? "" : "s"}.`);
      setTermsRaw("");
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      setActionError(mapBlocklistError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const disableItem = async (item: ModerationBlocklistItem) => {
    if (!item.enabled) return;
    if (!window.confirm(`Disable "${item.term}"?`)) return;
    setIsSaving(true);
    setActionError(null);
    setBanner(null);
    try {
      await disableAdminModerationBlocklistItem(item.id);
      setBanner("Disabled.");
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, enabled: false } : row)));
      if (enabledFilter === "enabled") {
        setItems((prev) => prev.filter((row) => row.id !== item.id));
      }
    } catch (err) {
      setActionError(mapBlocklistError(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6">
        <h1 className="text-2xl font-semibold text-strong">Moderation Blocklist</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to manage the moderation blocklist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-bg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-strong">Moderation Blocklist</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Manage blocked terms used for automated moderation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg-muted/30 p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-strong">Add terms</p>
            <p className="mt-1 text-sm text-text-secondary">
              Paste one per line (or comma-separated). Duplicates are re-enabled.
            </p>
            <textarea
              value={termsRaw}
              onChange={(event) => setTermsRaw(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
              placeholder={"term1\nterm2\nterm3"}
            />
            {actionError && <p className="mt-2 text-sm text-brand">{actionError}</p>}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setTermsRaw("")}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={submitTerms}
                className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Add terms"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-muted/30 p-4">
            <p className="text-sm font-semibold text-strong">Filters</p>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                Enabled
              </span>
              <select
                value={enabledFilter}
                onChange={(event) =>
                  setEnabledFilter(event.target.value as (typeof enabledOptions)[number]["value"])
                }
                className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand/60"
              >
                {enabledOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-sm text-text-secondary">
              {isLoading ? "Loading..." : `${items.length} item${items.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {banner && (
          <div className="mt-4 rounded-xl border border-border bg-bg-muted/30 px-4 py-3 text-sm text-text-secondary">
            {banner}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-brand">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-bg p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-text-light">
              <tr>
                <th className="px-3 py-2">Term</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-text-primary">{item.term}</span>
                      <span className="font-mono text-xs text-text-light">#{item.id}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${enabledBadgeClass(
                        item.enabled
                      )}`}
                    >
                      {item.enabled ? "enabled" : "disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3 text-text-secondary">{formatDate(item.updated_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={!item.enabled || isSaving}
                      onClick={() => disableItem(item)}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Disable
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                    No blocklist terms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={isLoading}
            onClick={loadMore}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

