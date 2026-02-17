import type { Route } from './+types/search';
import { buildAppNoIndexMeta } from "@/lib/seo";

import { AppSearchPage } from '@/app/pages/AppSearchPage/AppSearchPage';

export function meta({}: Route.MetaArgs) {
  return buildAppNoIndexMeta({
    title: 'Looped | Search',
    description: 'Search Looped.',
  });
}

export default function Search() {
  return <AppSearchPage />;
}
