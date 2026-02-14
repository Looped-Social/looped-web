import { Link } from "react-router";

import { AppLayout, AppMobileHeader } from "@/app/components/AppLayout/AppLayout";

export function AppAnonymousProfilePage() {
  return (
    <AppLayout activeNavId="">
      <AppMobileHeader title="Anonymous" showAction={false} showBack backHref="/app" />

      <section className="border-b border-border/70 bg-bg px-4 py-6">
        <div className="mx-auto flex max-w-[440px] flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-bg-muted">
            <span
              className="inline-block h-full w-full bg-secondary"
              style={{
                maskImage: "url('/ios-icons/pfp2.svg')",
                WebkitMaskImage: "url('/ios-icons/pfp2.svg')",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskSize: "cover",
                WebkitMaskSize: "cover",
              }}
              aria-hidden="true"
            />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-secondary">Anonymous</h1>
          <p className="mt-1 text-sm text-text-secondary">@anonymous</p>
          <p className="mt-2 text-sm text-text-secondary">
            This post was shared anonymously in the community.
          </p>
        </div>
      </section>

      <div className="bg-bg px-4 py-10 text-center">
        <p className="text-sm text-text-secondary">
          Anonymous profiles do not show personal details or a public timeline.
        </p>
        <Link
          to="/app"
          className="mt-4 inline-flex rounded-full border border-border/70 bg-bg px-4 py-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
        >
          Back
        </Link>
      </div>
    </AppLayout>
  );
}
