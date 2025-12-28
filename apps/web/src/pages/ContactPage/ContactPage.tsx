import { useState } from "react";
import { Link } from "react-router";

import { PageShell } from "~/components/PageShell/PageShell";
import { FeedbackApiError, submitFeedback } from "@/lib/feedbackApi";

const contacts = [
  { icon: "📧", title: "General inquiries", copy: "Questions about Looped or need help getting started?", email: "support@looped.app" },
  { icon: "🐛", title: "Bug reports", copy: "Found a bug or technical issue? Let us know so we can fix it.", email: "bugs@looped.app" },
  { icon: "📰", title: "Press & media", copy: "Journalists and media inquiries welcome.", email: "press@looped.app" },
  { icon: "🤝", title: "Business & partnerships", copy: "Interested in partnering with Looped?", email: "business@looped.app" },
];

export function ContactPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!title.trim() || !message.trim()) {
      setSubmitError("Add a title and message so we can respond.");
      return;
    }

    setStatus("submitting");
    try {
      await submitFeedback({
        title: title.trim(),
        message: message.trim(),
        email: email.trim() || undefined,
      });
      setStatus("success");
      setSubmitError(null);
      setTitle("");
      setMessage("");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setSubmitError(getFeedbackErrorMessage(error));
    }
  };

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

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-bg p-6 shadow-sm"
        >
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">Feedback</p>
              <h2 className="text-2xl font-semibold text-strong">Send us a message</h2>
              <p className="text-sm text-text-secondary">
                Share feedback, ideas, or issues. If you include your email, we can reply.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor="feedback-title">
                Title
              </label>
              <input
                id="feedback-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Feature request or feedback"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor="feedback-message">
                Message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[140px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Tell us what you need and we will respond."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor="feedback-email">
                Email (optional)
              </label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="you@company.com"
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand">
                {submitError}
              </div>
            )}

            {status === "success" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Thanks for the feedback. We have received your message.
              </div>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? "Sending..." : "Send feedback"}
            </button>
          </div>
        </form>

        <div className="grid gap-6 md:grid-cols-2">
          {contacts.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-bg p-6 shadow-sm"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-lg">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-strong">{item.title}</h3>
              <p className="mt-2 text-base leading-7 text-text-secondary">{item.copy}</p>
              <a
                className="mt-3 inline-block text-sm font-semibold text-brand hover:text-brand/90"
                href={`mailto:${item.email}`}
              >
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
                href="https://twitter.com/loopedsm"
                target="_blank"
                rel="noreferrer"
              >
                Twitter
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand hover:text-brand"
                href="https://instagram.com/loopedsm"
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand hover:text-brand"
                href="https://tiktok.com/@loopedsm"
                target="_blank"
                rel="noreferrer"
              >
                TikTok
              </a>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-brand hover:text-brand"
                href="https://www.linkedin.com/company/loopedsm"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
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
          <h3 className="text-xl font-semibold text-strong">Need quick answers?</h3>
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

function getFeedbackErrorMessage(error: unknown): string {
  if (error instanceof FeedbackApiError) {
    if (error.details) {
      return error.details;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to send your feedback. Please try again.";
}
