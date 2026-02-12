import type { Route } from "./+types/create";

import { AppCreatePostPage } from "@/app/pages/AppCreatePostPage/AppCreatePostPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Create Post" },
    {
      name: "description",
      content: "Create a new post on Looped.",
    },
  ];
}

export default function CreatePost() {
  return <AppCreatePostPage />;
}
