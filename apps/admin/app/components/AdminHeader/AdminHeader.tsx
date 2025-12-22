import type { ReactNode } from "react";

import { Logo, ThemeToggle } from "@looped/ui";

type AdminHeaderProps = {
  rightSlot?: ReactNode;
};

export function AdminHeader({ rightSlot }: AdminHeaderProps) {
  return (
    <header className="border-b border-border bg-bg">
      <div className="flex w-full items-center justify-between px-3 py-2 sm:px-6">
        <Logo size="md" />
        <div className="flex items-center gap-2">
          {rightSlot}
          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>
    </header>
  );
}
