import { LegalPage, type LegalSection } from "~/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By accessing or using Looped, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.",
    ],
  },
  {
    title: "2. Eligibility",
    paragraphs: [
      "You must be at least 16 years old and employed or enrolled as a student at a verified institution to use Looped. By using the service, you represent that you meet these requirements.",
    ],
  },
  {
    title: "3. Account Registration",
    paragraphs: ["To use Looped, you must create an account and verify your employment or student status. You are responsible for:"],
    bullets: [
      "Maintaining the confidentiality of your account credentials",
      "All activities that occur under your account",
      "Notifying us immediately of any unauthorized use",
    ],
  },
  {
    title: "4. User Conduct",
    paragraphs: ["You agree not to:"],
    bullets: [
      "Post content that is illegal, harmful, threatening, or harassing",
      "Impersonate others or provide false information",
      "Violate the privacy or rights of others",
      "Attempt to gain unauthorized access to the service",
      "Use automated systems to access or scrape the service",
      "Post spam or engage in manipulative behavior",
    ],
  },
  {
    title: "5. Content and Intellectual Property",
    subSections: [
      {
        title: "5.1 Your content",
        paragraphs: [
          "You retain ownership of content you post on Looped. By posting, you grant us a license to use, modify, and display your content in connection with operating the service.",
        ],
      },
      {
        title: "5.2 Our content",
        paragraphs: [
          "The Looped platform, including its design, features, and branding, is owned by Looped, Inc. and protected by intellectual property laws.",
        ],
      },
    ],
  },
  {
    title: "6. Pseudonymity and Verification",
    paragraphs: [
      "Looped is a pseudonymous platform. While we verify your employment or student status, your identity is not revealed to other users. However, we reserve the right to disclose information if required by law or to protect our service and users.",
    ],
  },
  {
    title: "7. Moderation and Enforcement",
    paragraphs: [
      "We reserve the right to remove content and suspend or terminate accounts that violate these Terms of Service. We may, but are not obligated to, monitor user content.",
    ],
  },
  {
    title: "8. Disclaimers",
    paragraphs: ["Looped is provided \"as is\" without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, or error-free."],
  },
  {
    title: "9. Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, Looped, Inc. shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.",
    ],
  },
  {
    title: "10. Changes to Terms",
    paragraphs: ["We may modify these Terms of Service at any time. Continued use of Looped after changes constitutes acceptance of the modified terms."],
  },
  {
    title: "11. Termination",
    paragraphs: ["You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms or for any other reason."],
  },
  {
    title: "12. Governing Law",
    paragraphs: [
      "These Terms of Service are governed by the laws of the State of California, without regard to conflict of law principles.",
    ],
  },
  {
    title: "13. Contact",
    paragraphs: [
      "For questions about these Terms of Service, contact us at legal@looped.app.",
    ],
  },
];

export function TermsOfServicePage() {
  return <LegalPage title="Terms of Service" lastUpdated="January 1, 2025" sections={sections} />;
}
