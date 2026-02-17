import type { Route } from "./+types/privacy-policy";
import { buildMarketingPageMeta } from "@/lib/seo";
import { PrivacyPolicyPage } from "@/marketing/pages/PrivacyPolicyPage/PrivacyPolicyPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Privacy Policy",
    description: "Looped Privacy Policy describing how personal information is collected, used, and shared.",
    path: "/privacy-policy",
  });
}

export default function PrivacyPolicy() {
  return <PrivacyPolicyPage />;
}
