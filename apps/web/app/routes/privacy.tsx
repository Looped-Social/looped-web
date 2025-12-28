import type { Route } from "./+types/privacy";
import { PrivacyPage } from "@/pages/PrivacyPage/PrivacyPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy" },
    {
      name: "description",
      content:
        "Learn how Looped protects anonymous profiles and keeps identities separate.",
    },
  ];
}

export default function PrivacyPolicy() {
  return <PrivacyPage />;
}
