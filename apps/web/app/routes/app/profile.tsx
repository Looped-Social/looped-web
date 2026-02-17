import type { Route } from "./+types/profile";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppProfilePage } from "@/app/pages/AppProfilePage/AppProfilePage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Profile",
    description: "Your Looped profile and activity.",
  });
}

export default function Profile() {
  return <AppProfilePage />;
}
