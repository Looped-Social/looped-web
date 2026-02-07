import { AppLayout, AppMobileHeader } from '@/app/components/AppLayout/AppLayout';

function SkeletonNotification() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/70 bg-bg px-4 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-bg-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded-full bg-bg-muted" aria-hidden="true" />
        <div className="h-3 w-1/2 rounded-full bg-bg-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

export function AppNotificationsPage() {
  return (
    <AppLayout activeNavId="notifications">
      <AppMobileHeader title="Notifications" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 py-4">
        <h1 className="text-lg font-semibold text-strong">Notifications</h1>
        <p className="mt-1 text-sm text-text-secondary">Notifications on web are coming soon.</p>
      </header>

      <div className="space-y-3 bg-bg px-4 py-4">
        <div className="animate-pulse space-y-3">
          <SkeletonNotification />
          <SkeletonNotification />
          <SkeletonNotification />
          <SkeletonNotification />
        </div>
      </div>
    </AppLayout>
  );
}
