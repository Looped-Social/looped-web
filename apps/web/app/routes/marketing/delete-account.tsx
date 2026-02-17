import type { Route } from "./+types/delete-account";
import { buildMarketingPageMeta } from "@/lib/seo";
import { DeleteAccountPage } from "@/marketing/pages/DeleteAccountPage/DeleteAccountPage";

export function meta({}: Route.MetaArgs) {
  return buildMarketingPageMeta({
    title: "Looped — Delete Account",
    description: "Sign in to deactivate or delete your Looped account and data.",
    path: "/delete-account",
    robots: "noindex,nofollow,noarchive",
  });
}

export default function DeleteAccount() {
  return <DeleteAccountPage />;
}
