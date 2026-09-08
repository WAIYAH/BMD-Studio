import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'live';

const TONES: Record<StatusTone, string> = {
  neutral: 'bg-navy-100 text-navy-700',
  info: 'bg-signal-100 text-signal-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-onair-100 text-onair-800',
  live: 'bg-onair-500 text-white',
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
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
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
