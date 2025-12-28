import type { Route } from "./+types/community-request";
import { CommunityRequestPage } from "@/pages/CommunityRequestPage/CommunityRequestPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped — Community Request" },
    {
      name: "description",
      content: "Request a new workplace, school, or sector community on Looped.",
    },
  ];
}

export default function CommunityRequest() {
  return <CommunityRequestPage />;
}
