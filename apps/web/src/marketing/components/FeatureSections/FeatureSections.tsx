import { Link } from "react-router";

import anonDarkImage from "~/assets/landing-page/anon/anon-dark.PNG";
import anonLightImage from "~/assets/landing-page/anon/anon-light.PNG";
import communityDarkImage from "~/assets/landing-page/community/community-dark.PNG";
import communityLightImage from "~/assets/landing-page/community/community-light.PNG";
import verifyDarkImage from "~/assets/landing-page/verify/verify-dark.PNG";
import verifyLightImage from "~/assets/landing-page/verify/verify-light.PNG";

type FeatureSection = {
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
    title: "Get verified",
    description:
      "Getting verified is simple and quick. All information is verified fast and secure, and never stored.",
    cta: "How We Verify",
    ctaTo: "/faq#how-does-verification-work",
    lightImage: verifyLightImage,
    darkImage: verifyDarkImage,
    imageAlt: "Looped verification screenshot",
    reverse: true,
  },
  {
    title: "Anonymous",
    description:
      "Talk anonymously, free from trackers and data breaches. Anonymous to others, always authentic.",
    cta: "Our Privacy Pledge",
    ctaTo: "/privacy",
    lightImage: anonLightImage,
    darkImage: anonDarkImage,
    imageAlt: "Looped anonymous profile screenshot",
  },
];

export function FeatureSections() {
  return (
    <section className="bg-bg py-20 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-24 px-4">
        {featureSections.map((section) => {
          const mediaOrder = section.reverse ? "lg:order-2" : "lg:order-1";
          const textOrder = section.reverse ? "lg:order-1" : "lg:order-2";

          return (
            <div
              key={section.title}
              className="grid items-center gap-6 lg:grid-cols-[auto_auto] lg:justify-center lg:gap-6"
            >
              <div className={`flex justify-center ${mediaOrder}`}>
                <div className="relative w-full max-w-[480px] rounded-[32px] bg-bg-muted/50 p-4 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
                  <div className="absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-bg via-bg to-brand/5 blur-2xl dark:to-white/10" />
                  <img
                    src={section.lightImage}
                    alt={section.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="block h-auto max-h-[520px] w-auto max-w-full rounded-[24px] ring-1 ring-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:hidden"
                  />
                  <img
                    src={section.darkImage}
                    alt={section.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="hidden h-auto max-h-[520px] w-auto max-w-full rounded-[24px] ring-1 ring-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.75)] dark:block"
                  />
                </div>
              </div>

              <div className={`flex max-w-xl flex-col items-start space-y-4 text-left ${textOrder}`}>
                <h3 className="text-3xl font-semibold text-strong md:text-4xl lg:text-5xl">
                  {section.title}
                </h3>
                <p className="max-w-xl text-base leading-7 text-text-secondary md:text-lg md:leading-8 lg:text-xl lg:leading-9">
                  {section.description}
                </p>
                <Link
                  to={section.ctaTo}
                  className="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand/90 md:px-6 md:py-3 md:text-base"
                >
                  {section.cta}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
