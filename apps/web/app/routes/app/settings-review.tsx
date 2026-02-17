import type { Route } from "./+types/settings-review";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsSafetyReviewPage } from "@/app/pages/AppSettingsSafetyReviewPage/AppSettingsSafetyReviewPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Safety Review",
    description: "Review violations, appeals, and under-review content.",
  });
}

export default function SettingsReview() {
  return <AppSettingsSafetyReviewPage />;
}
