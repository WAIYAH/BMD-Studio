import { useEffect } from 'react';

export const SITE_NAME = 'B.M.D Studio';

const HOME_TITLE = `${SITE_NAME} — Broadcast, Podcast & Media Production, Kenya`;

/**
 * Names the browser tab after the current page, e.g. `Services & pricing · B.M.D
 * Studio`. Pass `null` for the home page's full site title.
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : HOME_TITLE;
  }, [title]);
}
