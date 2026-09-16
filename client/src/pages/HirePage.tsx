import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Minus, Package, Plus } from 'lucide-react';
import {
  STUDIO_TIMEZONE,
  formatKes,
  type EquipmentAvailability,
  type HireQuote,
} from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { CheckboxField, FormAlert } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createRental, fetchEquipmentAvailability, fetchHireQuote } from '@/features/rental/api';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { zonedDateKey } from '@/lib/datetime';

/**
 * Requesting an equipment hire: pick the dates, pick the kit, see the price.
 *
 * The chosen dates and items live in the URL, so a visitor sent to sign in
 * comes back to the same basket.
 */

const shillings = (cents: number) => formatKes(cents, { withDecimals: false });

const today = (): string => zonedDateKey(new Date().toISOString(), STUDIO_TIMEZONE);

/** `items=key:2,other:1` — product keys never contain a comma or colon. */
function parseItems(value: string | null): Array<{ key: string; quantity: number }> {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => {
      const [key, quantity] = entry.split(':');
      const count = Number(quantity ?? 1);
      return key && Number.isInteger(count) && count > 0 ? { key, quantity: count } : null;
    })
    .filter((entry): entry is { key: string; quantity: number } => entry !== null);
}

const serialiseItems = (items: Array<{ key: string; quantity: number }>): string =>
  items.map((item) => `${item.key}:${item.quantity}`).join(',');

export function HirePage() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? today();
  const to = params.get('to') ?? from;
  const items = parseItems(params.get('items'));

  const availability = useQuery({
    queryKey: ['equipment', 'availability', from, to],
    queryFn: () => fetchEquipmentAvailability({ from, to }),
  });

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };

  const setQuantity = (key: string, quantity: number) => {
    const rest = items.filter((item) => item.key !== key);
    const next = quantity > 0 ? [...rest, { key, quantity }] : rest;
    update({ items: serialiseItems(next) });
  };

  return (
    <>
      <PageHeader
        eyebrow="Hire"
        title="Request equipment"
        description="Choose your dates and the kit you need. Equipment is collected and returned in opening hours, and charged per day."
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-ink-900">
            Collection date
            <input
              type="date"
              value={from}
              min={today()}
              onChange={(event) => update({ from: event.target.value })}
              className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
            />
          </label>
          <label className="block text-sm font-semibold text-ink-900">
            Return date
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => update({ to: event.target.value })}
              className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
            />
          </label>
        </div>

        <div className="mt-8">
          {availability.isPending ? (
            <LoadingState label="Checking what is free…" />
          ) : availability.error ? (
            <ErrorState
              title="Equipment could not be checked"
              message={
                availability.error instanceof ApiClientError
                  ? availability.error.message
                  : 'Availability is unavailable right now.'
              }
              requestId={
                availability.error instanceof ApiClientError
                  ? availability.error.requestId
                  : undefined
              }
              onRetry={() => void availability.refetch()}
            />
          ) : (
            <HireBasket
              availability={availability.data}
              items={items}
              onQuantityChange={setQuantity}
            />
          )}
        </div>
      </div>
    </>
  );
}

