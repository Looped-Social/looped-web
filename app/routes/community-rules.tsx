import type { Route } from "./+types/community-rules";
import { CommunityRulesPage } from "@/pages/CommunityRulesPage/CommunityRulesPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Community Rules" },
    { name: "description", content: "Guidelines for participating in the Looped community." },
  ];
}

export default function CommunityRules() {
  return <CommunityRulesPage />;
}
