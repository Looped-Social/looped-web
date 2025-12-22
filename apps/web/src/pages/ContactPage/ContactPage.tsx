import { Link } from "react-router";

import { PageShell } from "~/components/PageShell/PageShell";

const contacts = [
  { icon: "📧", title: "General inquiries", copy: "Questions about Looped or need help getting started?", email: "support@looped.app" },
  { icon: "🐛", title: "Bug reports", copy: "Found a bug or technical issue? Let us know so we can fix it.", email: "bugs@looped.app" },
  { icon: "📰", title: "Press & media", copy: "Journalists and media inquiries welcome.", email: "press@looped.app" },
  { icon: "🤝", title: "Business & partnerships", copy: "Interested in partnering with Looped?", email: "business@looped.app" },
];

export function ContactPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Contact</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">Get in touch</h1>
          <p className="text-lg leading-8 text-text-secondary">
            We'd love to hear from you. Reach out with questions, feedback, or just to say hello.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {contacts.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-bg p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-lg">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-strong">{item.title}</h3>
              <p className="mt-2 text-base leading-7 text-text-secondary">{item.copy}</p>
              <a className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand/90" href={`mailto:${item.email}`}>
                {item.email}
              </a>
            </div>
          ))}
        </div>

        <div className="grid gap-8 rounded-3xl bg-bg-muted p-8 ring-1 ring-border md:grid-cols-2 md:p-10">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-strong">Connect with us</h3>
            <p className="text-base leading-7 text-text-secondary">
              Follow us on social for updates, news, and community highlights.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand hover:text-brand"
                href="https://twitter.com/loopedapp"
                target="_blank"
                rel="noreferrer"
              >
                Twitter
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand hover:text-brand"
                href="https://instagram.com/loopedapp"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-strong">Response time</h3>
            <p className="text-base leading-7 text-text-secondary">
              We typically respond within 24–48 hours on business days. For quick answers, check out our{" "}
              <Link className="font-semibold text-brand hover:text-brand/90" to="/faq">
                FAQ page
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-8 text-center shadow-sm md:p-10">
          <h3 className="text-xl font-semibold text-strong">Looking for quick answers?</h3>
          <p className="mt-2 text-base leading-7 text-text-secondary">
            Many common questions are already answered in our FAQ.
          </p>
          <Link
            to="/faq"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90"
          >
            Visit FAQ
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
