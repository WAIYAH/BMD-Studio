import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ON_AIR_QUERY_KEY, fetchOnAir } from './api';

/**
 * The header ON AIR light. It lights only while an operator has an airing on
 * air. While the state is loading, unreadable or off air it renders nothing at
 * all — an indicator that guesses is worse than none.
 */
export function OnAirIndicator() {
  const { data, isError } = useQuery({
    queryKey: ON_AIR_QUERY_KEY,
    queryFn: fetchOnAir,
    refetchInterval: 30_000,
  });

  const current = isError ? null : data?.current;
  if (!current) return null;

  return (
    <Link
      to="/live"
      aria-label={`On air now: ${current.showName}`}
      className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-navy-50"
    >
      <StatusBadge tone="live" pulse>
        On air
      </StatusBadge>
      <span className="hidden max-w-40 truncate text-sm font-medium text-navy-900 lg:inline">
        {current.showName}
      </span>
    </Link>
  );
}
