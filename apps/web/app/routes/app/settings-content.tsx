import type { Route } from "./+types/settings-content";

import { AppSettingsContentPage } from "@/app/pages/AppSettingsContentPage/AppSettingsContentPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Settings Content" },
    {
      name: "description",
      content: "Posts, replies, liked, and saved content.",
    },
  ];
}

export default function SettingsContent() {
  return <AppSettingsContentPage />;
}
