import type { Route } from "./+types/create";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppCreatePostPage } from "@/app/pages/AppCreatePostPage/AppCreatePostPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Create Post",
    description: "Create a new post on Looped.",
  });
}

export default function CreatePost() {
  return <AppCreatePostPage />;
}
