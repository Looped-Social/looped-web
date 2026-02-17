import type { Route } from "./+types/messages-conversation";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppMessageThreadPage } from "@/app/pages/AppMessageThreadPage/AppMessageThreadPage";

export function meta({ params }: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Conversation",
    description: `Conversation ${params.conversationId} on Looped.`,
  });
}

export default function MessageConversationRoute({ params }: Route.ComponentProps) {
  return <AppMessageThreadPage threadType="conversation" threadId={params.conversationId} />;
}
