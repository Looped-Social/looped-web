import type { Route } from "./+types/profile-edit";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppEditProfilePage } from "@/app/pages/AppEditProfilePage/AppEditProfilePage";

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Edit Profile",
    description: "Update your Looped profile information.",
  });
}

export default function ProfileEdit() {
  return <AppEditProfilePage />;
}
