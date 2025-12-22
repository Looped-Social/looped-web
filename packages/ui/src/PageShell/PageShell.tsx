import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  mainClassName?: string;
};

export function PageShell({
  children,
  className = "",
  header,
  footer,
  mainClassName = "",
}: PageShellProps) {
  return (
    <div className={`min-h-screen bg-bg text-text-primary flex flex-col ${className}`}>
      {header}
      <main className={mainClassName}>{children}</main>
      {footer}
    </div>
  );
}
