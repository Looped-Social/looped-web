import type { Route } from "./+types/login";
import { LoginPage } from "@/pages/LoginPage/LoginPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Web — Coming Soon" },
    { name: "description", content: "Looped on the web is coming soon. Download the iOS app to get started today." },
  ];
}

export default function ComingSoon() {
  return <LoginPage />;
}
