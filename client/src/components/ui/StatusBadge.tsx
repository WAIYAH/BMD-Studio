import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'live';

/**
 * With only red, white and black to work with, tone is carried by weight as
 * much as hue: a solid black pill reads as positive, a red tint as a caution,
 * and solid red is reserved for live.
 */
const TONES: Record<StatusTone, string> = {
  neutral: 'bg-ink-100 text-ink-800',
  info: 'bg-white text-ink-900 ring-1 ring-inset ring-ink-300',
  success: 'bg-ink-900 text-white',
  warning: 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200',
  danger: 'bg-brand-100 text-brand-800',
  live: 'bg-brand-600 text-white',
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  /** Shows a pulsing dot; reserved for genuinely live states. */
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({
  tone = 'neutral',
  children,
  pulse = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        // A badge never wraps; the text beside it gives way instead.
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1',
        'text-xs font-semibold uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {pulse && <span aria-hidden className="onair-pulse size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
