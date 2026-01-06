import type { Route } from "./+types/terms";
import { TermsOfServicePage } from "@/marketing/pages/TermsOfServicePage/TermsOfServicePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Agreement" },
    { name: "description", content: "Looped User Agreement and Terms of Use." },
  ];
}

export default function TermsOfService() {
  return <TermsOfServicePage />;
}
