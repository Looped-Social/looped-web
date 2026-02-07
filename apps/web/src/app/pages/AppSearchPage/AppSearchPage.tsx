import { AppSearchPanel } from '@/app/components/AppSearchPanel/AppSearchPanel';
import { AppLayout, AppMobileHeader } from '@/app/components/AppLayout/AppLayout';

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full bg-bg-muted ${className}`} aria-hidden="true" />;
}

export function AppSearchPage() {
  return (
    <AppLayout activeNavId="search" rightRail={<AppSearchPanel />}>
      <AppMobileHeader title="Search" showAction={false} />

      <header className="border-b border-border/70 bg-bg px-4 py-4">
        <h1 className="text-lg font-semibold text-strong">Search</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Search and filter Loops. Results coming soon.
        </p>
      </header>

      <div className="space-y-4 bg-bg px-4 py-4">
        <div className="animate-pulse space-y-3">
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-5/6" />
        </div>
        <div className="animate-pulse space-y-3">
          <SkeletonLine className="w-2/5" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
        </div>
        <div className="animate-pulse space-y-3">
          <SkeletonLine className="w-1/4" />
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-4/5" />
        </div>
      </div>
    </AppLayout>
  );
}
