import { LegalPage, type LegalSection } from "~/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Looped User Agreement",
    paragraphs: [
      "Effective Date: December 28th, 2025.",
      "Last Updated: December 28th, 2025.",
      "Welcome to Looped! These Terms of Use (\"Terms,\" \"Agreement\") govern your access to and use of Looped Inc.'s websites, mobile applications, and related services (collectively, the \"Service\").",
      "By creating an account, accessing, or using Looped, you agree to these Terms. If you do not agree, do not use the Service.",
    ],
  },
  {
    title: "1. Who We Are",
    paragraphs: [
      "Looped Inc. (\"Looped,\" \"we,\" \"our,\" or \"us\") is a North Carolina-based company providing a digital platform that enables verified, human users to form authentic online communities (\"Loops\").",
    ],
  },
  {
    title: "2. Eligibility",
    paragraphs: [
      "You must be at least 18 years old to use Looped.",
      "By using the Service, you represent that:",
    ],
    bullets: [
      "You are a real individual (no automated or AI-generated accounts).",
      "You have the legal capacity to enter this Agreement.",
      "Your use complies with applicable laws where you live.",
    ],
  },
  {
    title: "3. Account Registration & Verification",
    paragraphs: [
      "You may be required to verify your identity (photo, video, or other means) before accessing or posting.",
      "You agree to:",
    ],
    bullets: [
      "Provide accurate, current information.",
      "Maintain only one personal account.",
      "Keep your login credentials secure and confidential.",
      "You are responsible for all activity on your account.",
    ],
  },
  {
    title: "4. Acceptable Use",
    paragraphs: ["You agree not to, and will not assist others to:"],
    bullets: [
      "1. Use Looped for unlawful, harmful, or deceptive purposes.",
      "2. Harass, threaten, or defame others.",
      "3. Post or share content that is obscene, violent, discriminatory, or otherwise violates our Content Policy.",
      "4. Attempt to scrape, copy, or reverse engineer the platform.",
      "5. Use bots, scripts, or automated systems of any kind.",
      "6. Interfere with the security or operation of Looped.",
      "Violation of these rules may result in content removal, suspension, or permanent account termination.",
    ],
  },
  {
    title: "5. Content You Share",
    bullets: [
      "Your Ownership: You retain ownership of content you create and post.",
      "Our License: By posting, you grant Looped a worldwide, non-exclusive, royalty-free license to host, display, and distribute your content on the Service for the purpose of operating and improving Looped.",
      "Your Responsibility: You must have the rights to any content you share and ensure it does not violate others' rights or laws.",
      "We may remove or restrict access to any content that violates these Terms or our Content Policy.",
    ],
  },
  {
    title: "6. Privacy",
    paragraphs: [
      "Your privacy matters to us.",
      "Our Privacy Policy explains how we collect, use, and protect your data.",
      "By using Looped, you consent to the data practices described there.",
    ],
  },
  {
    title: "7. Intellectual Property",
    paragraphs: [
      "All intellectual property in the Looped platform (software, logos, design, trademarks, etc.) is owned by Looped Inc. or its licensors.",
      "You may not copy, modify, distribute, or exploit any part of Looped without written permission.",
    ],
  },
  {
    title: "8. Termination",
    paragraphs: [
      "We may suspend or terminate your access at any time if:",
    ],
    bullets: [
      "You violate these Terms or the Content Policy.",
      "We believe your behavior risks harm to other users or to Looped.",
      "We discontinue the Service.",
      "You may delete your account at any time through your profile settings.",
    ],
  },
  {
    title: "9. Disclaimers",
    paragraphs: [
      "The Service is provided \"as is\" without warranties of any kind, express or implied.",
      "Looped does not guarantee uninterrupted service, accuracy of information, or that Looped will be error-free or secure.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    paragraphs: [
      "To the maximum extent permitted by law, Looped and its affiliates will not be liable for:",
    ],
    bullets: [
      "Indirect, incidental, consequential, or punitive damages.",
      "Lost profits, data, or goodwill.",
      "Any damages exceeding $100 USD or the amount you paid to Looped in the past 12 months (whichever is greater).",
      "Some jurisdictions do not allow these limits; in those cases, the limits apply to the fullest extent permitted.",
    ],
  },
  {
    title: "11. Indemnification",
    paragraphs: [
      "You agree to indemnify and hold harmless Looped, its officers, employees, and partners from any claims or damages arising out of:",
    ],
    bullets: ["Your content.", "Your use or misuse of the Service.", "Your violation of this Agreement or applicable laws."],
  },
  {
    title: "12. Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time.",
      "If changes are material, we will notify you by email, in-app message, or banner notice.",
      "Continued use of Looped after updates means you accept the new Terms.",
    ],
  },
  {
    title: "13. Governing Law & Dispute Resolution",
    paragraphs: [
      "These Terms are governed by the laws of the State of North Carolina, U.S.A., without regard to conflict-of-law rules.",
      "Any dispute shall be resolved exclusively in the state or federal courts located in Wake County, NC.",
      "You agree to submit to their jurisdiction.",
    ],
  },
  {
    title: "14. Contact Us",
    paragraphs: ["Questions or concerns?", "Looped Inc.", "[Company Address]", "Raleigh, North Carolina, USA"],
  },
];

export function TermsOfServicePage() {
  return <LegalPage title="User Agreement" lastUpdated="December 28, 2025" sections={sections} />;
}
