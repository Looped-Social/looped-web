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
      "Looped is a workplace- and college-verified social media app. You can view posts without verification, but to post in a community (workplace, school, or sector) you must be verified in that community.",
  },
  {
    question: "Can I view posts without verification?",
    answer:
      "Yes. Anyone can view posts. Verification is required to post or participate in a community.",
  },
  {
    question: "How does verification work?",
    answer:
      "Verification can be completed two ways. If you have a company or school email, we send a verification email and you are approved quickly. You can also upload a photo of your face and an ID, which takes longer. You must re-verify your information yearly.",
  },
  {
    question: "Is Looped anonymous?",
    answer:
      "Looped is anonymous and not. You have an anonymous profile and a public-facing profile, and there is no link between them. We use cryptographic protocols to ensure that even if all of our data were exposed, those profiles cannot be linked.",
  },
  {
    question: "How do I back up my anonymous profile?",
    answer:
      "Go to Settings and open Anonymous Backup. Create a passphrase and copy the code shown to you. When you sign in on another account and want your anonymous profile, enter the passphrase and code to restore it.",
  },
  {
    question: "What if I lose my anonymous backup?",
    answer:
      "If you are signed out and lose the passphrase or code, we cannot recover it and you will need to create a new anonymous profile. If you are still signed in, you can set a new passphrase and copy a new code to replace your backup.",
  },
  {
    question: "Is Looped available on Android?",
    answer:
      "Currently, Looped is only available on iOS. We're focused on delivering the best experience for iPhone users first.",
  },
  {
    question: "How do I download Looped?",
    answer:
      "You can download Looped from the App Store on your iPhone. Search for \"Looped\" or tap the download button on our homepage.",
  },
  {
    question: "Can I join multiple communities?",
    answer:
      "Yes. If you're verified at multiple workplaces, schools, or sectors, you can participate in all of their communities on Looped.",
  },
  {
    question: "What kind of content is allowed?",
    answer:
      "We encourage honest discussions, but content must not be illegal, harassing, threatening, or violate others' privacy. Please review our User Agreement and Content Policy for full guidelines.",
  },
  {
    question: "How do you handle harassment or inappropriate content?",
    answer:
      "We take community safety seriously. Users can report inappropriate content, and our moderation team reviews reports promptly. Accounts violating our User Agreement may be suspended or terminated.",
  },
  {
    question: "Can my employer see what I post?",
    answer:
      "Your anonymous profile is not linked to your public-facing profile, and we use cryptographic protocols to prevent linking. We may disclose information if legally required to do so.",
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
