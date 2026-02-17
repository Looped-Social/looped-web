import type { Route } from './+types/notifications';
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppNotificationsPage } from '@/app/pages/AppNotificationsPage/AppNotificationsPage';

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: 'Looped | Notifications',
    description: 'Your Looped notifications.',
  });
}

export default function Notifications() {
  return <AppNotificationsPage />;
}
