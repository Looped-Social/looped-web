import type { Route } from "./+types/settings-content";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSettingsContentPage } from "@/app/pages/AppSettingsContentPage/AppSettingsContentPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Settings Content",
    description: "Posts, replies, liked, and saved content.",
  });
}

export default function SettingsContent() {
  return <AppSettingsContentPage />;
}