function HireBasket({
  availability,
  items,
  onQuantityChange,
}: {
  availability: EquipmentAvailability;
  items: Array<{ key: string; quantity: number }>;
  onQuantityChange: (key: string, quantity: number) => void;
}) {
  const chosen = new Map(items.map((item) => [item.key, item.quantity]));

  if (availability.items.length === 0) {
    return (
      <EmptyState
        title="No equipment is listed for hire"
        description="The studio has not added any hire equipment yet."
      />
    );
  }

  return (
    <div className="space-y-8">
      {availability.closedOn.length > 0 && (
        <FormAlert>
          The studio is closed on {availability.closedOn.join(' and ')}, so equipment cannot be
          collected or returned then. Choose other dates.
        </FormAlert>
      )}

      <section aria-labelledby="kit-heading">
        <h2 id="kit-heading" className="font-display text-2xl font-bold uppercase text-ink-950">
          Choose your kit
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          {availability.days} {availability.days === 1 ? 'day' : 'days'}, charged per day.
        </p>

        <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200">
          {availability.items.map((item) => {
            const quantity = chosen.get(item.key) ?? 0;
            return (
              <li key={item.key} className="flex flex-wrap items-center gap-4 p-4">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"
                >
                  <Package className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-950">{item.name}</p>
                  <p className="text-sm text-ink-600">
                    {shillings(item.dailyRateCents)} per day
                    {item.depositCents > 0 && ` · ${shillings(item.depositCents)} deposit`}
                  </p>
                </div>
                {item.availableCount > 0 ? (
                  <StatusBadge tone="success">{item.availableCount} free</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">None free</StatusBadge>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`One fewer ${item.name}`}
                    disabled={quantity === 0}
                    onClick={() => onQuantityChange(item.key, quantity - 1)}
                  >
                    <Minus aria-hidden className="size-4" />
                  </Button>
                  <span aria-live="polite" className="w-6 text-center font-semibold text-ink-950">
                    {quantity}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`One more ${item.name}`}
                    disabled={quantity >= item.availableCount}
                    onClick={() => onQuantityChange(item.key, quantity + 1)}
                  >
                    <Plus aria-hidden className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {items.length > 0 && (
        <HireSummary from={availability.from} to={availability.to} items={items} />
      )}
    </div>
  );
}

function HireSummary({
  from,
  to,
  items,
}: {
  from: string;
  to: string;
  items: Array<{ key: string; quantity: number }>;
}) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const quote = useQuery({
    queryKey: ['equipment', 'quote', from, to, items],
    queryFn: () => fetchHireQuote({ from, to, items }),
  });

  const submit = useMutation({
    mutationFn: () =>
      createRental({
        from,
        to,
        items,
        acceptTerms: true,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: (rental) => navigate(`/account/rentals/${rental.id}`),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setTermsError('Accept the Booking & Hire Terms to request a hire.');
      return;
    }
    setTermsError(null);
    submit.mutate();
  }

  if (quote.isPending) return <LoadingState label="Working out the price…" />;
  if (quote.error) {
    return (
      <ErrorState
        title="That hire could not be priced"
        message={
          quote.error instanceof ApiClientError
            ? quote.error.message
            : 'The price is unavailable right now.'
        }
        onRetry={() => void quote.refetch()}
      />
    );
  }

  const data: HireQuote = quote.data;

  return (
    <section aria-labelledby="hire-summary" className="space-y-5">
      <h2 id="hire-summary" className="font-display text-2xl font-bold uppercase text-ink-950">
        Your hire
      </h2>

      <div className="rounded-card border border-ink-200 bg-white">
        <ul className="divide-y divide-ink-100">
          {data.lines.map((line) => (
            <li key={line.key} className="flex justify-between gap-4 px-5 py-3 text-sm">
              <span className="text-ink-700">
                {line.label} × {line.quantity}
                {line.availableCount < line.quantity && (
                  <span className="ml-2 font-semibold text-brand-700">
                    only {line.availableCount} free
                  </span>
                )}
              </span>
              <span className="font-medium text-ink-950">{shillings(line.totalCents)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-ink-200 px-5 py-4 text-sm">
          <Row term={`Hire, ${data.days} ${data.days === 1 ? 'day' : 'days'}`}>
            {shillings(data.subtotalCents)}
          </Row>
          <Row term={data.vatPercent === null ? 'VAT' : `VAT at ${data.vatPercent}%`}>
            {shillings(data.taxCents)}
          </Row>
          <Row term="Refundable deposit">{shillings(data.depositCents)}</Row>
          <div className="flex items-baseline justify-between gap-4 border-t border-ink-100 pt-3">
            <dt className="font-display text-xl font-bold uppercase text-ink-950">Total</dt>
            <dd className="font-display text-2xl font-bold text-ink-950">
              {shillings(data.totalCents)}
            </dd>
          </div>
        </dl>
      </div>

      <p className="rounded-card border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
        Studio staff check every request before the equipment is reserved for you. You will be told
        as soon as it is approved.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-semibold text-ink-900">
          Anything the studio should know? (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-sm font-normal text-ink-950"
          />
        </label>

        {submit.error && (
          <FormAlert>
            {submit.error instanceof ApiClientError
              ? submit.error.message
              : 'Your request could not be sent. Please try again.'}
          </FormAlert>
        )}

        {status === 'authenticated' ? (
          <>
            <CheckboxField
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              error={termsError ?? undefined}
              label={
                <>
                  I accept the{' '}
                  <Link
                    to="/booking-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Booking &amp; Hire Terms
                  </Link>
                  .
                </>
              }
            />
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submit.isPending}
              disabled={!data.available}
            >
              Request this hire
            </Button>
          </>
        ) : (
          <div className="rounded-card border border-ink-200 p-5 text-center">
            <p className="text-sm text-ink-700">
              You need an account to request a hire. We will bring you straight back here.
            </p>
            <Link
              to="/login"
              state={{
                from: `/hire?from=${from}&to=${to}&items=${encodeURIComponent(serialiseItems(items))}`,
              }}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Sign in to request
            </Link>
          </div>
        )}
      </form>
    </section>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-600">{term}</dt>
      <dd className="font-medium text-ink-950">{children}</dd>
    </div>
  );
}
