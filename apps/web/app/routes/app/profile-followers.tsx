import type { Route } from "./+types/profile-followers";

import { AppUserFollowListPage } from "@/app/pages/AppUserFollowListPage/AppUserFollowListPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Followers" },
    {
      name: "description",
      content: "Followers list.",
    },
  ];
}

export default function ProfileFollowers({ params }: Route.ComponentProps) {
  return <AppUserFollowListPage userId={params.userId} mode="followers" />;
}
