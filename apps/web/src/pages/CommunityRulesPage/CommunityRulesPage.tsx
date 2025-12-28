import { LegalPage, type LegalSection } from "~/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "1. Purpose and Scope",
    paragraphs: [
      "Looped exists to enable meaningful, human-centered interaction in verified communities while prioritizing privacy and safety.",
      "This Content Policy defines what content is permitted, restricted, or prohibited on the Looped platform. It applies to all users, communities, posts, messages, media, usernames, and interactions.",
      "Use of Looped constitutes agreement to comply with this policy and any related User Agreement.",
    ],
  },
  {
    title: "2. Core Principles",
    paragraphs: ["Looped is guided by the following principles:"],
    bullets: [
      "Privacy first. Users should be able to participate without being tracked, profiled, or exploited.",
      "Human integrity. Interactions should reflect genuine human participation, not manipulation or deception.",
      "Community safety. Looped does not tolerate content that meaningfully harms individuals or groups.",
      "Expression with responsibility. Open discussion is valued, within boundaries.",
    ],
  },
  {
    title: "3. Allowed Content",
    paragraphs: ["The following content is generally allowed on Looped:"],
    bullets: [
      "Lawful speech, opinions, and discussion, including political, social, cultural, and economic topics.",
      "Personal expression, storytelling, and identity exploration.",
      "Educational, academic, and informational content.",
      "Community organizing and civic engagement that does not promote harm.",
      "Satire, parody, and humor, provided they do not target protected groups with abuse.",
      "Anonymized discussion of sensitive topics, when shared in good faith and without exploitation.",
    ],
  },
  {
    title: "4. Restricted Content",
    paragraphs: [
      "Restricted content may be allowed only in limited, contextual, or clearly labeled settings, or may be subject to reduced visibility:",
      "Looped may apply content warnings, age gating, or visibility limits to such material.",
    ],
    bullets: [
      "Sensitive content involving violence, injury, or death when presented for educational, journalistic, or documentary purposes.",
      "Discussion of illegal activity that is descriptive rather than instructional.",
      "Strong language or profanity that does not rise to harassment or abuse.",
      "Content that may be distressing but is shared with clear warnings and legitimate purpose.",
    ],
  },
  {
    title: "5. Prohibited Content",
    paragraphs: ["The following content is not permitted on Looped:"],
    subSections: [
      {
        title: "5.1 Violence and Harm",
        bullets: [
          "Threats of violence or physical harm toward individuals or groups.",
          "Promotion, glorification, or endorsement of violence.",
          "Instructions or guidance for committing violent or criminal acts.",
        ],
      },
      {
        title: "5.2 Harassment and Hate",
        bullets: [
          "Harassment, bullying, or targeted abuse.",
          "Hate speech directed at protected characteristics, including but not limited to race, ethnicity, nationality, religion, gender, sexual orientation, or disability.",
          "Dehumanizing language or calls for exclusion, removal of rights, or harm toward protected groups.",
        ],
      },
      {
        title: "5.3 Exploitation and Abuse",
        bullets: [
          "Sexual exploitation or abuse, including any content involving minors.",
          "Non-consensual sexual content or imagery.",
          "Coercion, trafficking, or facilitation of exploitation.",
        ],
      },
      {
        title: "5.4 Misinformation and Manipulation",
        bullets: [
          "Coordinated deception intended to mislead users for political, financial, or social manipulation.",
          "Impersonation of individuals, organizations, or institutions in a misleading manner.",
          "Deliberately falsified content presented as fact in high-risk domains such as elections, public safety, or health.",
        ],
      },
      {
        title: "5.5 Privacy Violations",
        bullets: [
          "Sharing private or identifying information about others without consent.",
          "Doxxing or attempts to locate, expose, or intimidate individuals.",
          "Surveillance, tracking, or data harvesting activities.",
        ],
      },
      {
        title: "5.6 Platform Abuse",
        bullets: [
          "Spam, scams, or fraudulent schemes.",
          "Automated or deceptive behavior intended to manipulate engagement or visibility.",
          "Attempts to evade moderation or enforcement systems.",
        ],
      },
      {
        title: "5.7 Public Decency, Sexual Content, and Safe-for-Work Standards",
        paragraphs: [
          "Looped is intended to be a safe, respectful, and broadly accessible environment. Content must meet clear public decency and safe-for-work expectations across the platform unless explicitly designated otherwise by Looped.",
        ],
        subSections: [
          {
            title: "5.7.1 Sexual Content",
            bullets: [
              "Explicit sexual content is not permitted. This includes graphic descriptions of sexual acts, pornography, sexual fetish content, or content intended primarily for sexual arousal.",
              "Sexualized depictions of individuals without their consent are prohibited.",
              "Any sexual content involving minors is strictly prohibited.",
              "Non-graphic references to sexuality may be allowed when clearly contextual, educational, academic, or related to personal experience, and when presented in a respectful manner.",
              "Nudity or sexual imagery intended to shock, provoke, or titillate is not permitted.",
            ],
          },
          {
            title: "5.7.2 Vulgarity and Obscene Language",
            bullets: [
              "Excessive profanity, obscenity, or crude language is discouraged and may be restricted.",
              "Vulgar language directed at individuals or groups in a demeaning, hostile, or sexually aggressive manner is not permitted.",
              "Contextual use of strong language may be allowed when it serves a clear expressive or narrative purpose and does not create a hostile environment.",
            ],
          },
          {
            title: "5.7.3 Safe Space Expectations",
            paragraphs: [
              "Looped is designed to function as a safe space for participation across diverse communities:",
            ],
            bullets: [
              "Content that creates an intimidating, sexually hostile, or degrading environment is not allowed.",
              "Users should be able to engage without being exposed to unsolicited sexual remarks, innuendo, or commentary about their bodies or identities.",
              "Respect for boundaries is required in both public and private interactions.",
            ],
          },
          {
            title: "5.7.4 Safe-for-Work Standard",
            paragraphs: ["Unless Looped explicitly designates a space otherwise:"],
            bullets: [
              "All content must be appropriate for viewing in public or professional settings.",
              "Content that would reasonably be considered NSFW is not permitted.",
              "Attempts to bypass moderation through coded language, partial censorship, or indirect references are treated as violations.",
            ],
          },
          {
            title: "5.7.5 Enforcement",
            paragraphs: [
              "Content that violates this section may be removed, limited in visibility, or result in account-level action. Repeated or intentional violations may lead to suspension or removal from the platform.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "6. Selling, Advertising, and Self-Promotion",
    paragraphs: [
      "Looped is designed for community interaction, not commercial solicitation. To preserve trust, privacy, and signal quality, selling and promotional activity is restricted.",
    ],
    subSections: [
      {
        title: "6.1 Restricted Commercial Activity",
        paragraphs: ["The following are not permitted on Looped:"],
        bullets: [
          "Affiliate marketing, referral links, discount codes, or commission-based promotions.",
          "Repeated promotion of personal businesses, products, services, newsletters, or social media accounts.",
          "Unsolicited advertising sent through posts, comments, or private messages.",
          "Investment solicitations, fundraising pitches, or requests for financial contributions outside explicitly authorized contexts.",
          "Data collection or recruitment primarily for commercial purposes.",
        ],
      },
      {
        title: "6.2 Limited and Contextual Promotion",
        paragraphs: [
          "Limited self-reference may be allowed when it is clearly secondary to genuine participation and relevant to the discussion, for example:",
          "Such content must be factual, non-repetitive, and not framed as a sales pitch.",
        ],
        bullets: [
          "Answering a question with relevant expertise while disclosing an affiliation.",
          "Sharing work or projects when explicitly requested by another user.",
          "Participating in designated spaces or features that Looped may explicitly mark as promotion-allowed.",
        ],
      },
      {
        title: "6.3 Communities and Events",
        bullets: [
          "Community organizers may not use groups primarily as marketing channels.",
          "Events, products, or services may only be promoted within communities if clearly aligned with the community's purpose and permitted by community-level rules.",
          "Looped may create separate, clearly labeled channels or tools for approved announcements or partnerships.",
        ],
      },
      {
        title: "6.4 Enforcement",
        paragraphs: [
          "Violations of this section may result in:",
          "Attempting to bypass these restrictions through indirect language, anonymity, or third parties is treated as a violation.",
        ],
        bullets: [
          "Removal of promotional content.",
          "Reduced visibility or posting restrictions.",
          "Account-level enforcement for repeated or deceptive behavior.",
        ],
      },
    ],
  },
  {
    title: "7. Anonymity and Identity",
    paragraphs: ["Looped supports anonymity and pseudonymity. However:"],
    bullets: [
      "Anonymity may not be used to evade accountability for prohibited behavior.",
      "Identity claims that are materially deceptive and used to manipulate others may be restricted.",
      "Human verification mechanisms may be required to prevent abuse, while preserving user privacy.",
    ],
  },
  {
    title: "8. Enforcement",
    paragraphs: [
      "Looped may take action when content or behavior violates this policy, including:",
      "Enforcement decisions may consider context, intent, severity, and prior behavior.",
    ],
    bullets: [
      "Content removal or visibility reduction.",
      "Warnings or temporary restrictions.",
      "Account suspension or termination.",
      "Community-level moderation actions.",
    ],
  },
  {
    title: "9. Appeals and Review",
    paragraphs: [
      "Users may request review of moderation decisions through designated appeal channels. Looped aims to apply policies consistently and revise them as needed based on community feedback and emerging risks.",
    ],
  },
  {
    title: "10. Policy Evolution",
    paragraphs: [
      "This policy may be updated to reflect changes in law, technology, or community needs. Continued use of Looped after updates constitutes acceptance of the revised policy.",
    ],
  },
];

export function CommunityRulesPage() {
  return (
    <LegalPage
      title="Looped Content Policy"
      lastUpdated="Sunday, December 21st, 2025"
      sections={sections}
    />
  );
}
