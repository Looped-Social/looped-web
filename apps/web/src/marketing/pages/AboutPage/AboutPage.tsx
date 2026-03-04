import { Link } from "react-router";

import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { PageShell } from "@/marketing/components/PageShell/PageShell";

const values = [
  {
    title: "Privacy first",
    copy: "Pseudonymous by design so you can be honest without compromising your identity.",
  },
  {
    title: "Verified communities",
    copy: "Every member is verified. You're talking to real coworkers and peers, not bots.",
  },
  {
    title: "Safe spaces",
    copy: "Clear rules and moderation keep conversations respectful, useful, and grounded.",
  },
  {
    title: "Authentic voices",
    copy: "No corporate speak required. Real people having real conversations about real work.",
  },
];

const communityTypes = [
  {
    title: "Workplaces",
    copy: "Your home base. Share wins, ask honest questions, and connect with verified people who understand your day-to-day.",
  },
  {
    title: "Fields",
    copy: "Go beyond one company. Join field communities to talk with professionals across teams, orgs, and paths.",
  },
];

const steps = [
  {
    title: "Verify your identity",
    copy:
      "Sign up with workplace verification. We confirm you're part of the community, but your identity stays private to other users.",
  },
  {
    title: "Join your community",
    copy:
      "Your workplace is your starting point. From there, you can unlock field communities to connect with people who do similar work.",
  },
  {
    title: "Speak freely",
    copy:
      "Share thoughts, ask questions, and engage in honest conversations without the transactional feeling of networking.",
  },
];

export function AboutPage() {
  return (
    <PageShell mainClassName="px-4 py-8 sm:py-10 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:gap-10">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-brand/12 bg-brand/8 px-6 py-10 sm:px-8 sm:py-12 md:px-10 md:py-14">
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand/70">About Looped</p>
              <h1 className="mt-4 max-w-[11ch] text-[3rem] font-semibold leading-[0.95] tracking-[-0.05em] text-strong sm:text-[4rem] md:text-[4.75rem]">
                Everyone deserves an honest career.
              </h1>
              <p className="mt-6 max-w-[34ch] text-lg leading-8 text-text-secondary sm:text-xl">
                Looped Social creates connections between young professionals by helping them feel heard, without the
                transactional feeling of networking.
              </p>
            </div>

            <div className="rounded-[2rem] border border-brand/14 bg-white/60 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">Platform</p>
              <p className="mt-3 text-xl font-semibold text-strong">iOS-first</p>
              <p className="mt-2 text-base leading-7 text-text-secondary">
                Looped is iOS-first with a limited web experience for signed-in members. Android support is not
                available yet.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-border bg-bg px-6 py-7 shadow-sm md:px-8 md:py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">Why Looped</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Honest work conversations need a better home.
            </h2>
            <p className="mt-5 text-base leading-8 text-text-secondary">
              Everyone has a perspective worth sharing. At Looped, we connect people in a way that makes honesty and
              trust possible. We built Looped because real conversations matter, whether it's discussing challenges,
              sharing wins, or connecting with people who truly understand your world.
            </p>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Traditional social media is too public. Internal chat tools are too formal. Anonymous forums lack
              accountability. Looped strikes the balance: verified communities where you can be yourself.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {communityTypes.map((item) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-border bg-bg-muted px-6 py-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">{item.title}</p>
                <p className="mt-4 text-lg font-semibold leading-8 text-strong">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-border bg-bg px-6 py-8 shadow-sm md:px-8 md:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">How we are built</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              We connect people through where they work and the field they work in.
            </h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Workplaces create local trust and shared context. Fields widen the room so you can hear from people doing
              similar work across companies. Together, they make Looped feel honest, relevant, and useful.
            </p>
          </div>
        </section>

        <section className="rounded-[2.5rem] bg-secondary/24 px-6 py-8 md:px-8 md:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary/85">How it works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Simple structure. Better conversations.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-[2rem] border border-secondary/18 bg-white/52 p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-strong">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2.25rem] border border-border bg-bg-muted px-6 py-8 md:px-8 md:py-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">What we stand for</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Verified, private, and built for real people.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-[1.75rem] border border-border bg-bg px-6 py-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
              >
                <h3 className="text-lg font-semibold text-strong">{value.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{value.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-border bg-bg px-6 py-7 shadow-sm md:px-8 md:py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">Built by people who get it</p>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              We're a small team that believes in the power of authentic connection. We've experienced the frustration
              of having important conversations in hushed tones, or not at all. We built Looped to change that for
              workplaces and professional fields alike.
            </p>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Based out of the Triangle area with a distributed team, we're backed by investors who believe in creating
              healthier, more transparent workplaces.
            </p>
          </div>

          <div className="rounded-[2rem] border border-brand/14 bg-brand/8 px-6 py-7 shadow-sm md:px-8 md:py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand/70">Want to join the team?</p>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Reach out through our contact page or send an email to{" "}
              <a className="font-semibold text-brand transition hover:text-brand/85" href="mailto:support@looped.app">
                support@looped.app
              </a>
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
              >
                Contact us
              </Link>
              <a
                href="mailto:support@looped.app"
                className="inline-flex items-center justify-center rounded-full border border-brand/18 bg-bg px-5 py-3 text-sm font-semibold text-strong transition hover:bg-white/70"
              >
                Email the team
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-border bg-bg px-6 py-8 text-center shadow-sm md:px-10 md:py-10">
          <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
            Ready to join your workplace?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-text-secondary">
            Download the iOS app for the full Looped experience. Signed-in members can also use our limited web
            experience.
          </p>
          <div className="mt-6 inline-flex items-center justify-center">
            <AppStoreButton size={6} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
