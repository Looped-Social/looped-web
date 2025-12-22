import { useState } from "react";

import { PageShell } from "~/components/PageShell/PageShell";

type FAQItemProps = {
  question: string;
  answer: string;
};

const faqs: FAQItemProps[] = [
  {
    question: "What is Looped?",
    answer:
      "Looped is a workplace-verified social iOS app where employees and students can connect and communicate pseudonymously within their company or school communities. Think of it as a safe space for honest workplace conversations.",
  },
  {
    question: "How does verification work?",
    answer:
      "You verify your employment or student status using your work or school email address. Once verified, you can join your company or school's community on Looped while maintaining your pseudonymous identity.",
  },
  {
    question: "Is Looped anonymous?",
    answer:
      "Looped is pseudonymous, not fully anonymous. While your real identity isn't revealed to other users, we verify your status and may disclose information if required by law or to protect our community.",
  },
  {
    question: "Is Looped available on Android?",
    answer: "Currently, Looped is only available on iOS. We're focused on delivering the best experience for iPhone users first.",
  },
  {
    question: "How do I download Looped?",
    answer:
      "You can download Looped from the App Store on your iPhone. Search for “Looped” or tap the download button on our homepage.",
  },
  {
    question: "Can I join multiple company communities?",
    answer:
      "Yes! If you're verified at multiple companies or schools, you can participate in all of their communities on Looped.",
  },
  {
    question: "What kind of content is allowed?",
    answer:
      "We encourage honest workplace discussions, but content must not be illegal, harassing, threatening, or violate others' privacy. Please review our Terms of Service for full guidelines.",
  },
  {
    question: "How do you handle harassment or inappropriate content?",
    answer:
      "We take community safety seriously. Users can report inappropriate content, and our moderation team reviews reports promptly. Accounts violating our Terms of Service may be suspended or terminated.",
  },
  {
    question: "Can my employer see what I post?",
    answer:
      "Your posts are pseudonymous and not linked to your real identity within the app. However, we may disclose information if legally required to do so.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "You can delete your account at any time through the app settings. This action is permanent and will remove all your data from Looped.",
  },
  {
    question: "Who can I contact for support?",
    answer: "For support inquiries, email us at support@looped.app. We typically respond within 24–48 hours.",
  },
];

export function FAQPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <header className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">FAQ</p>
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="text-lg leading-8 text-text-secondary">Find answers to common questions about Looped.</p>
        </header>

        <div className="divide-y divide-border rounded-2xl border border-border bg-bg shadow-sm">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>

        <div className="rounded-2xl border border-border p-6 text-center shadow-sm md:p-8">
          <h3 className="text-xl font-semibold text-strong">Still have questions?</h3>
          <p className="mt-2 text-base leading-7 text-text-secondary">
            Can't find the answer you're looking for? Contact us at{" "}
            <a className="font-semibold text-brand hover:text-brand/90" href="mailto:support@looped.app">
              support@looped.app
            </a>
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="px-5 py-4">
      <button
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-strong">{question}</span>
        <span className="text-lg text-text-light">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <p className="mt-3 text-base leading-7 text-text-secondary">{answer}</p>}
    </div>
  );
}
