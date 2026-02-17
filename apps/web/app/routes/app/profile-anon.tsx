import type { Route } from "./+types/profile-anon";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppAnonProfilePage } from "@/app/pages/AppAnonProfilePage/AppAnonProfilePage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Anonymous Profile",
    description: "Anonymous profile and content.",
  });
}

export default function ProfileAnon({ params }: Route.ComponentProps) {
  return <AppAnonProfilePage anonProfileId={params.anonProfileId} />;
}
