import { STUDIO_TIMEZONE, type BookingQuote } from '@bmd/shared';
import { formatClockRange } from '@/lib/datetime';
import { formatMinutes } from '@/lib/format';
import { formatDate, shillings } from '@/features/account/format';

/** The server's price, itemised. Nothing here is calculated in the browser. */
export function QuoteSummary({ quote }: { quote: BookingQuote }) {
  return (
    <div className="rounded-card border border-ink-200 bg-white">
      <dl className="divide-y divide-ink-100">
        <Row term="Service" detail={quote.serviceName} />
        <Row term="Room" detail={`${quote.roomName}, ${quote.studioName}`} />
        <Row term="Date" detail={formatDate(quote.startsAt)} />
        <Row
          term="Time"
          detail={`${formatClockRange(quote.startsAt, quote.endsAt, STUDIO_TIMEZONE)} · ${formatMinutes(
            quote.durationMinutes,
          )}`}
        />
        {quote.packageName && <Row term="Package" detail={quote.packageName} />}
      </dl>

      <div className="border-t border-ink-200 px-5 py-4">
        <ul className="space-y-2 text-sm">
          {quote.lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-4">
              <span className="text-ink-700">{line.label}</span>
              <span className="font-medium text-ink-950">{shillings(line.totalCents)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4">
            <span className="text-ink-700">
              {quote.vatPercent === null ? 'VAT' : `VAT at ${quote.vatPercent}%`}
            </span>
            <span className="font-medium text-ink-950">{shillings(quote.taxCents)}</span>
          </li>
        </ul>

        <p className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink-100 pt-4">
          <span className="font-display text-xl font-bold uppercase text-ink-950">Total</span>
          <span className="font-display text-2xl font-bold text-ink-950">
            {shillings(quote.totalCents)}
          </span>
        </p>

        {quote.depositCents > 0 && quote.depositCents < quote.totalCents && (
          <p className="mt-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="text-ink-600">To confirm now</span>
            <span className="font-semibold text-brand-700">{shillings(quote.depositCents)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3 text-sm">
      <dt className="text-ink-500">{term}</dt>
      <dd className="text-right font-medium text-ink-950">{detail}</dd>
    </div>
  );
}
