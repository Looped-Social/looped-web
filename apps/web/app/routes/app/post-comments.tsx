import type { Route } from "./+types/post-comments";

import { AppPostCommentsPage } from "@/app/pages/AppPostCommentsPage/AppPostCommentsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Comments" },
    {
      name: "description",
      content: "Post comments and replies.",
    },
  ];
}

export default function PostComments({ params }: Route.ComponentProps) {
  return <AppPostCommentsPage postId={params.postId} />;
}
