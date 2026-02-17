import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useUserSession } from "@/hooks/useUserSession";
import { buildMarketingPageMeta } from "@/lib/seo";
import type { Route } from "./+types/home";
import { HomePage } from "@/marketing/pages/HomePage/HomePage";

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Looped",
  url: "https://mylooped.app",
  logo: "https://mylooped.app/main-logo.svg",
  sameAs: ["https://apps.apple.com/us/app/looped-social/id6758413180"],
};

const MOBILE_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "Looped Social",
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "iOS",
  url: "https://mylooped.app",
  downloadUrl: "https://apps.apple.com/us/app/looped-social/id6758413180",
  description:
    "Looped is a verified social network for workplaces and colleges where employees and students can post pseudonymously.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped | Workplace & College Social Network",
    description:
      "Looped is a verified social network for workplaces and colleges where employees and students can post pseudonymously.",
    path: "/",
  });
}

export default function Home() {
  const navigate = useNavigate();
  const { status } = useUserSession();

  useEffect(() => {
    if (status === "authenticated") {
      navigate("/app", { replace: true });
    }
  }, [navigate, status]);

  if (status === "authenticated") {
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
