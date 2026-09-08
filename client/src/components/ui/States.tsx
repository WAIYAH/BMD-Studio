import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Every data surface in this application renders one of four states: loading,
 * error, empty, or content. These components make the first three consistent so
 * no screen silently shows a blank panel.
 */

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12', className)}
    >
      <Loader2 aria-hidden className="size-6 animate-spin text-signal-600" />
      <p className="text-sm text-navy-500">{label}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card',
        'border border-dashed border-navy-200 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-navy-300">{icon ?? <Inbox aria-hidden className="size-8" />}</span>
      <div>
        <p className="font-semibold text-navy-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-navy-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  requestId?: string | undefined;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  requestId,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card',
        'border border-onair-200 bg-onair-50 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="size-7 text-onair-500" />
      <div>
        <p className="font-semibold text-onair-800">{title}</p>
        <p className="mt-1 max-w-md text-sm text-onair-700">{message}</p>
        {requestId && (
          // Surfacing the correlation id lets support tie a report to a log line.
          <p className="mt-2 font-mono text-xs text-onair-600/80">Reference: {requestId}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
