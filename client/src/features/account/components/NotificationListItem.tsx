import type { DashboardNotification } from '@bmd/shared';
import { cn } from '@/lib/cn';
import { timeAgo } from '../format';

export function NotificationListItem({
  notification,
  onMarkRead,
  busy = false,
}: {
  notification: DashboardNotification;
  onMarkRead?: (id: string) => void;
  busy?: boolean;
}) {
  const unread = notification.readAt === null;

  return (
    <article
      aria-label={notification.title}
      className={cn('flex gap-4 px-5 py-4', unread && 'bg-brand-50/50')}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2.5 shrink-0 rounded-full',
          unread ? 'bg-brand-600' : 'bg-ink-200',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cn('text-ink-950', unread ? 'font-bold' : 'font-semibold')}>
            {notification.title}
            {unread && <span className="sr-only"> (unread)</span>}
          </p>
          <time dateTime={notification.createdAt} className="text-xs text-ink-500">
            {timeAgo(notification.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 text-sm text-ink-600">{notification.body}</p>
        {unread && onMarkRead && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkRead(notification.id)}
            className="mt-2 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 disabled:opacity-50"
          >
            Mark as read
          </button>
        )}
      </div>
    </article>
  );
}
