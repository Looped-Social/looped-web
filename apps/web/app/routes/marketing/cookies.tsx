import type { Route } from "./+types/cookies";
import { buildMarketingPageMeta } from "@/lib/seo";
import { CookiePolicyPage } from "@/marketing/pages/CookiePolicyPage/CookiePolicyPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Cookie Policy",
    description: "Looped Cookie Policy describing how cookies and similar technologies are used on our website.",
    path: "/cookies",
  });
}

export default function CookiePolicy() {
  return <CookiePolicyPage />;
}
