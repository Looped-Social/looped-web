import type { Route } from "./+types/hashtag";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppHashtagFeedPage } from "@/app/pages/AppHashtagFeedPage/AppHashtagFeedPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Hashtag",
    description: "Hashtag feed posts.",
  });
}

export default function Hashtag({ params }: Route.ComponentProps) {
  return <AppHashtagFeedPage hashtag={params.hashtag} />;
}
