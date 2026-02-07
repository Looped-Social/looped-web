import type { Route } from './+types/search';

import { AppSearchPage } from '@/app/pages/AppSearchPage/AppSearchPage';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Looped | Search' },
    {
      name: 'description',
      content: 'Search Looped.',
    },
  ];
}

export default function Search() {
  return <AppSearchPage />;
}
