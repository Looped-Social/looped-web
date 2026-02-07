import type { Route } from './+types/messages';

import { AppMessagesPage } from '@/app/pages/AppMessagesPage/AppMessagesPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Looped | Messages' },
    {
      name: 'description',
      content: 'Your Looped messages.',
    },
  ];
}

export default function Messages() {
  return <AppMessagesPage />;
}
