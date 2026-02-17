import type { Route } from "./+types/settings-connected";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsConnectedAccountsPage } from "@/app/pages/AppSettingsConnectedAccountsPage/AppSettingsConnectedAccountsPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Connected Accounts",
    description: "Connected account and provider settings.",
  });
}

export default function SettingsConnected() {
  return <AppSettingsConnectedAccountsPage />;
}
