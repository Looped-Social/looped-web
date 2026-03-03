import { Navigate } from "react-router";

import type { Route } from "./+types/signup";
import { buildMarketingPageMeta } from "@/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped — Sign up",
    description: "Create your Looped account and complete web onboarding.",
    path: "/signup",
    robots: "noindex,nofollow,noarchive",
  });
}

export default function SignupRoute() {
  return <Navigate to="/login" replace />;
}
