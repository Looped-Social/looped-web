import type { AdminMe } from "../../types/admin";

type AdminHomeProps = {
  admin: AdminMe;
};

export function AdminHome({ admin }: AdminHomeProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-bg p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-light">Looped Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-strong">Welcome back.</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Signed in as <span className="font-semibold text-text-primary">{admin.email}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-text-primary">
            Role: {admin.role}
          </span>
          <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-text-primary">
            Status: {admin.status}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-bg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">
            Permissions
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            {admin.permissions.map((permission) => (
              <li key={permission} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                {permission}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">
            Next steps
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li>Connect admin routes to the new API endpoints.</li>
            <li>Build roles, invites, and moderation tools.</li>
            <li>Wire reports, feedback, and verification queues.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
