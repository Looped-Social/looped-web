import type { Route } from "./+types/community-rules";
import { CommunityRulesPage } from "@/pages/CommunityRulesPage/CommunityRulesPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Looped Content Policy" },
    {
      name: "description",
      content:
        "Looped Content Policy defines what content is permitted, restricted, or prohibited on the platform.",
    },
  ];
}

export default function CommunityRules() {
  return <CommunityRulesPage />;
}
