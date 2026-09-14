import type { ReactNode } from 'react';
import { usePageTitle } from '@/lib/page-title';

/**
 * The black title band that opens every public content page. Its title also
 * names the browser tab, so no page can forget to set one.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  usePageTitle(title);

  return (
    <section className="border-b-4 border-brand-600 bg-ink-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {eyebrow && (
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
          {title}
        </h1>
        {description && <p className="mt-4 max-w-2xl text-lg text-ink-200">{description}</p>}
        {children}
      </div>
    </section>
  );
}
