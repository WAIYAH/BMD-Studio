import type { PublicGallery, PublicGallerySummary } from '@bmd/shared';
import { api } from '@/lib/api-client';

/** Published galleries, newest first. */
export function fetchGalleries(): Promise<PublicGallerySummary[]> {
  return api.get<PublicGallerySummary[]>('/media/galleries');
}

/** One published gallery with its public items. */
export function fetchGallery(slug: string): Promise<PublicGallery> {
  return api.get<PublicGallery>(`/media/galleries/${encodeURIComponent(slug)}`);
}
