import type { Route } from "./+types/settings-verifications";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsVerificationsPage } from "@/app/pages/AppSettingsVerificationsPage/AppSettingsVerificationsPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Verifications",
    description: "Manage community verifications.",
  });
}

export default function SettingsVerifications() {
  return <AppSettingsVerificationsPage />;
}
