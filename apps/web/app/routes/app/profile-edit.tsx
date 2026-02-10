import type { Route } from "./+types/profile-edit";

import { AppEditProfilePage } from "@/app/pages/AppEditProfilePage/AppEditProfilePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Edit Profile" },
    {
      name: "description",
      content: "Update your Looped profile information.",
    },
  ];
}

export default function ProfileEdit() {
  return <AppEditProfilePage />;
}
