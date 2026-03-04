import { Link } from "react-router";

type StorySection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  accent: "brand" | "secondary";
  tone: "light" | "dark";
  backgroundClassName: string;
  textClassName: string;
  bodyClassName: string;
  eyebrowClassName: string;
  frameClassName: string;
  surfaceClassName: string;
  sideLabelTop: string;
  sideLabelBottom: string;
};

const sections: StorySection[] = [
  {
    id: "anonymous",
    eyebrow: "",
    title: "Be honest without losing trust.",
    body:
      "Pseudonymous posting helps people speak more openly, while verified communities keep the space grounded and credible.",
    ctaLabel: "Privacy pledge",
    ctaTo: "/privacy",
    accent: "brand",
    tone: "light",
    backgroundClassName: "bg-secondary/24",
    textClassName: "text-strong",
    bodyClassName: "text-text-secondary",
    eyebrowClassName: "text-secondary/85",
    frameClassName: "border-secondary/20 bg-white/36",
    surfaceClassName: "border-secondary/18 bg-white/48",
    sideLabelTop: "Pseudonymous",
    sideLabelBottom: "Verified members",
  },
  {
    id: "find-your-people",
    eyebrow: "Find your people",
    title: "Start with the people around you.",
    body:
      "Find coworkers, classmates, majors, and fields that actually matter to your day-to-day life.",
    ctaLabel: "Learn more",
    ctaTo: "/about",
    accent: "secondary",
    tone: "light",
    backgroundClassName: "bg-brand/8",
    textClassName: "text-strong",
    bodyClassName: "text-text-secondary",
    eyebrowClassName: "text-brand/70",
    frameClassName: "border-brand/14 bg-brand/[0.05]",
    surfaceClassName: "border-brand/12 bg-white/55",
    sideLabelTop: "Workplaces",
    sideLabelBottom: "Campuses",
  },
  {
    id: "signal",
    eyebrow: "Built for better conversations",
    title: "Less noise. More context.",
    body:
      "Looped feels smaller, sharper, and more useful because the people in the room are real and relevant to you.",
    ctaLabel: "How verification works",
    ctaTo: "/faq#how-does-verification-work",
    accent: "brand",
    tone: "light",
    backgroundClassName: "bg-brand/8",
    textClassName: "text-strong",
    bodyClassName: "text-text-secondary",
    eyebrowClassName: "text-brand/70",
    frameClassName: "border-brand/14 bg-brand/[0.05]",
    surfaceClassName: "border-brand/12 bg-white/55",
    sideLabelTop: "Local context",
    sideLabelBottom: "Real communities",
  },
];

function StoryPanel({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaTo,
  accent,
  tone,
  backgroundClassName,
  textClassName,
  bodyClassName,
  eyebrowClassName,
  frameClassName,
  surfaceClassName,
  sideLabelTop,
  sideLabelBottom,
}: StorySection) {
  const accentClasses = accent === "brand" ? "bg-brand text-white" : "bg-secondary text-white";

  return (
    <section
      data-home-tone={tone}
      className={`min-h-screen snap-start snap-always ${backgroundClassName}`}
    >
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-32 pt-28 sm:px-6 sm:pb-36 sm:pt-32 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-8 lg:pb-40 lg:pt-36">
        <div className="max-w-[560px]">
          <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${eyebrowClassName}`}>{eyebrow}</p>
          <h2 className={`mt-5 max-w-[10ch] text-[3rem] font-semibold leading-[0.96] tracking-[-0.05em] sm:text-[4.15rem] lg:text-[5.2rem] ${textClassName}`}>
            {title}
          </h2>
          <p className={`mt-6 max-w-[30ch] text-lg leading-8 sm:text-xl ${bodyClassName}`}>{body}</p>
          <Link
            to={ctaTo}
            className={`mt-9 inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold transition hover:opacity-90 ${accentClasses}`}
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <div className="grid w-full max-w-[560px] grid-cols-[0.9fr_1.1fr] gap-4 sm:gap-5">
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className={`min-h-[160px] rounded-[2rem] border ${frameClassName}`} />
              <div className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${accentClasses}`}>
                {sideLabelTop}
              </div>
            </div>
            <div className="flex flex-col gap-4 pt-10 sm:gap-5">
              <div className={`min-h-[220px] rounded-[2rem] border ${surfaceClassName}`} />
              <div className={`min-h-[110px] rounded-[2rem] border ${frameClassName}`} />
              <div
                className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-semibold ${
                  tone === "dark" ? "border-white/14 text-white/72" : "border-brand/18 text-text-secondary"
                }`}
              >
                {sideLabelBottom}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeStorySections() {
  return (
    <>
      {sections.map((section) => (
        <StoryPanel key={section.title} {...section} />
      ))}
    </>
  );
}
