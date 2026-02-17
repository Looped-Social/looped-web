import type { Route } from "./+types/community-request";
import { buildMarketingPageMeta } from "@/lib/seo";
import { CommunityRequestPage } from "@/marketing/pages/CommunityRequestPage/CommunityRequestPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped — Community Request",
    description: "Request a new company, school, or field community on Looped.",
    path: "/community-request",
  });
}

export default function CommunityRequest() {
  return <CommunityRequestPage />;
}
