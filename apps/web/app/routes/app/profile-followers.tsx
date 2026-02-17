import type { Route } from "./+types/profile-followers";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppUserFollowListPage } from "@/app/pages/AppUserFollowListPage/AppUserFollowListPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Followers",
    description: "Followers list.",
  });
}

export default function ProfileFollowers({ params }: Route.ComponentProps) {
  return <AppUserFollowListPage userId={params.userId} mode="followers" />;
}
