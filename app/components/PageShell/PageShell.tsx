import React from "react";

import { Footer } from "../Footer/Footer";
import { Navbar } from "../Navbar/Navbar";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-bg text-text-primary ${className}`}>
      <Navbar />
      <main className="px-4 py-12 sm:py-14 md:py-16">{children}</main>
      <Footer />
    </div>
  );
}
