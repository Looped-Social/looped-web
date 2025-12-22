import type { Route } from "./+types/terms";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage/TermsOfServicePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Terms of Service" },
    { name: "description", content: "Terms for using the Looped platform." },
  ];
}

export default function TermsOfService() {
  return <TermsOfServicePage />;
}
