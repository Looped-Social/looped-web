import type { Route } from "./+types/faq";
import { buildMarketingPageMeta } from "@/lib/seo";
import { FAQPage } from "@/marketing/pages/FAQPage/FAQPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped FAQ",
    description: "Answers to common questions about Looped, the verified workplace and college social network.",
    path: "/faq",
  });
}

export default function FAQ() {
  return <FAQPage />;
}
