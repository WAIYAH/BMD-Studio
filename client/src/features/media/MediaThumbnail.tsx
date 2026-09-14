import { Film, ImageOff } from 'lucide-react';
import type { PublicMediaAsset } from '@bmd/shared';

/**
 * A still preview of a media file: its thumbnail, or the image itself. A video
 * without a thumbnail, or no file at all, gets a neutral tile rather than a
 * broken image.
 */
export function MediaThumbnail({ asset, alt }: { asset: PublicMediaAsset | null; alt: string }) {
  const src = asset?.thumbnailUrl ?? (asset?.mimeType.startsWith('image/') ? asset.url : null);

  if (src) {
    return <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />;
  }

  const Icon = asset?.mimeType.startsWith('video/') ? Film : ImageOff;
  return (
    <div className="grid size-full place-items-center text-ink-300">
      <Icon aria-hidden className="size-10" />
    </div>
  );
}
