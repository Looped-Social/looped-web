import type { Route } from "./+types/contact";
import { ContactPage } from "@/marketing/pages/ContactPage/ContactPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contact Looped" },
    { name: "description", content: "Send feedback or reach out to the Looped team for support, press, or partnerships." },
  ];
}

export default function Contact() {
  return <ContactPage />;
}
