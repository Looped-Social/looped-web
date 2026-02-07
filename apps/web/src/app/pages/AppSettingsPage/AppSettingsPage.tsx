import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-border/70 bg-bg px-4 py-3">
      <div className="h-3 w-1/3 rounded-full bg-bg-muted" aria-hidden="true" />
      <div className="mt-3 h-3 w-2/3 rounded-full bg-bg-muted" aria-hidden="true" />
    </div>
  );
}

export function AppSettingsPage() {
  return (
    <AppLayout activeNavId="settings">
      <AppMobileHeader title="Settings" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 py-4">
        <h1 className="text-lg font-semibold text-strong">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Settings on web are coming soon.</p>
      </header>

      <div className="space-y-3 bg-bg px-4 py-4">
        <div className="animate-pulse space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </AppLayout>
  );
}
