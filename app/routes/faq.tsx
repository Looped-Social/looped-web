import type { Route } from "./+types/faq";
import { FAQPage } from "@/pages/FAQPage/FAQPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped FAQ" },
    { name: "description", content: "Answers to common questions about Looped." },
  ];
}

export default function FAQ() {
  return <FAQPage />;
}
