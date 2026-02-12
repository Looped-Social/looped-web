import type { Route } from "./+types/post-share";
import { PostSharePage } from "@/marketing/pages/PostSharePage/PostSharePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped — Shared Post" },
    {
      name: "description",
      content: "View a shared Looped post.",
    },
  ];
}

export default function PostShareRoute({ params }: Route.ComponentProps) {
  return <PostSharePage postId={params.postId ?? ""} />;
}

