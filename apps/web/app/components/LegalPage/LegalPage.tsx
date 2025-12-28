import React, { type ReactNode } from "react";

import { PageShell } from "../PageShell/PageShell";

export type LegalSection = {
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
  subSections?: LegalSection[];
};

type LegalPageProps = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalPage({ title, lastUpdated, sections }: LegalPageProps) {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-strong md:text-5xl">
            {title}
          </h1>
          <p className="text-sm font-medium uppercase tracking-wide text-text-light">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-10">
          {sections.map((section, index) => (
            <LegalSectionBlock key={`${section.title}-${index}`} section={section} level={2} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

type LegalSectionBlockProps = {
  section: LegalSection;
  level?: 2 | 3;
};

function LegalSectionBlock({ section, level = 2 }: LegalSectionBlockProps) {
  const titleClass =
    level === 2 ? "text-2xl font-semibold text-strong" : "text-xl font-semibold text-text-primary";

  return (
    <section className="space-y-4">
      <h2 className={titleClass}>{section.title}</h2>

      {section.paragraphs?.map((paragraph, idx) => (
        <p key={idx} className="text-base leading-7 text-text-secondary">
          {paragraph}
        </p>
      ))}

      {section.bullets && (
        <ul className="list-disc space-y-2 pl-6 text-base leading-7 text-text-secondary">
          {section.bullets.map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
          ))}
        </ul>
      )}

      {section.subSections && (
        <div className="space-y-5">
          {section.subSections.map((sub, idx) => (
            <LegalSectionBlock key={`${sub.title}-${idx}`} section={sub} level={3} />
          ))}
        </div>
      )}
    </section>
  );
}
