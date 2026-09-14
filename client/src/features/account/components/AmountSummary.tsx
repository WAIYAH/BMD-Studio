import { cn } from '@/lib/cn';
import { shillings } from '../format';

/** Total on the first line; what is still owed, or "Paid in full", beneath it. */
export function AmountSummary({
  totalCents,
  paidCents,
  billable,
}: {
  totalCents: number;
  paidCents: number;
  /** False for records that no longer owe anything, such as a cancelled booking. */
  billable: boolean;
}) {
  const outstanding = Math.max(0, totalCents - paidCents);

  return (
    <div className="shrink-0 text-right">
      <p className="font-semibold text-ink-950">{shillings(totalCents)}</p>
      {billable && (
        <p
          className={cn(
            'text-xs',
            outstanding > 0 ? 'font-semibold text-brand-700' : 'text-ink-500',
          )}
        >
          {outstanding > 0 ? `${shillings(outstanding)} due` : 'Paid in full'}
        </p>
      )}
    </div>
  );
}
