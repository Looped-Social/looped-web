import type { Route } from "./+types/settings-blocked";

import { AppSettingsBlockedUsersPage } from "@/app/pages/AppSettingsBlockedUsersPage/AppSettingsBlockedUsersPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Blocked Users" },
    {
      name: "description",
      content: "Manage blocked users.",
    },
  ];
}

export default function SettingsBlocked() {
  return <AppSettingsBlockedUsersPage />;
}
