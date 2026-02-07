import type { Route } from './+types/notifications';

import { AppNotificationsPage } from '@/app/pages/AppNotificationsPage/AppNotificationsPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Looped | Notifications' },
    {
      name: 'description',
      content: 'Your Looped notifications.',
    },
  ];
}

export default function Notifications() {
  return <AppNotificationsPage />;
}
