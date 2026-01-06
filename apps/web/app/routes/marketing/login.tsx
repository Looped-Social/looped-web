import type { Route } from "./+types/login";
import { LoginPage } from "@/marketing/pages/LoginPage/LoginPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped — Sign in" },
    {
      name: "description",
      content: "Sign in to Looped to manage account deactivation or deletion.",
    },
  ];
}

export default function ComingSoon() {
  return <LoginPage />;
}
