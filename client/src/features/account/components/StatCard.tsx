import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A headline figure. `emphasis` paints it red, for a figure that needs attention. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'h-full rounded-card border p-5',
        emphasis
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-ink-200 bg-white text-ink-950',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-sm font-semibold', emphasis ? 'text-white' : 'text-ink-600')}>
          {label}
        </p>
        <span
          className={cn(
            'grid size-10 place-items-center rounded-full',
            emphasis ? 'bg-white text-brand-600' : 'bg-brand-50 text-brand-600',
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
      {hint && (
        <p className={cn('mt-1 text-xs', emphasis ? 'text-white' : 'text-ink-500')}>{hint}</p>
      )}
    </div>
  );
}
