import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import type { AdminMe, ReportItem, VerificationItem } from "../../types/admin";
import { fetchAdminReports, fetchAdminVerifications } from "../../lib/adminApi";

type AdminHomeProps = {
  admin: AdminMe;
};

export function AdminHome({ admin }: AdminHomeProps) {
  const canVerify = admin.permissions.includes("verify_users");
  const canViewReports = admin.permissions.includes("view_reports");

  const [verificationState, setVerificationState] = useState<{
    items: VerificationItem[];
    nextCursor?: string | null;
    error?: string | null;
  }>({ items: [] });
  const [reportState, setReportState] = useState<{
    items: ReportItem[];
    nextCursor?: string | null;
    error?: string | null;
  }>({ items: [] });

  useEffect(() => {
    if (!canVerify) return;
    let active = true;
    fetchAdminVerifications("pending", undefined, 5)
      .then((res) => {
        if (!active) return;
        setVerificationState({ items: res.items, nextCursor: res.next_cursor ?? null });
      })
      .catch((error) => {
        if (!active) return;
        setVerificationState({
          items: [],
          error: error instanceof Error ? error.message : "Unable to load verification queue.",
        });
      });
    return () => {
      active = false;
    };
  }, [canVerify]);

  useEffect(() => {
    if (!canViewReports) return;
    let active = true;
    fetchAdminReports("open", undefined, undefined, 5, { sort: "created_at_desc" })
      .then((res) => {
        if (!active) return;
        setReportState({ items: res.items, nextCursor: res.next_cursor ?? null });
      })
      .catch((error) => {
        if (!active) return;
        setReportState({
          items: [],
          error: error instanceof Error ? error.message : "Unable to load reports queue.",
        });
      });
    return () => {
      active = false;
    };
  }, [canViewReports]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-bg p-6 ">
        <p className="text-xs font-semibold uppercase text-text-light">
          Looped Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-strong">
          {greeting}, {admin.email.split("@")[0]}.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">
          You have <span className="font-semibold text-text-primary">{admin.role}</span>{" "}
          access with{" "}
          <span className="font-semibold text-text-primary">{admin.permissions.length}</span>{" "}
          permissions.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase ">
          <span className="rounded-full bg-bg px-3 py-1 text-text-secondary ">
            Role: {admin.role}
          </span>
          <span className="rounded-full bg-bg px-3 py-1 text-text-secondary ">
            Status: {admin.status}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          to="/verifications"
          className={`group rounded-2xl border border-border bg-bg p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
            canVerify ? "" : "pointer-events-none opacity-60"
          }`}
        >
          <p className="text-xs font-semibold uppercase text-text-light">
            Pending verifications
          </p>
          <p className="mt-4 text-3xl font-semibold text-strong">
            {canVerify ? verificationState.items.length : "N/A"}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {canVerify
              ? verificationState.nextCursor
                ? "More waiting in the queue"
                : "All caught up"
              : "Permission required"}
          </p>
          <div className="mt-4 text-sm font-semibold text-brand">Review queue</div>
        </Link>

        <Link
          to="/reports"
          className={`group rounded-2xl border border-border bg-bg p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
            canViewReports ? "" : "pointer-events-none opacity-60"
          }`}
        >
          <p className="text-xs font-semibold uppercase text-text-light">
            Open reports
          </p>
          <p className="mt-4 text-3xl font-semibold text-strong">
            {canViewReports ? reportState.items.length : "N/A"}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {canViewReports
              ? reportState.nextCursor
                ? "More reports beyond this"
                : "Clear queue"
              : "Permission required"}
          </p>
          <div className="mt-4 text-sm font-semibold text-brand">Moderate reports</div>
        </Link>

        <Link
          to="/users"
          className={`group rounded-2xl border border-border bg-bg p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
            admin.permissions.includes("ban_user") ? "" : "pointer-events-none opacity-60"
          }`}
        >
          <p className="text-xs font-semibold uppercase text-text-light">
            User moderation
          </p>
          <p className="mt-4 text-lg font-semibold text-strong">Search and ban users</p>
          <p className="mt-2 text-sm text-text-secondary">
            Look up accounts, review history, and enforce bans.
          </p>
          <div className="mt-4 text-sm font-semibold text-brand">Find users</div>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-text-light">
              Verification queue
            </p>
            <Link
              to="/verifications"
              className="text-xs font-semibold uppercase text-brand"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            {!canVerify && <p>Permission required.</p>}
            {canVerify && verificationState.error && (
              <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
                <p className="font-semibold text-text-primary">
                  Unable to load the verification queue.
                </p>
                <details className="mt-1 text-xs text-text-light">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-1 whitespace-pre-wrap">{verificationState.error}</p>
                </details>
              </div>
            )}
            {canVerify && !verificationState.error && verificationState.items.length === 0 && (
              <p>No pending verifications right now.</p>
            )}
            {verificationState.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-bg-muted/40 px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-text-primary">{item.email ?? "Unknown email"}</p>
                  <p className="text-xs text-text-light">{item.company_domain ?? "No company"}</p>
                </div>
                <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                  {item.method}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-text-light">
              Reports queue
            </p>
            <Link
              to="/reports"
              className="text-xs font-semibold uppercase text-brand"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-text-secondary">
            {!canViewReports && <p>Permission required.</p>}
            {canViewReports && reportState.error && (
              <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
                <p className="font-semibold text-text-primary">
                  Unable to load the reports queue.
                </p>
                <details className="mt-1 text-xs text-text-light">
                  <summary className="cursor-pointer">Details</summary>
                  <p className="mt-1 whitespace-pre-wrap">{reportState.error}</p>
                </details>
              </div>
            )}
            {canViewReports && !reportState.error && reportState.items.length === 0 && (
              <p>No open reports right now.</p>
            )}
            {reportState.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-bg-muted/40 px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-text-primary">
                    {item.reporter_handle ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-text-light">{item.reason}</p>
                </div>
                <span className="rounded-full bg-bg px-2 py-1 text-xs font-semibold text-text-secondary">
                  {item.target_type} #{item.target_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
