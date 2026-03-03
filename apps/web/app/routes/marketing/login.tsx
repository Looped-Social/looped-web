import type { Route } from "./+types/login";
import { buildMarketingPageMeta } from "@/lib/seo";
import { LoginPage } from "@/marketing/pages/LoginPage/LoginPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped — Sign in or sign up",
    description: "Sign in or create your Looped account on web, then complete onboarding.",
    path: "/login",
    robots: "noindex,nofollow,noarchive",
  });
}

export default function LoginRoute() {
  return <LoginPage />;
}
