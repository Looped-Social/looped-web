import type { Route } from "./+types/messages-conversation";

import { AppMessageThreadPage } from "@/app/pages/AppMessageThreadPage/AppMessageThreadPage";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "Looped | Conversation" },
    {
      name: "description",
      content: `Conversation ${params.conversationId} on Looped.`,
    },
  ];
}

export default function MessageConversationRoute({ params }: Route.ComponentProps) {
  return <AppMessageThreadPage threadType="conversation" threadId={params.conversationId} />;
}
