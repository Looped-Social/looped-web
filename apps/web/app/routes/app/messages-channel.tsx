import type { Route } from "./+types/messages-channel";

import { AppMessageThreadPage } from "@/app/pages/AppMessageThreadPage/AppMessageThreadPage";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "Looped | Channel" },
    {
      name: "description",
      content: `Channel ${params.channelId} on Looped.`,
    },
  ];
}

export default function MessageChannelRoute({ params }: Route.ComponentProps) {
  return <AppMessageThreadPage threadType="channel" threadId={params.channelId} />;
}
