import type { GalleryTypeValue } from './domain.js';

/**
 * Public media payloads. Only files marked PUBLIC inside published galleries
 * are ever described; buckets, checksums, file sizes and uploader accounts stay
 * on the server.
 */

export const GALLERY_TYPE_LABEL: Record<GalleryTypeValue, string> = {
  PHOTO: 'Photography',
  VIDEO: 'Video',
  PORTFOLIO: 'Portfolio',
};

export interface PublicMediaAsset {
  url: string;
  /** A smaller rendition when one was generated; otherwise null. */
  thumbnailUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
}

export interface PublicGallerySummary {
  slug: string;
  title: string;
  description: string | null;
  type: GalleryTypeValue;
  /** The chosen cover when it is public, otherwise the first public item. */
  cover: PublicMediaAsset | null;
  /** Public items only. */
  itemCount: number;
  publishedAt: string | null;
}

export interface PublicGalleryItem {
  id: string;
  caption: string | null;
  media: PublicMediaAsset;
}

export interface PublicGallery {
  slug: string;
  title: string;
  description: string | null;
  type: GalleryTypeValue;
  publishedAt: string | null;
  items: PublicGalleryItem[];
}
