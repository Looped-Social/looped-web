import type { Route } from "./+types/community";

import { AppCommunityPage } from "@/app/pages/AppCommunityPage/AppCommunityPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Community" },
    {
      name: "description",
      content: "Community profile, posts, and hashtags.",
    },
  ];
}

export default function Community({ params }: Route.ComponentProps) {
  return <AppCommunityPage communityId={params.communityId} />;
}

