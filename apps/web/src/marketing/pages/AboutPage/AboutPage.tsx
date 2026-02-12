import { AppStoreButton } from "@/marketing/components/AppStoreButton/AppStoreButton";
import { PageShell } from "@/marketing/components/PageShell/PageShell";

const steps = [
  {
    title: "Verify your identity",
    copy:
      "Sign up with your company or school verification. We confirm you're part of the community, but your identity stays private to other users.",
  },
  {
    title: "Join your community",
    copy:
      "Companies and schools are the main communities. Join one company to unlock Fields (2 joins), and at least one school to unlock Majors (2 joins).",
  },
  {
    title: "Speak freely",
    copy:
      "Share thoughts, ask questions, and engage in authentic conversations without fear of judgment or professional consequences.",
  },
];

const values = [
  { title: "Privacy first", copy: "Pseudonymous by design so you can be honest without compromising your identity." },
  { title: "Verified communities", copy: "Every member is verified. You're talking to real colleagues, not bots." },
  { title: "Safe spaces", copy: "Clear rules and moderation to keep conversations respectful and productive." },
  { title: "Authentic voices", copy: "No corporate speak required. Real people having real conversations." },
];

const communityTypes = [
  {
    title: "Companies",
    copy: "Your main community at work. Share wins, ask questions, and connect with verified coworkers.",
  },
  {
    title: "Schools",
    copy: "Find honest student perspective. Compare programs, swap advice, and build campus community.",
  },
  {
    title: "Fields",
    copy: "Unlocked after you join a company. Join up to 2 fields to connect with verified peers across companies.",
  },
  {
    title: "Majors",
    copy: "Unlocked after you join at least one school. Join up to 2 majors to meet classmates and compare programs.",
  },
];

export function AboutPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-14">
        <header className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">About</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Every verified community deserves a better conversation
          </h1>
          <p className="text-lg leading-8 text-text-secondary md:text-xl">
            Looped is the verified social platform for companies and schools, with Fields and Majors unlocked after
            you join. Speak freely, connect authentically, and build real community with people who share your
            context.
          </p>
          <p className="text-base leading-7 text-text-secondary">
            Looped is iOS-first with a limited web experience for signed-in members. Android support is not available
            yet.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-strong">Why Looped exists</h2>
          <p className="text-base leading-7 text-text-secondary">
            Every company, school, and community has a culture, but not every community has a voice.
            We built Looped because honest conversations matter, whether it's discussing challenges, sharing wins, or
            connecting with people who truly understand your world.
          </p>
          <p className="text-base leading-7 text-text-secondary">
            Traditional social media is too public. Internal chat tools are too formal. Anonymous forums lack
            accountability. Looped strikes the balance: verified communities where you can be yourself without being
            identified.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">Built for four kinds of communities</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {communityTypes.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-strong">{item.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">How it works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-border bg-bg p-6 shadow-sm">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-strong">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-strong">What we stand for</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-border bg-bg-muted p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
              >
                <h3 className="text-lg font-semibold text-strong">{value.title}</h3>
                <p className="mt-2 text-base leading-7 text-text-secondary">{value.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-strong">Built by people who get it</h2>
          <p className="text-base leading-7 text-text-secondary">
            We're a small team that believes in the power of authentic connection. We've experienced the frustration
            of having important conversations in hushed tones, or not at all. We built Looped to change that for
            companies, schools, and professional fields alike.
          </p>
          <p className="text-base leading-7 text-text-secondary">
            Based in San Francisco with a distributed team, we're backed by investors who believe in creating
            healthier, more transparent companies.
          </p>
        </section>

        <section className="rounded-3xl bg-bg-muted px-6 py-8 text-center ring-1 ring-border md:px-10">
          <h2 className="text-2xl font-semibold text-strong md:text-3xl">Ready to join your community?</h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            Download the iOS app to unlock full onboarding, verification, and anonymous features. Signed-in members
            can also use our limited web experience.
          </p>
          <div className="mt-5 inline-flex items-center justify-center">
            <AppStoreButton size={6} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
