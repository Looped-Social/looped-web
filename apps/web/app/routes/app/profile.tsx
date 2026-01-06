import type { Route } from "./+types/profile";
import { AppProfilePage } from "@/app/pages/AppProfilePage/AppProfilePage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped | Profile" },
    {
      name: "description",
      content: "Your Looped profile and activity.",
    },
  ];
}

export default function Profile() {
  return <AppProfilePage />;
}
