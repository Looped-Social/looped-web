import { Link } from 'react-router';

import { Logo } from '@looped/ui';

export function ShutdownPostPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition hover:text-strong"
          >
            <span aria-hidden="true">&larr;</span>
            Back to home
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14 md:py-16 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <header className="mt-10 border-b border-border pb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">
              A note from the founders
            </p>
            <h1 className="mt-4 text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.045em] text-strong sm:text-[4rem]">
              Looped is shutting down.
            </h1>
            <p className="mt-6 text-base text-text-secondary">June 14, 2026</p>
          </header>

          <div className="space-y-7 py-10 text-[1.05rem] leading-8 text-text-primary sm:text-lg sm:leading-9">
            <p>
              Looped started with a simple belief: people wanted a more honest, human place to talk
              about work with people who understood their world.
            </p>

            <p>
              We spent a lot of time building that idea, putting it in front of people, listening,
              changing things, and trying again. There were moments that felt promising, and we are
              grateful to everyone who gave Looped a chance. But over time, we had to be honest with
              ourselves: people did not want this product as much as we thought they would.
            </p>

            <p>
              There is no dramatic story behind the decision. We tried a lot, learned a lot, and
              ultimately did not see a path where Looped would become something people used
              consistently enough to make it work. Hosting and maintaining the service also cost
              more than made sense for the amount of use it was getting.
            </p>

            <p>
              Rather than keep a product online that we no longer believed could become sustainable,
              we decided to shut Looped down. The app has been removed from the App Store.
            </p>

            <p>
              Building Looped taught us a great deal about products, communities, and the difference
              between an idea that sounds useful and something people truly make part of their
              lives. Those are lessons we will carry into whatever we build next.
            </p>

            <p>
              The two of us, Luke and William, are going to keep building together. Looped is
              ending, but we are not done making things, experimenting, and working on new ideas. We
              are looking forward to sharing more in the future.
            </p>

            <p>Thank you for being part of Looped, even if only for a little while.</p>
          </div>

          <footer className="border-t border-border pt-8">
            <p className="text-lg font-semibold text-strong">Luke &amp; William</p>
            <p className="mt-1 text-base text-text-secondary">Co-founders of Looped</p>
          </footer>
        </article>
      </main>

      <footer className="mt-8 border-t border-border px-4 py-8 text-center text-sm text-text-light">
        2026 Looped Social
      </footer>
    </div>
  );
}
