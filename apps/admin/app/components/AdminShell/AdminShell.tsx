import type { ReactNode } from "react";

import { NavLink } from "react-router";

import { PageShell } from "@looped/ui";

import { AdminHeader } from "../AdminHeader/AdminHeader";
import type { AdminMe } from "../../types/admin";

type AdminShellProps = {
  children: ReactNode;
  admin: AdminMe;
  userEmail: string | null;
  onSignOut?: () => void;
};

type NavItem = {
  label: string;
  to: string;
  permission?: string | string[];
};

const navItems: NavItem[] = [
  { label: "Overview", to: "/" },
  { label: "Analytics", to: "/analytics" },
  { label: "Verifications", to: "/verifications", permission: "verify_users" },
  { label: "Communities", to: "/communities", permission: "create_community" },
  { label: "Sectors", to: "/sectors", permission: "create_community" },
  { label: "Specializations", to: "/settings/specializations", permission: "create_community" },
  {
    label: "Community Requests",
    to: "/community-requests",
    permission: "create_community",
  },
  { label: "Reports", to: "/reports", permission: "view_reports" },
  { label: "Announcements", to: "/announcements", permission: "send_announcements" },
  { label: "Appeals", to: "/appeals", permission: "view_reports" },
  { label: "Users", to: "/users", permission: ["ban_user", "verify_users"] },
  { label: "Posts", to: "/posts", permission: "remove_post" },
  { label: "Admins", to: "/admins", permission: "manage_admins" },
  { label: "Audit Log", to: "/audit", permission: "manage_admins" },
];

export function AdminShell({ children, admin, userEmail, onSignOut }: AdminShellProps) {
  const rightSlot = (
    <div className="flex items-center gap-3 text-xs text-text-secondary sm:text-sm">
      {userEmail && <span className="hidden sm:inline">{userEmail}</span>}
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-border px-3 py-1.5 font-medium text-text-primary transition hover:bg-bg-muted"
        >
          Sign out
        </button>
      )}
    </div>
  );

  const visibleNavItems = navItems.filter(
    (item) => {
      if (!item.permission) return true;
      if (Array.isArray(item.permission)) {
        return item.permission.some((permission) => admin.permissions.includes(permission));
      }
      return admin.permissions.includes(item.permission);
    }
  );

  return (
    <PageShell header={<AdminHeader rightSlot={rightSlot} />} mainClassName="flex-1">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 lg:flex-row lg:gap-6">
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-full border border-border bg-bg px-2 py-2 text-sm font-medium text-text-secondary  lg:hidden">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                  isActive
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <aside className="hidden w-60 flex-shrink-0 self-start rounded-2xl border border-border bg-bg px-4 py-5 lg:block">
          <p className="text-xs font-semibold uppercase text-text-light">Navigation</p>
          <nav className="mt-4 space-y-2 text-sm">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center rounded-lg border px-3 py-2.5 transition ${
                    isActive
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-transparent text-text-secondary hover:bg-bg-muted/70 hover:text-strong"
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </PageShell>
  );
}
