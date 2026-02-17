import type { Route } from './+types/messages';
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppMessagesPage } from '@/app/pages/AppMessagesPage/AppMessagesPage';

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: 'Looped | Messages',
    description: 'Your Looped messages.',
  });
}

export default function Messages() {
  return <AppMessagesPage />;
}
