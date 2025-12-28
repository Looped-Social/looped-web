import { AppStoreButton } from "~/components/AppStoreButton/AppStoreButton";
import { PageShell } from "~/components/PageShell/PageShell";

export function LoginPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Looped on the web
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">Coming soon</h1>
        <p className="text-lg leading-8 text-text-secondary">
          We're working hard to bring Looped to the web. For now, experience Looped on iOS.
        </p>
        <p className="text-base leading-7 text-text-secondary">
          Download the app to get started with your verified community today.
        </p>

        <AppStoreButton size={6} />

      </div>
    </PageShell>
  );
}
