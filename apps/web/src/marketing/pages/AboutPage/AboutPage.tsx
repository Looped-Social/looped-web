import { Link } from "react-router";

import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { PageShell } from "@/marketing/components/PageShell/PageShell";

const pillars = [
  {
    title: "Workplaces",
    copy: "Your home base. Share wins, ask honest questions, and connect with verified people who understand your day-to-day.",
  },
  {
    title: "Fields",
    copy: "Go beyond one company. Join field communities to talk with professionals across teams, orgs, and paths.",
  },
];

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
      <div className="mx-auto flex max-w-6xl flex-col gap-12 md:gap-14">
        <section className="pb-4 sm:pb-6 md:pb-8">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="max-w-3xl">
              <h1 className="max-w-[11ch] text-[3rem] font-semibold leading-[0.95] tracking-[-0.05em] text-strong sm:text-[4rem] md:text-[4.75rem]">
                Everyone deserves an honest career.
              </h1>
              <p className="mt-6 max-w-[34ch] text-lg leading-8 text-text-secondary sm:text-xl">
                Looped Social creates connections between young professionals by helping them feel heard, without the
                transactional feeling of networking.
              </p>
            </div>

            <div className="rounded-3xl bg-bg-muted/55 p-7 lg:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-strong">iOS-first, focused, and early.</h2>
              <p className="mt-4 text-base leading-8 text-text-secondary">
                Looped is iOS-first with a limited web experience for signed-in members. Android support is not
                available yet.
              </p>
              <p className="mt-4 text-base leading-8 text-text-secondary">
                Right now, we are focused on one thing: building a better place for honest workplace conversations.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-10 md:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
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
            {pillars.map((item) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-border bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:bg-bg-muted/55"
              >
                <h3 className="text-2xl font-semibold tracking-tight text-strong">{item.title}</h3>
                <p className="mt-4 text-base leading-8 text-text-secondary">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              We connect people through where they work and the field they work in.
            </h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Workplaces create local trust and shared context. Fields widen the room so you can hear from people doing
              similar work across companies. Together, they make Looped feel honest, relevant, and useful.
            </p>
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">How it works</h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Three clear steps. Verify, join, and start talking.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-[2rem] border border-border bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:bg-bg-muted/55"
              >
                <h3 className="text-xl font-semibold text-strong">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">
              Verified, private, and built for real people.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-[2rem] border border-border bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:bg-bg-muted/55"
              >
                <h3 className="text-lg font-semibold text-strong">{value.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{value.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">Built by two founders.</h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Looped is being built by two student founders who believe workplace conversation should feel more honest,
              more human, and less transactional.
            </p>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              We're early, focused, and building in the Triangle area. Right now the goal is simple: make something
              genuinely useful for people who want a better way to talk about work.
            </p>
          </div>

          <div className="rounded-3xl bg-bg-muted/55 p-6 lg:p-8">
            <h3 className="text-2xl font-semibold tracking-tight text-strong">Get in touch</h3>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              Reach out through our contact page or send an email to{" "}
              <a
                className="font-semibold text-brand transition hover:text-brand/85"
                href="mailto:support@looped-social.com"
              >
                support@looped-social.com
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
                href="mailto:support@looped-social.com"
                className="inline-flex items-center justify-center rounded-full border border-brand/18 bg-bg px-5 py-3 text-sm font-semibold text-strong transition hover:bg-bg-muted dark:hover:bg-bg-muted/70"
              >
                Email the team
              </a>
            </div>
          </div>
        </section>

        <section className="pt-2 text-center">
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
