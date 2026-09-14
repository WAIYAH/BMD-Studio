import type { ReactNode } from 'react';

/** The dark title band that opens every public content page. */
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
  return (
    <section className="bg-navy-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {eyebrow && (
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-signal-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
          {title}
        </h1>
        {description && <p className="mt-4 max-w-2xl text-lg text-navy-200">{description}</p>}
        {children}
      </div>
    </section>
  );
}
