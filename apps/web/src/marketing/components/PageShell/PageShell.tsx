import type { ReactNode } from "react";

import { PageShell as SharedPageShell } from "@looped/ui";

import { Footer } from "../Footer/Footer";
import { Navbar } from "../Navbar/Navbar";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
};

export function PageShell({
  children,
  className = "",
  mainClassName = "px-4 py-12 sm:py-14 md:py-16",
}: PageShellProps) {
  return (
    <SharedPageShell
      className={className}
      header={<Navbar />}
      footer={<Footer />}
      mainClassName={mainClassName}
    >
      {children}
    </SharedPageShell>
  );
}
