import { LegalPage, type LegalSection } from "@/marketing/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Logo.dev",
    paragraphs: [
      <>
        Company and school logos are provided by{" "}
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
  return <LegalPage title="Attributions" lastUpdated="December 30, 2025" sections={sections} />;
}
