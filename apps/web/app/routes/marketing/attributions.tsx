import type { Route } from "./+types/attributions";
import { buildMarketingPageMeta } from "@/lib/seo";
import { AttributionsPage } from "@/marketing/pages/AttributionsPage/AttributionsPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Attributions",
    description: "Acknowledgements for third-party logos, illustrations, and icons used on Looped.",
    path: "/attributions",
  });
}

export default function Attributions() {
  return <AttributionsPage />;
}
