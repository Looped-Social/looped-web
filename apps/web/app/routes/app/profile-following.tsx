import type { Route } from "./+types/profile-following";

import { AppUserFollowListPage } from "@/app/pages/AppUserFollowListPage/AppUserFollowListPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Following" },
    {
      name: "description",
      content: "Following list.",
    },
  ];
}

export default function ProfileFollowing({ params }: Route.ComponentProps) {
  return <AppUserFollowListPage userId={params.userId} mode="following" />;
}
