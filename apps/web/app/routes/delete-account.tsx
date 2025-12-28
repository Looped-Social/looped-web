import type { Route } from "./+types/delete-account";
import { DeleteAccountPage } from "@/pages/DeleteAccountPage/DeleteAccountPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped — Delete Account" },
    {
      name: "description",
      content: "Sign in to deactivate or delete your Looped account and data.",
    },
  ];
}

export default function DeleteAccount() {
  return <DeleteAccountPage />;
}
