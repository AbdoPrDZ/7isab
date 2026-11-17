import { apiRequest } from '@/lib/api/client';

import type { QuranMeta, QuranPage } from './types';

/** Public endpoints: no token needed. */
export async function fetchQuranMeta(): Promise<QuranMeta> {
  const { meta } = await apiRequest<{ meta: QuranMeta }>('/quran/meta');
  return meta;
}

export async function fetchQuranPage(page: number): Promise<QuranPage> {
  const { page: data } = await apiRequest<{ page: QuranPage }>(`/quran/pages/${page}`);
  return data;
}
