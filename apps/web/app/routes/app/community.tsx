import type { Route } from "./+types/community";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppCommunityPage } from "@/app/pages/AppCommunityPage/AppCommunityPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Community",
    description: "Community profile, posts, and hashtags.",
  });
}

export default function Community({ params }: Route.ComponentProps) {
  return <AppCommunityPage communityId={params.communityId} />;
}

