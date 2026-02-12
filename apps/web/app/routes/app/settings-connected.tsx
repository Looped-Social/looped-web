import type { Route } from "./+types/settings-connected";

import { AppSettingsConnectedAccountsPage } from "@/app/pages/AppSettingsConnectedAccountsPage/AppSettingsConnectedAccountsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Connected Accounts" },
    {
      name: "description",
      content: "Connected account and provider settings.",
    },
  ];
}

export default function SettingsConnected() {
  return <AppSettingsConnectedAccountsPage />;
}
