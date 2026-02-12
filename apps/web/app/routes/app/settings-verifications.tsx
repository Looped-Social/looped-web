import type { Route } from "./+types/settings-verifications";

import { AppSettingsVerificationsPage } from "@/app/pages/AppSettingsVerificationsPage/AppSettingsVerificationsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Verifications" },
    {
      name: "description",
      content: "Manage community verifications.",
    },
  ];
}

export default function SettingsVerifications() {
  return <AppSettingsVerificationsPage />;
}
