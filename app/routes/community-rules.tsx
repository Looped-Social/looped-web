import type { Route } from "./+types/community-rules";

import { LegalPage, type LegalSection } from "../components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "1. Be respectful",
    paragraphs: [
      "Looped is a workplace community built on mutual respect. Treat others as you would want to be treated in a professional environment.",
    ],
    bullets: [
      "No harassment, bullying, or personal attacks",
      "Respect different viewpoints and perspectives",
      "Keep discussions constructive and professional",
      "No hate speech or discrimination of any kind",
    ],
  },
  {
    title: "2. Maintain pseudonymity",
    paragraphs: ["Looped is designed to be a pseudonymous platform. To protect everyone's privacy:"],
    bullets: [
      "Do not attempt to identify other users",
      "Do not share others' personal information",
      "Keep your own identity private if you choose to",
      "Report any attempts to dox or identify users",
    ],
  },
  {
    title: "3. Keep content appropriate",
    paragraphs: ["Posts and messages should be workplace-appropriate. Remember that your coworkers are reading:"],
    bullets: [
      "No explicit sexual content or NSFW material",
      "No graphic violence or disturbing content",
      "No illegal activities or content",
      "Keep language and topics professional",
    ],
  },
  {
    title: "4. No spam or self-promotion",
    paragraphs: ["Looped is for genuine workplace conversations, not marketing or spam:"],
    bullets: [
      "No unsolicited advertising or promotions",
      "No repetitive or low-quality posts",
      "No pyramid schemes or MLM content",
      "Keep self-promotion minimal and relevant",
    ],
  },
  {
    title: "5. Protect company confidentiality",
    paragraphs: ["While discussing workplace topics, be mindful of confidential information:"],
    bullets: [
      "Do not share trade secrets or proprietary information",
      "Respect NDAs and confidentiality agreements",
      "Avoid sharing sensitive company data",
      "Consider the impact of your posts on your employer",
    ],
  },
  {
    title: "6. Be honest and authentic",
    paragraphs: ["Build trust within your workplace community by being genuine:"],
    bullets: [
      "Do not impersonate others",
      "Do not spread false information or rumors",
      "Verify claims before sharing",
      "Correct mistakes when you make them",
    ],
  },
  {
    title: "7. Report violations",
    paragraphs: ["Help keep Looped safe and welcoming:"],
    bullets: [
      "Report content that violates these rules",
      "Use the reporting tools—don't engage with rule-breakers",
      "Trust the moderation process",
      "Contact support for serious concerns",
    ],
  },
  {
    title: "8. Consequences",
    paragraphs: ["Violations of these Community Rules may result in:"],
    bullets: ["Content removal", "Temporary account suspension", "Permanent account termination", "Reporting to employers or authorities in severe cases"],
  },
  {
    title: "9. Contact us",
    paragraphs: ["Questions about these Community Rules? Contact us at support@looped.app."],
  },
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Community Rules" },
    { name: "description", content: "Guidelines for participating in the Looped community." },
  ];
}

export default function CommunityRules() {
  return <LegalPage title="Community Rules" lastUpdated="January 1, 2025" sections={sections} />;
}
