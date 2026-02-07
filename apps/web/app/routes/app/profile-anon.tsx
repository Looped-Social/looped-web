import type { Route } from "./+types/profile-anon";

import { AppAnonProfilePage } from "@/app/pages/AppAnonProfilePage/AppAnonProfilePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Anonymous Profile" },
    {
      name: "description",
      content: "Anonymous profile and content.",
    },
  ];
}

export default function ProfileAnon({ params }: Route.ComponentProps) {
  return <AppAnonProfilePage anonProfileId={params.anonProfileId} />;
}
