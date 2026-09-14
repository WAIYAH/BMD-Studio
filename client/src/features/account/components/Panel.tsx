import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A titled white card on the account dashboard. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex flex-col rounded-card border border-ink-200 bg-white', className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h2 id={titleId} className="font-display text-xl font-bold uppercase text-ink-950">
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

/** The empty state inside a panel or list card. */
export function PanelEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="mt-3 font-semibold text-ink-950">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-ink-600">{description}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {action.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}
