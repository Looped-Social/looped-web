import type { Route } from "./+types/settings-blocked";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsBlockedUsersPage } from "@/app/pages/AppSettingsBlockedUsersPage/AppSettingsBlockedUsersPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Blocked Users",
    description: "Manage blocked users.",
  });
}

export default function SettingsBlocked() {
  return <AppSettingsBlockedUsersPage />;
}
