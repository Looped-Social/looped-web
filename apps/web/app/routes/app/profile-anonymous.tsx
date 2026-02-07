import type { Route } from "./+types/profile-anonymous";

import { AppAnonymousProfilePage } from "@/app/pages/AppAnonymousProfilePage/AppAnonymousProfilePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Anonymous Profile" },
    {
      name: "description",
      content: "Anonymous profile view.",
    },
  ];
}

export default function ProfileAnonymous() {
  return <AppAnonymousProfilePage />;
}
