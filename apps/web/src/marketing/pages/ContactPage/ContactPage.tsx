import { useState } from "react";
import { Link } from "react-router";

import { PageShell } from "@/marketing/components/PageShell/PageShell";
import { SocialIconLinks } from "@/marketing/components/SocialIconLinks/SocialIconLinks";
import { FeedbackApiError, submitFeedback } from "@/lib/feedbackApi";

const contacts = [
  {
    title: "General inquiries",
    copy: "Questions about Looped or need help getting started?",
    email: "support@looped.app",
  },
  {
    title: "Bug reports",
    copy: "Found a bug or technical issue? Let us know so we can fix it.",
    email: "bugs@looped.app",
  },
  {
    title: "Press & media",
    copy: "Journalists and media inquiries welcome.",
    email: "press@looped.app",
  },
  {
    title: "Business & partnerships",
    copy: "Interested in partnering with Looped?",
    email: "business@looped.app",
  },
];

const feedbackSuccessMessages = [
  "Thanks for your message. It just landed with our team.",
  "Got it, thank you. We read every note and this helps a lot.",
  "Message received. Thanks for helping us make Looped better.",
];

export function ContactPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState(feedbackSuccessMessages[0]);

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
      setSuccessMessage(feedbackSuccessMessages[Math.floor(Math.random() * feedbackSuccessMessages.length)]);
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
      <div className="mx-auto flex max-w-6xl flex-col gap-12 md:gap-14">
        <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="max-w-3xl">
            <h1 className="max-w-[10ch] text-[3rem] font-semibold leading-[0.95] tracking-[-0.05em] text-strong sm:text-[4rem] md:text-[4.75rem]">
              Get in touch
            </h1>
            <p className="mt-6 max-w-[34ch] text-lg leading-8 text-text-secondary sm:text-xl">
              Reach out with questions, product feedback, bugs, press inquiries, or partnership ideas.
            </p>
            <p className="mt-4 max-w-[34ch] text-base leading-8 text-text-secondary">
              We read every message. If you include your email, we can reply directly.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-border bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] lg:p-8"
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-strong">Message or feedback</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Share feedback, ideas, or issues. We will get it to the right place.
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
                  className="w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
                  className="min-h-[160px] w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="Tell us what you need."
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
                  className="w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="you@company.com"
                />
              </div>

              {submitError ? (
                <div className="rounded-2xl border border-brand/20 bg-brand/8 px-4 py-3 text-sm text-brand">
                  {submitError}
                </div>
              ) : null}

              {status === "success" ? (
                <div
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  role="status"
                  aria-live="polite"
                >
                  <p className="font-medium">{successMessage}</p>
                  <p className="mt-1 text-emerald-600">If you shared an email, we can follow up there.</p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Sending..." : "Send feedback"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">Other ways to reach us</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {contacts.map((item) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-border bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)]"
              >
                <h3 className="text-xl font-semibold text-strong">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-text-secondary">{item.copy}</p>
                <a
                  className="mt-4 inline-block text-sm font-semibold text-brand hover:text-brand/90"
                  href={`mailto:${item.email}`}
                >
                  {item.email}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-strong md:text-4xl">Connect elsewhere</h2>
            <p className="mt-4 max-w-[32ch] text-base leading-8 text-text-secondary">
              Follow Looped for product updates, announcements, and community highlights.
            </p>
            <div className="mt-6">
              <SocialIconLinks />
            </div>
          </div>

          <div className="rounded-[2rem] bg-bg-muted/55 p-7 lg:p-8">
            <h3 className="text-2xl font-semibold tracking-tight text-strong">Need a quick answer?</h3>
            <p className="mt-4 text-base leading-8 text-text-secondary">
              We typically respond within 24 to 48 hours on business days. For common questions, check the{" "}
              <Link className="font-semibold text-brand hover:text-brand/90" to="/faq">
                FAQ
              </Link>
              .
            </p>
            <div className="mt-6">
              <Link
                to="/faq"
                className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
              >
                Visit FAQ
              </Link>
            </div>
          </div>
        </section>
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
