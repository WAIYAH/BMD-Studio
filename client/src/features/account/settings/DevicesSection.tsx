import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ApiClientError } from '@/lib/api-client';
import { fetchSessions, revokeSession } from '../api';
import { formatDateTime, timeAgo } from '../format';
import { describeDevice, isMobileDevice } from '../labels';
import { SettingsCard } from './SettingsCard';

const SESSIONS_QUERY_KEY = ['me', 'sessions'] as const;

export function DevicesSection() {
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: fetchSessions,
  });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });

  return (
    <SettingsCard
      title="Signed-in devices"
      description="Where your account is signed in right now. Sign out any device you don’t recognise."
    >
      {isPending ? (
        <LoadingState label="Loading devices…" />
      ) : error ? (
        <ErrorState
          title="Devices could not be loaded"
          message={
            error instanceof ApiClientError ? error.message : 'Your devices are unavailable.'
          }
          requestId={error instanceof ApiClientError ? error.requestId : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="space-y-4">
          {revoke.error && (
            <FormAlert>
              {revoke.error instanceof ApiClientError
                ? revoke.error.message
                : 'That device could not be signed out.'}
            </FormAlert>
          )}
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {data.map((session) => {
              const Icon = isMobileDevice(session.userAgent) ? Smartphone : Monitor;
              const device = describeDevice(session.userAgent);
              return (
                <li key={session.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-full bg-ink-100 text-ink-700"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-950">
                      {device}
                      {session.current && <StatusBadge tone="success">This device</StatusBadge>}
                    </p>
                    <p className="text-sm text-ink-600">
                      Last active {timeAgo(session.lastActiveAt)}
                      {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                    </p>
                    <p className="text-xs text-ink-500">
                      Signed in {formatDateTime(session.signedInAt)}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Sign out ${device}`}
                      loading={revoke.isPending && revoke.variables === session.id}
                      onClick={() => revoke.mutate(session.id)}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SettingsCard>
  );
}
