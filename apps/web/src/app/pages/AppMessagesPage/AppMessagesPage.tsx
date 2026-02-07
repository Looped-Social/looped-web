import { AppLayout, AppMobileHeader } from '@/app/components/AppLayout/AppLayout';

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-bg px-4 py-3">
      <div className="h-11 w-11 shrink-0 rounded-full bg-bg-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded-full bg-bg-muted" aria-hidden="true" />
        <div className="h-3 w-3/4 rounded-full bg-bg-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

export function AppMessagesPage() {
  return (
    <AppLayout activeNavId="messages">
      <AppMobileHeader title="Messages" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 py-4">
        <h1 className="text-lg font-semibold text-strong">Messages</h1>
        <p className="mt-1 text-sm text-text-secondary">Messaging on web is coming soon.</p>
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
