import type { Route } from "./+types/contact";
import { buildMarketingPageMeta } from "@/lib/seo";
import { ContactPage } from "@/marketing/pages/ContactPage/ContactPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Contact Looped",
    description: "Send feedback or reach out to the Looped team for support, press, or partnerships.",
    path: "/contact",
  });
}

export default function Contact() {
  return <ContactPage />;
}
