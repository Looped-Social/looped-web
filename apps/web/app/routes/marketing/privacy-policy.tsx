import type { Route } from "./+types/privacy-policy";
import { PrivacyPolicyPage } from "@/marketing/pages/PrivacyPolicyPage/PrivacyPolicyPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy" },
    {
      name: "description",
      content:
        "Looped Privacy Policy describing how personal information is collected, used, and shared.",
    },
  ];
}

export default function PrivacyPolicy() {
  return <PrivacyPolicyPage />;
}
