import type { Route } from "./+types/profile-user";

import { AppProfilePage } from "@/app/pages/AppProfilePage/AppProfilePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Profile" },
    {
      name: "description",
      content: "Looped user profile and activity.",
    },
  ];
}

export default function ProfileUser({ params }: Route.ComponentProps) {
  return <AppProfilePage profileUserId={params.userId} />;
}
