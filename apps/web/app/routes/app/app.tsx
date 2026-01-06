import type { Route } from "./+types/app";
import { AppFeedPage } from "@/app/pages/AppFeedPage/AppFeedPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Feed" },
    {
      name: "description",
      content: "Your Looped feed: verified communities, shared anonymously.",
    },
  ];
}

export default function AppFeed() {
  return <AppFeedPage />;
}
