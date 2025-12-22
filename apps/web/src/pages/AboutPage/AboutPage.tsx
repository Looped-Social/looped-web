import { AppStoreButton } from "~/components/AppStoreButton/AppStoreButton";
import { PageShell } from "~/components/PageShell/PageShell";

const steps = [
  {
    title: "Verify your identity",
    copy:
      "Sign up with your work or school email. We verify you're part of the community, but your identity stays private to other users.",
  },
  {
    title: "Join your community",
    copy:
      "Connect with verified employees and students from your organization. Multiple companies? Join multiple communities.",
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

export function AboutPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-14">
        <header className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">About</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Your workplace deserves a better conversation
          </h1>
          <p className="text-lg leading-8 text-text-secondary md:text-xl">
            Looped is the workplace-verified social platform where employees and students can speak freely,
            connect authentically, and build real community.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-strong">Why Looped exists</h2>
          <p className="text-base leading-7 text-text-secondary">
            Every workplace has a culture, but not every workplace has a voice. We built Looped because honest
            conversations matter—whether it's discussing workplace challenges, sharing wins, or simply connecting
            with colleagues who understand what you're going through.
          </p>
          <p className="text-base leading-7 text-text-secondary">
            Traditional social media is too public. Internal chat tools are too formal. Anonymous forums lack
            accountability. Looped strikes the balance: verified communities where you can be yourself without being
            identified.
          </p>
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
            We're a small team that believes in the power of authentic workplace connections. We've experienced the
            frustration of having important conversations in hushed tones or not at all. We built Looped to change
            that.
          </p>
          <p className="text-base leading-7 text-text-secondary">
            Based in San Francisco with a distributed team, we're backed by investors who believe in creating
            healthier, more transparent workplaces.
          </p>
        </section>

        <section className="rounded-3xl bg-bg-muted px-6 py-8 text-center ring-1 ring-border md:px-10">
          <h2 className="text-2xl font-semibold text-strong md:text-3xl">Ready to join your community?</h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            Download Looped and start connecting with your verified workplace community today.
          </p>
          <div className="mt-5 inline-flex items-center justify-center">
            <AppStoreButton size={6} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
