import type { ReactNode } from "react";

import { PageShell } from "@looped/ui";

import { AdminHeader } from "../AdminHeader/AdminHeader";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <PageShell
      header={<AdminHeader />}
      mainClassName="flex flex-1 items-center justify-center px-4 py-12"
    >
      {children}
    </PageShell>
  );
}
