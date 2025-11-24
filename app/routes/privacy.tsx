import type { Route } from "./+types/privacy";

import { LegalPage, type LegalSection } from "../components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      "Looped is committed to protecting your privacy. We collect only the information necessary to provide our workplace-verified social platform.",
    ],
    subSections: [
      {
        title: "1.1 Account information",
        paragraphs: [
          "When you create an account, we collect your work email address for verification purposes. Your identity remains pseudonymous to other users.",
        ],
      },
      {
        title: "1.2 Usage information",
        paragraphs: ["We collect information about how you interact with Looped, including posts, messages, and engagement with content."],
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    paragraphs: ["We use the information we collect to:"],
    bullets: [
      "Verify your employment or student status",
      "Provide and maintain the Looped platform",
      "Improve user experience and develop new features",
      "Ensure community safety and enforce our Terms of Service",
      "Send important updates about the service",
    ],
  },
  {
    title: "3. Information Sharing",
    paragraphs: ["We do not sell your personal information. We may share information only in the following circumstances:"],
    bullets: ["With your consent", "To comply with legal obligations", "To protect the rights and safety of Looped and our users", "With service providers who assist in operating our platform"],
  },
  {
    title: "4. Data Security",
    paragraphs: ["We implement industry-standard security measures to protect your information. However, no method of transmission over the internet is 100% secure."],
  },
  {
    title: "5. Your Rights",
    paragraphs: ["You have the right to:"],
    bullets: ["Access your personal information", "Request correction of your data", "Request deletion of your account", "Opt-out of certain data collection"],
  },
  {
    title: "6. Children's Privacy",
    paragraphs: ["Looped is not intended for users under 16 years of age. We do not knowingly collect information from children."],
  },
  {
    title: "7. Changes to This Policy",
    paragraphs: ["We may update this Privacy Policy from time to time. We will notify you of any significant changes via email or through the app."],
  },
  {
    title: "8. Contact Us",
    paragraphs: ["If you have questions about this Privacy Policy, please contact us at privacy@looped.app."],
  },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy" },
    { name: "description", content: "How Looped collects, uses, and protects your data." },
  ];
}

export default function PrivacyPolicy() {
  return <LegalPage title="Privacy Policy" lastUpdated="January 1, 2025" sections={sections} />;
}
