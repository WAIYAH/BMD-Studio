import type { Prisma } from '@prisma/client';
import {
  API_ERROR_CODES,
  type PublicGallery,
  type PublicGallerySummary,
  type PublicMediaAsset,
} from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { prisma } from '../lib/prisma.js';

/** A file is only ever described publicly when it is marked PUBLIC. */
const PUBLIC_ITEM = { media: { visibility: 'PUBLIC' } } satisfies Prisma.GalleryItemWhereInput;

const ITEM_ORDER = [
  { position: 'asc' },
  { createdAt: 'asc' },
] satisfies Prisma.GalleryItemOrderByWithRelationInput[];

const MEDIA_SELECT = {
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  altText: true,
  variants: true,
  visibility: true,
} satisfies Prisma.MediaFileSelect;

type MediaRow = Prisma.MediaFileGetPayload<{ select: typeof MEDIA_SELECT }>;

/**
 * The public origin media is served from. Without one there is no URL a
 * browser could load, so the endpoints refuse rather than publish entries that
 * cannot be displayed.
 */
function mediaBaseUrl(): string {
  const base = env.MEDIA_PUBLIC_BASE_URL;
  if (!base) {
    throw new ApiError(
      503,
      API_ERROR_CODES.INTEGRATION_NOT_CONFIGURED,
      'Media storage is not configured.',
    );
  }
  return base.replace(/\/+$/, '');
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** The `thumb` rendition's key from the `variants` JSON, when a usable one is recorded. */
function thumbnailKey(variants: Prisma.JsonValue): string | null {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return null;
  const thumb = variants.thumb;
  if (!thumb || typeof thumb !== 'object' || Array.isArray(thumb)) return null;
  const key = thumb.key;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function toAsset(base: string, media: MediaRow): PublicMediaAsset {
  const thumb = thumbnailKey(media.variants);
  return {
    url: objectUrl(base, media.storageKey),
    thumbnailUrl: thumb ? objectUrl(base, thumb) : null,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    altText: media.altText,
  };
}

/** Published galleries that have at least one public item, newest first. */
export async function listPublishedGalleries(): Promise<PublicGallerySummary[]> {
  const base = mediaBaseUrl();

  const galleries = await prisma.gallery.findMany({
    // A published gallery with nothing public in it would open onto an empty page.
    where: { isPublished: true, items: { some: PUBLIC_ITEM } },
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
    select: {
      slug: true,
      title: true,
      description: true,
      type: true,
      publishedAt: true,
      cover: { select: MEDIA_SELECT },
      items: {
        where: PUBLIC_ITEM,
        orderBy: ITEM_ORDER,
        take: 1,
        select: { media: { select: MEDIA_SELECT } },
      },
      _count: { select: { items: { where: PUBLIC_ITEM } } },
    },
  });

  return galleries.map((gallery) => {
    const cover =
      gallery.cover?.visibility === 'PUBLIC' ? gallery.cover : (gallery.items[0]?.media ?? null);

    return {
      slug: gallery.slug,
      title: gallery.title,
      description: gallery.description,
      type: gallery.type,
      cover: cover ? toAsset(base, cover) : null,
      itemCount: gallery._count.items,
      publishedAt: gallery.publishedAt?.toISOString() ?? null,
    };
  });
}

/** One published gallery with its public items in display order. */
export async function getPublishedGallery(slug: string): Promise<PublicGallery> {
  const base = mediaBaseUrl();

  const gallery = await prisma.gallery.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      description: true,
      type: true,
      publishedAt: true,
      items: {
        where: PUBLIC_ITEM,
        orderBy: ITEM_ORDER,
        select: { id: true, caption: true, media: { select: MEDIA_SELECT } },
      },
    },
  });

  // An unpublished gallery is indistinguishable from one that does not exist.
  if (!gallery) throw ApiError.notFound('Gallery');

  return {
    slug: gallery.slug,
    title: gallery.title,
    description: gallery.description,
    type: gallery.type,
    publishedAt: gallery.publishedAt?.toISOString() ?? null,
    items: gallery.items.map((item) => ({
      id: item.id,
      caption: item.caption,
      media: toAsset(base, item.media),
    })),
  };
}
