import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { GALLERY_TYPE_LABEL, type PublicGallerySummary } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchGalleries } from '@/features/media/api';
import { MediaThumbnail } from '@/features/media/MediaThumbnail';
import { ApiClientError } from '@/lib/api-client';

export function GalleryPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['media', 'galleries'],
    queryFn: fetchGalleries,
  });

  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Gallery & portfolio"
        description="Photography, video and portfolio work published by the studio."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isPending ? (
          <LoadingState label="Loading galleries…" />
        ) : error ? (
          <ErrorState
            title="Galleries could not be loaded"
            message={
              error instanceof ApiClientError ? error.message : 'The gallery is unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Images aria-hidden className="size-8" />}
            title="No galleries have been published yet"
            description="Published photo and video galleries will appear here."
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((gallery) => (
              <li key={gallery.slug}>
                <GalleryCard gallery={gallery} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function GalleryCard({ gallery }: { gallery: PublicGallerySummary }) {
  return (
    <Link
      to={`/gallery/${gallery.slug}`}
      className="group block overflow-hidden rounded-card border border-navy-100 transition-shadow hover:shadow-md"
    >
      <div className="aspect-[4/3] bg-navy-50">
        {/* The card's title names the gallery; the cover is decorative. */}
        <MediaThumbnail asset={gallery.cover} alt="" />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge>{GALLERY_TYPE_LABEL[gallery.type]}</StatusBadge>
          <span className="text-sm text-navy-500">
            {gallery.itemCount} {gallery.itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-bold uppercase text-navy-900 group-hover:text-signal-700">
          {gallery.title}
        </h2>
        {gallery.description && (
          <p className="mt-1 line-clamp-2 text-sm text-navy-600">{gallery.description}</p>
        )}
      </div>
    </Link>
  );
}
