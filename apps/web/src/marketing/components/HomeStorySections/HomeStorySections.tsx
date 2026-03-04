import { Link } from "react-router";

import anonymousCompositeImage from "@/assets/marketing/landing-page/anon/Anon-photo.png";
import finalCommunitiesImage from "@/assets/marketing/landing-page/community/last-landingpage.png";

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
  visual?: "stacked-panels" | "anonymous" | "final-image";
};

const sections: StorySection[] = [
  {
    id: "anonymous",
    eyebrow: "",
    title: "Be honest without losing trust.",
    body:
      "Looped uses a cryptographic protocol to separate your anonymous profile from your regular account. We know you're verified in the community, but we cannot link your anonymous posts back to your real identity.",
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
    sideLabelTop: "Cryptographically separated",
    sideLabelBottom: "Verified, not traceable",
    visual: "anonymous",
  },
  {
    id: "find-your-people",
    eyebrow: "",
    title: "Start with the people around you.",
    body:
      "Start in your workplace, then expand into fields that actually matter to your day-to-day work.",
    ctaLabel: "Learn more",
    ctaTo: "/about",
    accent: "brand",
    tone: "light",
    backgroundClassName: "bg-white",
    textClassName: "text-strong",
    bodyClassName: "text-text-secondary",
    eyebrowClassName: "text-brand/70",
    frameClassName: "border-brand/14 bg-brand/[0.05]",
    surfaceClassName: "border-brand/12 bg-white/55",
    sideLabelTop: "Workplaces",
    sideLabelBottom: "Fields",
    visual: "final-image",
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
  visual = "stacked-panels",
}: StorySection) {
  const accentClasses = accent === "brand" ? "bg-brand text-white" : "bg-secondary text-white";

  return (
    <section
      data-home-tone={tone}
      className={`min-h-screen snap-start snap-always ${backgroundClassName}`}
    >
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-32 pt-24 sm:px-6 sm:pb-36 sm:pt-28 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:px-8 lg:pb-40 lg:pt-32">
        <div className="max-w-[560px]">
          <div className={visual === "anonymous" ? "lg:-translate-y-12" : ""}>
            <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${eyebrowClassName}`}>{eyebrow}</p>
            <h2 className={`mt-5 max-w-[10ch] text-[3rem] font-semibold leading-[0.96] tracking-[-0.05em] sm:text-[4.15rem] lg:text-[5.2rem] ${textClassName}`}>
              {title}
            </h2>
            <p className={`mt-6 max-w-[30ch] text-lg leading-8 sm:text-xl ${bodyClassName}`}>{body}</p>
            <Link
              to={ctaTo}
              className={`mt-7 inline-flex items-center justify-center rounded-full px-7 py-3.5 text-lg font-semibold transition hover:opacity-90 ${accentClasses}`}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div
          className={`flex items-center justify-center ${
            visual === "anonymous" ? "lg:-translate-y-28 lg:justify-center" : "lg:justify-end"
          }`}
        >
          {visual === "anonymous" ? (
            <div className="relative w-full max-w-[980px] px-2 sm:px-0">
              <div className="absolute inset-x-[10%] top-[12%] h-[62%] rounded-full bg-brand/8 blur-3xl" />
              <div className="relative mx-auto w-full max-w-[940px]">
                <img
                  src={anonymousCompositeImage}
                  alt="Looped anonymous privacy visual showing cryptographic separation and the anonymous iOS profile"
                  loading="lazy"
                  decoding="async"
                  className="mx-auto w-full scale-[1.14] object-contain drop-shadow-[0_28px_50px_rgba(15,23,42,0.14)] lg:scale-[1.42]"
                />
              </div>
            </div>
          ) : visual === "final-image" ? (
            <div className="relative w-full max-w-[760px] px-2 sm:px-0">
              <img
                src={finalCommunitiesImage}
                alt="Looped workplace and field community screens in the iOS app"
                loading="lazy"
                decoding="async"
                className="mx-auto w-full scale-[1.04] object-contain drop-shadow-[0_30px_60px_rgba(15,23,42,0.12)] lg:scale-[1.08]"
              />
            </div>
          ) : (
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
          )}
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
