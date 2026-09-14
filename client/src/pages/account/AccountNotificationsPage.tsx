import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationFilter } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { NotificationListItem } from '@/features/account/components/NotificationListItem';
import { Pagination } from '@/features/account/components/Pagination';
import { PanelEmpty } from '@/features/account/components/Panel';
import { ToggleGroup } from '@/features/account/components/ToggleGroup';
import { pageParam } from '@/features/account/format';
import { ApiClientError } from '@/lib/api-client';

export function AccountNotificationsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter: NotificationFilter = params.get('filter') === 'unread' ? 'unread' : 'all';
  const page = pageParam(params.get('page'));

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'notifications', filter, page],
    queryFn: () => fetchNotifications(filter, page),
    placeholderData: keepPreviousData,
  });

  // Reading a notification changes the list, the unread badge and the dashboard.
  const refreshAccount = () => queryClient.invalidateQueries({ queryKey: ['me'] });
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refreshAccount });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refreshAccount });
  const actionError = markOne.error ?? markAll.error;

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Notifications"
        description="Messages from the studio about your sessions, hires and payments."
        actions={
          <Button
            variant="secondary"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
            leftIcon={<CheckCheck aria-hidden className="size-4" />}
          >
            Mark all as read
          </Button>
        }
      />

      <ToggleGroup
        label="Which notifications"
        value={filter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        onChange={(next) => setParams({ filter: next })}
      />

      {actionError && (
        <FormAlert>
          {actionError instanceof ApiClientError
            ? actionError.message
            : 'That could not be marked as read. Please try again.'}
        </FormAlert>
      )}

      <div className="rounded-card border border-ink-200 bg-white">
        {isPending ? (
          <LoadingState label="Loading notifications…" />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title="Notifications could not be loaded"
              message={
                error instanceof ApiClientError
                  ? error.message
                  : 'Your notifications are unavailable.'
              }
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
              onRetry={() => void refetch()}
            />
          </div>
        ) : data.items.length === 0 ? (
          <PanelEmpty
            icon={Bell}
            title="You’re all caught up"
            description={
              filter === 'unread'
                ? 'You have read every message from the studio.'
                : 'Messages from the studio will show here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {data.items.map((notification) => (
                <li key={notification.id}>
                  <NotificationListItem
                    notification={notification}
                    busy={markOne.isPending && markOne.variables === notification.id}
                    onMarkRead={(id) => markOne.mutate(id)}
                  />
                </li>
              ))}
            </ul>
            <Pagination
              meta={data.meta}
              onPageChange={(next) => setParams({ filter, page: String(next) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
