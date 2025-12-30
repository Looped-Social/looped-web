import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import { fetchAdminAdmins, inviteAdmin, updateAdmin } from "../lib/adminApi";
import type { AdminListItem, AdminRole } from "../types/admin";
import type { AdminRouteContext } from "./admin";

const permissionOptions = [
  "manage_admins",
  "ban_user",
  "remove_post",
  "create_community",
  "view_reports",
  "resolve_reports",
  "verify_users",
  "delete_media",
  "view_feedback",
];

export default function AdminsRoute() {
  const { admin } = useOutletContext<AdminRouteContext>();
  const canManage = admin.permissions.includes("manage_admins");

  const [items, setItems] = useState<AdminListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<AdminRole, "owner">>("admin");
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedAdmin = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setIsLoading(true);
    fetchAdminAdmins()
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setSelectedId(res.items[0]?.id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load admins.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManage]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setActionError("Enter an email for the invite.");
      return;
    }
    if (!window.confirm(`Create an admin invite for ${inviteEmail.trim()}?`)) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const res = await inviteAdmin({
        email: inviteEmail.trim(),
        role: inviteRole,
        permissions: invitePermissions.length ? invitePermissions : undefined,
      });
      setInviteToken(res.token);
      setInviteEmail("");
      setInvitePermissions([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to invite admin.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (payload: Partial<AdminListItem>) => {
    if (!selectedAdmin) return;
    const nextRole = payload.role ?? selectedAdmin.role;
    const nextStatus = payload.status ?? selectedAdmin.status;
    const nextPermissions = payload.permissions ?? selectedAdmin.permissions;
    const permissionsChanged =
      nextPermissions.length !== selectedAdmin.permissions.length ||
      nextPermissions.some((perm) => !selectedAdmin.permissions.includes(perm));
    const hasChanges =
      nextRole !== selectedAdmin.role ||
      nextStatus !== selectedAdmin.status ||
      permissionsChanged;
    if (!hasChanges) return;

    const changes: string[] = [];
    if (nextRole !== selectedAdmin.role) changes.push(`role to ${nextRole}`);
    if (nextStatus !== selectedAdmin.status) changes.push(`status to ${nextStatus}`);
    if (permissionsChanged) changes.push("permissions");
    const confirmMessage =
      changes.length > 0
        ? `Update ${selectedAdmin.email} (${changes.join(", ")})?`
        : `Update ${selectedAdmin.email}?`;
    if (!window.confirm(confirmMessage)) return;

    setIsSaving(true);
    setActionError(null);
    try {
      const res = await updateAdmin(selectedAdmin.id, {
        role: payload.role ?? selectedAdmin.role,
        status: payload.status ?? selectedAdmin.status,
        permissions: payload.permissions ?? selectedAdmin.permissions,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === selectedAdmin.id ? { ...item, ...res } : item))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update admin.");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (perm: string) => {
    setInvitePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-border bg-bg p-6 ">
        <h1 className="text-2xl font-semibold text-strong">Admin management</h1>
        <p className="mt-2 text-sm text-text-secondary">
          You do not have permission to manage admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-text-light">
          Admin management
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">Invite and manage admins</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Owners can add admins and moderators, and adjust permissions as needed.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-bg p-6 ">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-text-light">
              New invite
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Create a one-time invite token. Share it out of band.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.6fr]">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="newadmin@company.com"
            className="rounded-full border border-border bg-bg px-4 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}
            className="rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
          </select>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-text-light">
            Custom permissions
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {permissionOptions.map((perm) => (
              <button
                key={perm}
                type="button"
                onClick={() => togglePermission(perm)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  invitePermissions.includes(perm)
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {perm}
              </button>
            ))}
          </div>
        </div>
        {actionError && (
          <p className="mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-brand">
            {actionError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleInvite}
            disabled={isSaving}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white  transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creating..." : "Create invite"}
          </button>
          {inviteToken && (
            <div className="rounded-full border border-brand bg-brand/10 px-4 py-2 text-xs font-semibold text-brand">
              Token: {inviteToken}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          {error && (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="text-sm font-semibold text-text-primary">Unable to load admins.</p>
              <p className="mt-1 text-xs text-text-light">Try refreshing the list.</p>
              <details className="mt-2 text-xs text-text-light">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-2 whitespace-pre-wrap">{error}</p>
              </details>
            </div>
          )}
          {isLoading && (
            <div className="rounded-xl border border-border bg-bg px-4 py-6 text-sm text-text-secondary">
              Loading admins...
            </div>
          )}
          {items.map((item) => {
            const isActive = item.id === selectedAdmin?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)] ${
                  isActive
                    ? "border-brand/60 bg-bg-muted/60"
                    : "border-border bg-bg hover:border-brand/40"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{item.email}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Role: {item.role} - Status: {item.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-primary">
                    #{item.id}
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        <aside className="rounded-2xl border border-border bg-bg p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-strong">Admin details</h2>
          {!selectedAdmin ? (
            <p className="mt-3 text-sm text-text-secondary">
              Select an admin to view details.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-text-secondary">
              <div>
                <p className="text-xs font-semibold uppercase text-text-light">
                  Account
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {selectedAdmin.email}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Role
                </p>
                <select
                  value={selectedAdmin.role}
                  onChange={(event) => handleUpdate({ role: event.target.value as AdminRole })}
                  className="mt-2 w-full rounded-full border border-border bg-bg px-3 py-2 text-sm text-text-primary  outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                </select>
              </div>
              <div className="rounded-xl border border-border bg-bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-text-light">
                  Permissions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {permissionOptions.map((perm) => (
                    <button
                      key={perm}
                      type="button"
                      onClick={() =>
                        handleUpdate({
                          permissions: selectedAdmin.permissions.includes(perm)
                            ? selectedAdmin.permissions.filter((p) => p !== perm)
                            : [...selectedAdmin.permissions, perm],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selectedAdmin.permissions.includes(perm)
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg-muted/30 p-3 text-xs text-text-light">
                Created: {selectedAdmin.created_at}
                <br />
                Last login: {selectedAdmin.last_login_at ?? "N/A"}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
