import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { API_ERROR_CODES, GALLERY_TYPE_LABEL, type PublicGalleryItem } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { fetchGallery } from '@/features/media/api';
import { MediaThumbnail } from '@/features/media/MediaThumbnail';
import { ApiClientError } from '@/lib/api-client';

export function GalleryDetailPage() {
  const { slug = '' } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['media', 'gallery', slug],
    queryFn: () => fetchGallery(slug),
  });

  if (error instanceof ApiClientError && error.code === API_ERROR_CODES.NOT_FOUND) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <EmptyState
          title="Gallery not found"
          description="This gallery does not exist or is no longer published."
          action={<BackLink />}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={data ? GALLERY_TYPE_LABEL[data.type] : 'Gallery'}
        title={data?.title ?? 'Gallery'}
        description={data?.description ?? undefined}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <BackLink />

        <div className="mt-6">
          {isPending ? (
            <LoadingState label="Loading gallery…" />
          ) : error ? (
            <ErrorState
              title="This gallery could not be loaded"
              message={
                error instanceof ApiClientError ? error.message : 'The gallery is unavailable.'
              }
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
              onRetry={() => void refetch()}
            />
          ) : data.items.length === 0 ? (
            <EmptyState
              title="This gallery is empty"
              description="Nothing in this gallery has been made public yet."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <GalleryItemTile item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/gallery"
      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
    >
      <ArrowLeft aria-hidden className="size-4" />
      All galleries
    </Link>
  );
}

function GalleryItemTile({ item }: { item: PublicGalleryItem }) {
  const { media } = item;
  const alt = media.altText ?? item.caption ?? '';

  return (
    <figure className="overflow-hidden rounded-card border border-ink-100 bg-white">
      {media.mimeType.startsWith('video/') ? (
        <video
          controls
          preload="metadata"
          src={media.url}
          poster={media.thumbnailUrl ?? undefined}
          aria-label={alt || undefined}
          className="aspect-video w-full bg-ink-950"
        />
      ) : (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-[4/3] bg-ink-50"
        >
          <MediaThumbnail asset={media} alt={alt} />
          <span className="sr-only">Open full size</span>
        </a>
      )}
      {item.caption && (
        <figcaption className="px-4 py-3 text-sm text-ink-700">{item.caption}</figcaption>
      )}
    </figure>
  );
}
