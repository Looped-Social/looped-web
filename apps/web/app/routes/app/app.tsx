import type { Route } from "./+types/app";
import { buildAppNoIndexMeta } from "@/lib/seo";
import { AppFeedPage } from "@/app/pages/AppFeedPage/AppFeedPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Feed",
    description: "Your Looped feed: verified communities, shared anonymously.",
  });
}

export default function AppFeed() {
  return <AppFeedPage />;
}
