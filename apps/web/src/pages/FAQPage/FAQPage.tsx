import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { PageShell } from "~/components/PageShell/PageShell";

type FAQItemProps = {
  id: string;
  question: string;
  answer: ReactNode;
  defaultOpen?: boolean;
};

const faqs: FAQItemProps[] = [
  {
    id: "what-is-looped",
    question: "What is Looped?",
    answer:
      "Looped is a company- and school-verified social media app. Companies and schools are the main communities. After you join a company, you can join up to 2 Fields. After you join at least one school, you can join up to 2 Majors.",
  },
  {
    id: "can-i-view-posts-without-verification",
    question: "Can I view posts without verification?",
    answer:
      "Yes. Anyone can view posts. Verification is required to join and post in company and school communities. Fields and majors unlock after you join a company or school, respectively.",
  },
  {
    id: "how-does-verification-work",
    question: "How does verification work?",
    answer:
      "Verification can be completed two ways. If you have a company or school email, we send a verification email and you are approved quickly. You can also upload a photo of your face and an ID, which takes longer. You must re-verify your information yearly.",
  },
  {
    id: "is-looped-anonymous",
    question: "Is Looped anonymous?",
    answer:
      "Looped is anonymous and not. You have an anonymous profile and a public-facing profile, and there is no link between them. We use cryptographic protocols to ensure that even if all of our data were exposed, those profiles cannot be linked.",
  },
  {
    id: "how-do-i-back-up-my-anonymous-profile",
    question: "How do I back up my anonymous profile?",
    answer:
      "Go to Settings and open Anonymous Backup. Create a passphrase and copy the code shown to you. When you sign in on another account and want your anonymous profile, enter the passphrase and code to restore it.",
  },
  {
    id: "what-if-i-lose-my-anonymous-backup",
    question: "What if I lose my anonymous backup?",
    answer:
      "If you are signed out and lose the passphrase or code, we cannot recover it and you will need to create a new anonymous profile. If you are still signed in, you can set a new passphrase and copy a new code to replace your backup.",
  },
  {
    id: "is-looped-available-on-android",
    question: "Is Looped available on Android?",
    answer:
      "Currently, Looped is only available on iOS. We're focused on delivering the best experience for iPhone users first.",
  },
  {
    id: "does-looped-have-a-web-app",
    question: "Does Looped have a web app?",
    answer: (
      <>
        No. We're working on it and it's on our priority list. For now, you can sign in on the web to{" "}
        <Link className="font-semibold text-brand hover:text-brand/90" to="/delete-account">
          manage account deletion
        </Link>
        .
      </>
    ),
  },
  {
    id: "how-do-i-download-looped",
    question: "How do I download Looped?",
    answer:
      "You can download Looped from the App Store on your iPhone. Search for \"Looped\" or tap the download button on our homepage.",
  },
  {
    id: "can-i-join-multiple-communities",
    question: "Can I join multiple communities?",
    answer:
      "Yes. If you're verified at multiple companies and schools, you can participate in all of the communities you qualify for. After you join a company you can join up to 2 Fields, and after you join at least one school you can join up to 2 Majors.",
  },
  {
    id: "how-do-major-and-department-communities-work",
    question: "How do Fields and Majors work?",
    answer:
      "Fields unlock after you join a company, and you can join up to 2. Majors unlock after you join at least one school, and you can join up to 2.",
  },
  {
    id: "what-kind-of-content-is-allowed",
    question: "What kind of content is allowed?",
    answer:
      "We encourage honest discussions, but content must not be illegal, harassing, threatening, or violate others' privacy. Please review our User Agreement and Content Policy for full guidelines.",
  },
  {
    id: "how-do-you-handle-harassment-or-inappropriate-content",
    question: "How do you handle harassment or inappropriate content?",
    answer:
      "We take community safety seriously. Users can report inappropriate content, and our moderation team reviews reports promptly. Accounts violating our User Agreement may be suspended or terminated.",
  },
  {
    id: "can-my-employer-see-what-i-post",
    question: "Can my employer see what I post?",
    answer:
      "Your anonymous profile is not linked to your public-facing profile, and we use cryptographic protocols to prevent linking. We may disclose information if legally required to do so.",
  },
  {
    id: "how-do-i-delete-my-account",
    question: "How do I delete my account?",
    answer: (
      <>
        You can delete your account through the iOS app settings or by{" "}
        <Link className="font-semibold text-brand hover:text-brand/90" to="/delete-account">
          signing in on the web to delete your data
        </Link>
        . This action is permanent and will remove all your data from Looped.
      </>
    ),
  },
  {
    id: "who-can-i-contact-for-support",
    question: "Who can I contact for support?",
    answer: "For support inquiries, email us at support@looped.app. We typically respond within 24–48 hours.",
  },
];

export function FAQPage() {
  const location = useLocation();
  const hashTarget = location.hash ? location.hash.slice(1) : "";

  useEffect(() => {
    if (!hashTarget) return;

    const el = document.getElementById(hashTarget);
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hashTarget]);

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
            <FAQItem key={faq.id} {...faq} defaultOpen={faq.id === hashTarget} />
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

function FAQItem({ id, question, answer, defaultOpen }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultOpen));

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  return (
    <div id={id} className="scroll-mt-28 px-5 py-4">
      <button
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
      >
        <span className="text-base font-semibold text-strong">{question}</span>
        <span className="text-lg text-text-light">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <p id={`${id}-content`} className="mt-3 text-base leading-7 text-text-secondary">
          {answer}
        </p>
      )}
    </div>
  );
}
