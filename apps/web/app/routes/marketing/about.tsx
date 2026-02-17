import type { Route } from "./+types/about";
import { buildMarketingPageMeta } from "@/lib/seo";
import { AboutPage } from "@/marketing/pages/AboutPage/AboutPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "About Looped",
    description: "Learn how Looped builds verified workplace and college communities for pseudonymous conversations.",
    path: "/about",
  });
}

export default function About() {
  return <AboutPage />;
}
