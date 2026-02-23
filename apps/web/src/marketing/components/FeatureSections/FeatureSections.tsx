import { Link } from "react-router";

import anonDarkImage from "~/assets/landing-page/anon/anon-dark.PNG";
import anonLightImage from "~/assets/landing-page/anon/anon-light.PNG";
import communityDarkImage from "~/assets/landing-page/community/community-dark.PNG";
import communityLightImage from "~/assets/landing-page/community/community-light.PNG";
import verifyDarkImage from "~/assets/landing-page/verify/verify-dark.PNG";
import verifyLightImage from "~/assets/landing-page/verify/verify-light.PNG";

type FeatureSection = {
  id: string;
  title: string;
  description: string;
  cta: string;
  ctaTo: string;
  lightImage: string;
  darkImage: string;
  imageAlt: string;
  reverse?: boolean;
};

const featureSections: FeatureSection[] = [
  {
    id: "community",
    title: "Find your people",
    description:
      "Connect with verified people in your company or school. Join one company to unlock Fields, and at least one school to unlock Majors.",
    cta: "Learn More",
    ctaTo: "/about",
    lightImage: communityLightImage,
    darkImage: communityDarkImage,
    imageAlt: "Looped community feed screenshot",
  },
  {
    id: "verification",
    title: "Get verified",
    description:
      "Getting verified is simple and quick in the iOS app. Verification is fast and secure, and web verification support is in progress.",
    cta: "How We Verify",
    ctaTo: "/faq#how-does-verification-work",
    lightImage: verifyLightImage,
    darkImage: verifyDarkImage,
    imageAlt: "Looped verification screenshot",
    reverse: true,
  },
  {
    id: "privacy",
    title: "Anonymous",
    description:
      "Talk anonymously, free from trackers and data breaches. Anonymous to others, always authentic. Anonymous posting is currently iOS-only.",
    cta: "Our Privacy Pledge",
    ctaTo: "/privacy",
    lightImage: anonLightImage,
    darkImage: anonDarkImage,
    imageAlt: "Looped anonymous profile screenshot",
  },
];

export function FeatureSections() {
  return (
    <section className="bg-bg py-14 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-6 lg:px-8">
        {featureSections.map((section, index) => {
          const mediaOrder = section.reverse ? "lg:order-2" : "lg:order-1";
          const textOrder = section.reverse ? "lg:order-1" : "lg:order-2";

          return (
            <article
              key={section.id}
              className="rounded-3xl border border-border bg-bg px-5 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.08)] md:px-8 md:py-8"
            >
              <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
                <div className={`flex justify-center ${mediaOrder}`}>
                  <div className="w-full max-w-[430px] rounded-2xl border border-border bg-bg-muted/40 p-2.5">
                    <img
                      src={section.lightImage}
                      alt={section.imageAlt}
                      loading="lazy"
                      decoding="async"
                      className="block h-auto w-full rounded-xl ring-1 ring-black/5 dark:hidden"
                    />
                    <img
                      src={section.darkImage}
                      alt={section.imageAlt}
                      loading="lazy"
                      decoding="async"
                      className="hidden h-auto w-full rounded-xl ring-1 ring-white/15 dark:block"
                    />
                  </div>
                </div>

                <div className={`text-left ${textOrder}`}>
                  <p className="text-sm font-medium text-text-light">0{index + 1}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-strong md:text-3xl">{section.title}</h2>
                  <p className="mt-3 text-base leading-7 text-text-secondary md:text-lg">{section.description}</p>
                  <Link
                    to={section.ctaTo}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-strong transition hover:border-brand hover:text-brand"
                  >
                    {section.cta}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10h12" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}
