import type { Route } from "./+types/login";
import { buildMarketingPageMeta } from "@/lib/seo";
import { LoginPage } from "@/marketing/pages/LoginPage/LoginPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped — Sign in",
    description: "Sign in to Looped to manage account deactivation or deletion.",
    path: "/login",
    robots: "noindex,nofollow,noarchive",
  });
}

export default function ComingSoon() {
  return <LoginPage />;
}
