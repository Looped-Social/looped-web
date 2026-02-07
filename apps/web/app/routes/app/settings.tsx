import type { Route } from "./+types/settings";

import { AppSettingsPage } from "@/app/pages/AppSettingsPage/AppSettingsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Settings" },
    {
      name: "description",
      content: "Looped settings and account preferences.",
    },
  ];
}

export default function Settings() {
  return <AppSettingsPage />;
}
