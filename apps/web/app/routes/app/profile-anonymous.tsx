import type { Route } from "./+types/profile-anonymous";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppAnonymousProfilePage } from "@/app/pages/AppAnonymousProfilePage/AppAnonymousProfilePage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Anonymous Profile",
    description: "Anonymous profile view.",
  });
}

export default function ProfileAnonymous() {
  return <AppAnonymousProfilePage />;
}
