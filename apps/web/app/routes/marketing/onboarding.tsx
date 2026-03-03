import type { Route } from "./+types/onboarding";

import { buildAppNoIndexMeta } from "@/lib/seo";
import { OnboardingPage } from "@/marketing/pages/OnboardingPage/OnboardingPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Onboarding",
    description: "Complete account setup and community verification on web.",
  });
}

export default function OnboardingRoute() {
  return <OnboardingPage />;
}
