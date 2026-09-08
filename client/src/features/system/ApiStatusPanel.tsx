import { useQuery } from '@tanstack/react-query';
import { ServerCog } from 'lucide-react';
import { ApiClientError } from '@/lib/api-client';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchHealth } from './api';

/**
 * A real end-to-end check of the client → API path. It reports exactly what the
 * server says and nothing more; when the API is unreachable it says so rather
 * than showing a reassuring green light.
 */
export function ApiStatusPanel() {
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: fetchHealth,
    // Retry policy comes from the QueryClient default so it stays consistent
    // across the app (and overridable in tests).
    refetchInterval: 30_000,
  });

  if (isPending) {
    return (
      <div className="rounded-card border border-navy-100 bg-white">
        <LoadingState label="Checking API connection…" />
      </div>
    );
  }

  if (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    return (
      <ErrorState
        title="API unreachable"
        message={apiError?.message ?? 'The management API did not respond.'}
        requestId={apiError?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="rounded-card border border-navy-100 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <ServerCog aria-hidden className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-navy-900">Management API</p>
            <p className="text-sm text-navy-500">
              v{data.version} · {data.environment}
            </p>
          </div>
        </div>
        <StatusBadge tone="success">{isFetching ? 'Checking' : 'Connected'}</StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-navy-500">Timezone</dt>
          <dd className="font-medium text-navy-900">{data.timezone}</dd>
        </div>
        <div>
          <dt className="text-navy-500">Uptime</dt>
          <dd className="font-medium text-navy-900">{formatUptime(data.uptimeSeconds)}</dd>
        </div>
        <div>
          <dt className="text-navy-500">Service</dt>
          <dd className="font-medium text-navy-900">{data.service}</dd>
        </div>
      </dl>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
