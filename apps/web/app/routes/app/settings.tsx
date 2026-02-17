import type { Route } from "./+types/settings";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsPage } from "@/app/pages/AppSettingsPage/AppSettingsPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Settings",
    description: "Looped settings and account preferences.",
  });
}

export default function Settings() {
  return <AppSettingsPage />;
}
