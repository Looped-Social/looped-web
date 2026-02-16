import type { Route } from "./+types/hashtag";

import { AppHashtagFeedPage } from "@/app/pages/AppHashtagFeedPage/AppHashtagFeedPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Hashtag" },
    {
      name: "description",
      content: "Hashtag feed posts.",
    },
  ];
}

export default function Hashtag({ params }: Route.ComponentProps) {
  return <AppHashtagFeedPage hashtag={params.hashtag} />;
}
