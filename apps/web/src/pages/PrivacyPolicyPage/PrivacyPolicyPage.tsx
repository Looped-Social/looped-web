import { Link } from "react-router";

import { LegalPage, type LegalSection } from "~/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Privacy Notice",
    paragraphs: [
      "This Privacy Notice for Vance and Preston (doing business as Looped Social) (\"we,\" \"us,\" or \"our\"), describes how and why we might access, collect, store, use, and/or share (\"process\") your personal information when you use our services (\"Services\"), including when you:",
    ],
    bullets: [
      "Visit our website at https://www.mylooped.app or any website of ours that links to this Privacy Notice",
      "Use Looped Inc.. Looped Inc. provides a social connection platform designed to help users form authentic communities online, with content made by people for people. We maintain every post comes from a verified user with verified credentials.",
      "Engage with us in other related ways, including any sales, marketing, or events",
    ],
    subSections: [
      {
        title: "Questions or concerns?",
        paragraphs: [
          "Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at info@mylooped.app.",
        ],
      },
    ],
  },
  {
    title: "Summary of Key Points",
    paragraphs: [
      "This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by using the table of contents below.",
    ],
    bullets: [
      "What personal information do we process? We may process personal information depending on how you interact with us, the choices you make, and the features you use.",
      "Do we process any sensitive personal information? Yes, in some cases, with consent or as permitted by law.",
      "Do we collect information from third parties? No.",
      "How do we process your information? To provide, improve, administer Services, communicate, ensure security, prevent fraud, and comply with law.",
      "How do we keep your information safe? Through organizational and technical safeguards, though no system is 100% secure.",
      "What are your rights? Rights vary by location and may include access, correction, deletion, and opt-out rights.",
      "How do you exercise your rights? Visit https://www.mylooped.app/terms or contact us.",
    ],
  },
  {
    title: "Table of Contents",
    bullets: [
      "1. What Information Do We Collect?",
      "2. How Do We Process Your Information?",
      "3. What Legal Bases Do We Rely On to Process Your Personal Information?",
      "4. When and With Whom Do We Share Your Personal Information?",
      "5. What Is Our Stance on Third-Party Websites?",
      "6. Do We Use Cookies and Other Tracking Technologies?",
      "7. Do We Offer Artificial Intelligence-Based Products?",
      "8. How Do We Handle Your Social Logins?",
      "9. How Long Do We Keep Your Information?",
      "10. How Do We Keep Your Information Safe?",
      "11. Do We Collect Information From Minors?",
      "12. What Are Your Privacy Rights?",
      "13. Controls for Do-Not-Track Features",
      "14. Do United States Residents Have Specific Privacy Rights?",
      "15. Do We Make Updates to This Notice?",
      "16. How Can You Contact Us About This Notice?",
      "17. How Can You Review, Update, or Delete the Data We Collect From You?",
    ],
  },
  {
    title: "1. What Information Do We Collect?",
    subSections: [
      {
        title: "Personal information you disclose to us",
        paragraphs: ["We collect personal information you voluntarily provide, including:"],
        bullets: ["job titles", "usernames", "passwords", "contact or authentication data"],
      },
      {
        title: "Sensitive Information",
        paragraphs: ["With consent or as permitted by law, we may process:"],
        bullets: ["financial data", "student data", "social security numbers or government identifiers"],
      },
      {
        title: "Social Media Login Data",
        paragraphs: [
          "If you register using social media accounts (e.g., Facebook or X), we collect profile information as described later.",
        ],
      },
      {
        title: "Information automatically collected",
        paragraphs: ["Automatically collected information includes:"],
        bullets: [
          "IP address",
          "device and browser characteristics",
          "operating system",
          "usage data",
          "log and diagnostic data",
        ],
      },
      {
        title: "Cookies and similar technologies",
        paragraphs: ["We also collect data via cookies and similar technologies."],
      },
    ],
  },
  {
    title: "2. How Do We Process Your Information?",
    paragraphs: ["We process information to:"],
    bullets: [
      "create and manage accounts",
      "deliver services",
      "provide support",
      "send administrative communications",
      "fulfill orders",
      "enable user-to-user communication",
      "request feedback",
      "send marketing communications",
      "deliver targeted advertising",
      "protect Services",
      "analyze usage trends",
      "verify user legitimacy and humanity",
    ],
  },
  {
    title: "3. What Legal Bases Do We Rely On to Process Your Personal Information?",
    paragraphs: ["Depending on jurisdiction, we rely on:"],
    bullets: ["Consent", "Performance of a contract", "Legitimate interests", "Legal obligations", "Vital interests"],
    subSections: [
      {
        title: "Canada residents",
        paragraphs: ["Additional lawful bases apply for Canada residents."],
      },
    ],
  },
  {
    title: "4. When and With Whom Do We Share Personal Information?",
    subSections: [
      {
        title: "We may share data with",
        bullets: [
          "Ad Networks",
          "Cloud Computing Services",
          "Analytics Providers",
          "Finance and Accounting Tools",
          "Social Networks",
          "Authentication Services",
        ],
      },
      {
        title: "We may also share data during",
        bullets: [
          "Business transfers",
          "With affiliates",
          "With business partners",
          "With other users when content is public",
        ],
      },
    ],
  },
  {
    title: "5. What Is Our Stance on Third-Party Websites?",
    paragraphs: [
      "We are not responsible for third-party sites or services linked from our Services. Data shared with third parties is governed by their policies.",
    ],
  },
  {
    title: "6. Do We Use Cookies and Other Tracking Technologies?",
    paragraphs: ["We use cookies, pixels, and similar tools for:"],
    bullets: ["security", "functionality", "analytics", "advertising"],
    subSections: [
      {
        title: "Opt-out options",
        paragraphs: ["Users can opt out under applicable US state laws."],
      },
      {
        title: "Google Analytics",
        paragraphs: ["We use Google Analytics. Opt-out instructions are provided."],
      },
    ],
  },
  {
    title: "7. Do We Offer Artificial Intelligence-Based Products?",
    paragraphs: ["We offer AI-powered features, including:"],
    bullets: ["Image analysis"],
    subSections: [
      {
        title: "AI processing",
        paragraphs: ["All AI processing follows this Privacy Policy."],
      },
    ],
  },
  {
    title: "8. How Do We Handle Your Social Logins?",
    paragraphs: [
      "If you log in via third-party platforms, we receive profile information from those providers. We do not control their data practices.",
    ],
  },
  {
    title: "9. How Long Do We Keep Your Information?",
    paragraphs: [
      "We retain personal information only as long as necessary. No data is kept longer than six months after account termination, unless legally required.",
    ],
  },
  {
    title: "10. How Do We Keep Your Information Safe?",
    paragraphs: ["We use reasonable technical and organizational safeguards. Absolute security cannot be guaranteed."],
  },
  {
    title: "11. Do We Collect Information From Minors?",
    paragraphs: ["We do not knowingly collect data from individuals under 18. If discovered, accounts are deactivated and data deleted."],
  },
  {
    title: "12. What Are Your Privacy Rights?",
    paragraphs: ["Depending on location, rights may include:"],
    bullets: ["access", "correction", "deletion", "restriction", "portability", "objection", "human review of automated decisions"],
  },
  {
    title: "13. Controls for Do-Not-Track Features",
    paragraphs: ["We do not currently respond to DNT signals due to lack of standards."],
  },
  {
    title: "14. Do United States Residents Have Specific Privacy Rights?",
    paragraphs: ["Residents of certain US states have rights including:"],
    bullets: [
      "access",
      "correction",
      "deletion",
      "opt-out of sale or targeted advertising",
      "limitation of sensitive data use",
    ],
    subSections: [
      {
        title: "Additional details",
        paragraphs: ["Detailed category tables are included in the policy."],
      },
    ],
  },
  {
    title: "15. Do We Make Updates to This Notice?",
    paragraphs: ["We may update this policy. Material changes will be communicated."],
  },
  {
    title: "16. How Can You Contact Us About This Notice?",
    paragraphs: [
      "Email: info@mylooped.app",
      "Mail: Vance and Preston",
      "8612 Aberdeen Wood CT",
      "Charlotte, NC 28226",
      "United States",
    ],
  },
  {
    title: "17. How Can You Review, Update, or Delete the Data We Collect From You?",
    paragraphs: [
      <>
        Requests can be submitted at:{" "}
        <Link className="font-semibold text-brand hover:text-brand/90" to="/delete-account">
          https://www.mylooped.app/delete-account
        </Link>
      </>,
    ],
  },
];

export function PrivacyPolicyPage() {
  return <LegalPage title="Privacy Policy" lastUpdated="October 11, 2025" sections={sections} />;
}
