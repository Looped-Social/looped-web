import type { Route } from "./+types/profile-user";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppProfilePage } from "@/app/pages/AppProfilePage/AppProfilePage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Profile",
    description: "Looped user profile and activity.",
  });
}

export default function ProfileUser({ params }: Route.ComponentProps) {
  return <AppProfilePage profileUserId={params.userId} />;
}
