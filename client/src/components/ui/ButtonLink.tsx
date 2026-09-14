import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-ink-300 bg-white text-ink-950 hover:bg-ink-100',
  dark: 'bg-ink-950 text-white hover:bg-ink-800',
} as const;

/** A router link styled as a pill button. */
export function ButtonLink({
  variant = 'primary',
  icon,
  className,
  children,
  ...props
}: LinkProps & { variant?: keyof typeof VARIANTS; icon?: ReactNode }) {
  return (
    <Link
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
        VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
