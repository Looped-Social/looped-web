import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useUserSession } from "@/hooks/useUserSession";
import { buildMarketingPageMeta, SITE_URL, DEFAULT_SOCIAL_IMAGE_PATH, toSiteUrl } from "@/lib/seo";
import type { Route } from "./+types/home";
import { HomePage } from "@/marketing/pages/HomePage/HomePage";

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Looped",
  url: SITE_URL,
  logo: toSiteUrl(DEFAULT_SOCIAL_IMAGE_PATH),
  sameAs: ["https://apps.apple.com/us/app/looped-social/id6758413180"],
};

const MOBILE_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "Looped Social",
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "iOS",
  url: SITE_URL,
  downloadUrl: "https://apps.apple.com/us/app/looped-social/id6758413180",
  description:
    "Looped is a verified social network for workplaces and fields where professionals can post pseudonymously.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped | Verified Workplace Social Network",
    description:
      "Looped is a verified social network for workplaces and fields where professionals can post pseudonymously.",
    path: "/",
  });
}

export default function Home() {
  const navigate = useNavigate();
  const { status, accessState } = useUserSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (accessState === "signed_in_blocked") {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (accessState === "active") {
      navigate("/app", { replace: true });
    }
  }, [accessState, navigate, status]);

  if (status === "authenticated" && (accessState === "active" || accessState === "signed_in_blocked")) {
    return null;
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(MOBILE_APP_JSON_LD) }} />
      <HomePage />
    </>
  );
}
