import type { Route } from "./+types/settings-review";

import { AppSettingsSafetyReviewPage } from "@/app/pages/AppSettingsSafetyReviewPage/AppSettingsSafetyReviewPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Safety Review" },
    {
      name: "description",
      content: "Review violations, appeals, and under-review content.",
    },
  ];
}

export default function SettingsReview() {
  return <AppSettingsSafetyReviewPage />;
}
