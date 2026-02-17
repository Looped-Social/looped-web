import type { Route } from "./+types/post-comments";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppPostCommentsPage } from "@/app/pages/AppPostCommentsPage/AppPostCommentsPage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Comments",
    description: "Post comments and replies.",
  });
}

export default function PostComments({ params }: Route.ComponentProps) {
  return <AppPostCommentsPage postId={params.postId} />;
}
