import type { Route } from "./+types/messages-channel";
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppMessageThreadPage } from "@/app/pages/AppMessageThreadPage/AppMessageThreadPage";

export function meta({ params }: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: "Looped | Channel",
    description: `Channel ${params.channelId} on Looped.`,
  });
}

export default function MessageChannelRoute({ params }: Route.ComponentProps) {
  return <AppMessageThreadPage threadType="channel" threadId={params.channelId} />;
}
