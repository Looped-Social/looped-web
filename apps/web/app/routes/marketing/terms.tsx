import type { Route } from "./+types/terms";
import { buildMarketingPageMeta } from "@/lib/seo";
import { TermsOfServicePage } from "@/marketing/pages/TermsOfServicePage/TermsOfServicePage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "User Agreement",
    description: "Looped User Agreement and Terms of Use.",
    path: "/terms",
  });
}

export default function TermsOfService() {
  return <TermsOfServicePage />;
}
