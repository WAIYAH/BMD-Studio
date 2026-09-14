import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/page-title';

/** Title row for every account screen; its title also names the browser tab. */
export function AccountPageHeader({
  title,
  description,
  actions,
  documentTitle,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Tab title when it should differ from the visible heading. */
  documentTitle?: string;
}) {
  usePageTitle(documentTitle ?? title);

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-4xl font-bold uppercase leading-tight text-ink-950">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
