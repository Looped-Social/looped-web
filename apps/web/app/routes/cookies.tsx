import type { Route } from "./+types/cookies";
import { CookiePolicyPage } from "@/pages/CookiePolicyPage/CookiePolicyPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Cookie Policy" },
    {
      name: "description",
      content:
        "Looped Cookie Policy describing how cookies and similar technologies are used on our website.",
    },
  ];
}

export default function CookiePolicy() {
  return <CookiePolicyPage />;
}
