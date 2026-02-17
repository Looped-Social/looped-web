import type { Route } from "./+types/profile-following";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppUserFollowListPage } from "@/app/pages/AppUserFollowListPage/AppUserFollowListPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Following",
    description: "Following list.",
  });
}

export default function ProfileFollowing({ params }: Route.ComponentProps) {
  return <AppUserFollowListPage userId={params.userId} mode="following" />;
}
