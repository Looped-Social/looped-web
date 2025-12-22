import type { Route } from "./+types/privacy";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage/PrivacyPolicyPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy" },
    { name: "description", content: "How Looped collects, uses, and protects your data." },
  ];
}

export default function PrivacyPolicy() {
  return <PrivacyPolicyPage />;
}
