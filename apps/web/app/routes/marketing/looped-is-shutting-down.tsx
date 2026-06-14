import type { Route } from './+types/looped-is-shutting-down';

import { buildMarketingPageMeta } from '@/lib/seo';
import { ShutdownPostPage } from '@/marketing/pages/ShutdownPostPage/ShutdownPostPage';

export function meta({}: Route.MetaArgs) {
  return [
    ...buildMarketingPageMeta({
      title: 'Looped Is Shutting Down',
      description:
        'A personal note from Looped co-founders Luke and William about shutting down the app and what comes next.',
      path: '/blog/looped-is-shutting-down',
      type: 'article',
      includeIosAppMeta: false,
    }),
    { property: 'article:published_time', content: '2026-06-14' },
  ];
}

export default function LoopedIsShuttingDown() {
  return <ShutdownPostPage />;
}
