import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-bg p-6 ">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-strong">{title}</h1>
        {description && <p className="text-sm text-text-secondary">{description}</p>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
