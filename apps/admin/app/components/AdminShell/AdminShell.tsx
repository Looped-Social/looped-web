import type { ReactNode } from "react";

import { PageShell } from "@looped/ui";

import { AdminHeader } from "../AdminHeader/AdminHeader";

type AdminShellProps = {
  children: ReactNode;
  userEmail: string | null;
  onSignOut?: () => void;
};

export function AdminShell({ children, userEmail, onSignOut }: AdminShellProps) {
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

  return (
    <PageShell header={<AdminHeader rightSlot={rightSlot} />} mainClassName="flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
    </PageShell>
  );
}
