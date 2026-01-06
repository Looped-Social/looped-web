import type { Route } from "./+types/attributions";
import { AttributionsPage } from "@/marketing/pages/AttributionsPage/AttributionsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Attributions" },
    {
      name: "description",
      content: "Acknowledgements for third-party logos, illustrations, and icons used on Looped.",
    },
  ];
}

export default function Attributions() {
  return <AttributionsPage />;
}
