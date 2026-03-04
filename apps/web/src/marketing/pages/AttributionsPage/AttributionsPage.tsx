import { LegalPage, type LegalSection } from "@/marketing/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Freepik",
    paragraphs: [
      <>
        Privacy illustration{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://www.freepik.com/free-vector/global-data-security-personal-data-security-cyber-data-security-online-concept-illustration-internet-security-information-privacy-protection_12953596.htm"
          target="_blank"
          rel="noreferrer"
        >
          Global data security, personal data security, cyber data security online concept illustration, internet
          security or information privacy &amp; protection
        </a>{" "}
        by{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://www.freepik.com/author/jcomp"
          target="_blank"
          rel="noreferrer"
        >
          jcomp
        </a>{" "}
        on{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://www.freepik.com"
          target="_blank"
          rel="noreferrer"
        >
          Freepik
        </a>
        .
      </>,
      <>
        Attribution line for website use:{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://www.freepik.com"
          target="_blank"
          rel="noreferrer"
        >
          Designed by Freepik
        </a>
        .
      </>,
    ],
  },
  {
    title: "Logo.dev",
    paragraphs: [
      <>
        Company logos are provided by{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://logo.dev"
          target="_blank"
          rel="noreferrer"
        >
          Logo.dev
        </a>
        .
      </>,
    ],
  },
  {
    title: "Storyset",
    paragraphs: [
      <>
        Character illustrations are provided by{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://storyset.com"
          target="_blank"
          rel="noreferrer"
        >
          Storyset
        </a>
        .
      </>,
    ],
  },
  {
    title: "Font Awesome",
    paragraphs: [
      <>
        Icons are provided by{" "}
        <a
          className="font-semibold text-brand hover:text-brand/90"
          href="https://fontawesome.com"
          target="_blank"
          rel="noreferrer"
        >
          Font Awesome
        </a>
        .
      </>,
    ],
  },
  {
    title: "Rights",
    paragraphs: [
      "All third-party assets remain the property of their respective owners.",
    ],
  },
];

export function AttributionsPage() {
  return <LegalPage title="Attributions" lastUpdated="March 4, 2026" sections={sections} />;
}
