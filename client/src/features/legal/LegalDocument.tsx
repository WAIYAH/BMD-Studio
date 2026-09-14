import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/cn';
import { LEGAL_LAST_UPDATED, LEGAL_PAGES } from './entity';

export interface LegalSection {
  /** In-page anchor, e.g. `your-rights`. */
  id: string;
  title: string;
  body: ReactNode;
}

const lastUpdatedLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${LEGAL_LAST_UPDATED}T12:00:00Z`));

/**
 * The frame every legal page shares: title band with the last-updated date,
 * navigation between the legal documents, a numbered table of contents and the
 * numbered sections themselves.
 */
export function LegalDocument({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHeader eyebrow="Legal" title={title} description={summary}>
        <p className="mt-6 text-sm text-ink-300">
          Last updated <time dateTime={LEGAL_LAST_UPDATED}>{lastUpdatedLabel}</time>
        </p>
      </PageHeader>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[16rem_1fr] lg:px-8">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Legal documents">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Legal</p>
            <ul className="mt-3 space-y-1">
              {LEGAL_PAGES.map((page) => (
                <li key={page.to}>
                  <NavLink
                    to={page.to}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100',
                      )
                    }
                  >
                    {page.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="On this page" className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
              On this page
            </p>
            <ol className="mt-3 space-y-2 border-l-2 border-ink-100 text-sm">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ml-0.5 block border-l-2 border-transparent pl-3 text-ink-600 transition-colors hover:border-brand-600 hover:text-ink-950"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-32 border-b border-ink-100 py-8 first:pt-0 last:border-0"
            >
              <h2
                id={`${section.id}-title`}
                className="font-display text-3xl font-bold uppercase text-ink-950"
              >
                <span className="text-brand-600">{index + 1}.</span> {section.title}
              </h2>
              <div className="mt-4 space-y-4 leading-relaxed text-ink-700 [&_a]:font-semibold [&_a]:text-brand-600 [&_a:hover]:text-brand-700 [&_strong]:font-semibold [&_strong]:text-ink-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
