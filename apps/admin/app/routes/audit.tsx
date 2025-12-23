import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";

import { fetchAdminAudit } from "../lib/adminApi";
import type { AuditItem } from "../types/admin";
import type { AdminRouteContext } from "./admin";

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function AuditRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canManage = admin.permissions.includes("manage_admins");

  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setIsLoading(true);
    fetchAdminAudit()
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setNextCursor(res.next_cursor ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load audit log.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManage]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAdminAudit(nextCursor);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more audit entries.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Audit log</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to view audit logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-text-light">
          Audit log
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">Administrative activity</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track admin actions across the platform for compliance and review.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
          <p className="text-sm font-semibold text-text-primary">Unable to load the audit log.</p>
          <p className="mt-1 text-xs text-text-light">Try refreshing the page.</p>
          <details className="mt-2 text-xs text-text-light">
            <summary className="cursor-pointer">Details</summary>
            <p className="mt-2 whitespace-pre-wrap">{error}</p>
          </details>
        </div>
      )}
      {isLoading && items.length === 0 && (
        <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
          Loading audit log...
        </div>
      )}
      {!isLoading && items.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
          No audit entries yet.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-bg px-4 py-4 transition hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">{item.action}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Target: {item.target_type} #{item.target_id}
                </p>
              </div>
              <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                Admin #{item.actor_admin_id}
              </span>
            </div>
            <div className="mt-3 text-xs text-text-light">
              {formatDate(item.created_at)}
            </div>
          </div>
        ))}
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoading}
          className="w-full rounded-full border border-border bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
