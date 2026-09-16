import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import {
  PRICING_MODEL_UNIT,
  STUDIO_TIMEZONE,
  formatKes,
  type PublicService,
  type PublicServiceCategory,
} from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { CheckboxField, FormAlert } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchServiceCatalogue } from '@/features/catalogue/api';
import { createBooking, fetchQuote } from '@/features/booking/api';
import { QuoteSummary } from '@/features/booking/components/QuoteSummary';
import { SlotPicker } from '@/features/booking/components/SlotPicker';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { zonedDateKey } from '@/lib/datetime';
import { formatMinutes } from '@/lib/format';

/**
 * Booking a session, in three steps: what, when, and confirm.
 *
 * Every choice lives in the URL. A visitor who is sent to sign in at the last
 * step comes back to exactly the slot they had chosen, and a chosen time can be
 * shared or bookmarked.
 */

const shillings = (cents: number) => formatKes(cents, { withDecimals: false });

const todayInStudio = (): string => zonedDateKey(new Date().toISOString(), STUDIO_TIMEZONE);

/** The session lengths a service offers, on its own slot cadence. */
function durationOptions(service: PublicService): number[] {
  const options: number[] = [];
  for (
    let minutes = service.minDurationMinutes;
    minutes <= service.maxDurationMinutes;
    minutes += service.slotIntervalMinutes
  ) {
    options.push(minutes);
  }
  return options;
}

export function BookPage() {
  const [params, setParams] = useSearchParams();
  const {
    data: catalogue,
    error,
    isPending,
    refetch,
  } = useQuery({ queryKey: ['catalogue', 'services'], queryFn: fetchServiceCatalogue });

  const serviceSlug = params.get('service');
  const service = findService(catalogue, serviceSlug);
  const start = params.get('start');

  const step = !service ? 1 : !start ? 2 : 3;

  return (
    <>
      <PageHeader
        eyebrow="Bookings"
        title="Book a session"
        description="Choose a service, pick a time that is free, and see exactly what it costs before you confirm."
      >
        <ol className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
          {['Service', 'Time', 'Confirm'].map((label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? 'step' : undefined}
              className={cn(
                'rounded-full px-3 py-1',
                step === index + 1 ? 'bg-brand-600 text-white' : 'bg-white/10 text-ink-200',
              )}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </PageHeader>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {isPending ? (
          <LoadingState label="Loading services…" />
        ) : error ? (
          <ErrorState
            title="Services could not be loaded"
            message={
              error instanceof ApiClientError
                ? error.message
                : 'The service catalogue is unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : !service ? (
          <ChooseService
            catalogue={catalogue}
            onChoose={(chosen) => {
              const next = new URLSearchParams();
              next.set('service', chosen.slug);
              const room = chosen.rooms[0]?.slug;
              if (room) next.set('room', room);
              next.set('date', todayInStudio());
              next.set('duration', String(chosen.minDurationMinutes));
              const firstPackage = chosen.packages[0]?.id;
              if (firstPackage) next.set('package', firstPackage);
              setParams(next);
            }}
          />
        ) : (
          <ChooseTime service={service} params={params} setParams={setParams} />
        )}
      </div>
    </>
  );
}

function findService(
  catalogue: PublicServiceCategory[] | undefined,
  slug: string | null,
): PublicService | undefined {
  if (!catalogue || !slug) return undefined;
  return catalogue.flatMap((category) => category.services).find((entry) => entry.slug === slug);
}

function ChooseService({
  catalogue,
  onChoose,
}: {
  catalogue: PublicServiceCategory[];
  onChoose: (service: PublicService) => void;
}) {
  if (catalogue.length === 0) {
    return (
      <EmptyState
        title="No services are open for booking"
        description="The studio has not published any bookable services yet."
      />
    );
  }

  return (
    <div className="space-y-10">
      {catalogue.map((category) => (
        <section key={category.slug} aria-labelledby={`category-${category.slug}`}>
          <h2
            id={`category-${category.slug}`}
            className="font-display text-2xl font-bold uppercase text-ink-900"
          >
            {category.name}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {category.services.map((service) => (
              <li key={service.slug}>
                <button
                  type="button"
                  onClick={() => onChoose(service)}
                  className="flex h-full w-full flex-col rounded-card border border-ink-200 p-5 text-left transition-colors hover:border-brand-600"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-xl font-bold uppercase text-ink-950">{service.name}</span>
                    {service.requiresApproval && (
                      <StatusBadge tone="info">Approval required</StatusBadge>
                    )}
                  </span>
                  <span className="mt-2 text-sm text-ink-600">
                    {shillings(service.fromPriceCents)} {PRICING_MODEL_UNIT[service.pricingModel]} ·{' '}
                    {formatMinutes(service.minDurationMinutes)} minimum
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ChooseTime({
  service,
  params,
  setParams,
}: {
  service: PublicService;
  params: URLSearchParams;
  setParams: (next: URLSearchParams) => void;
}) {
  const roomSlug = params.get('room') ?? service.rooms[0]?.slug ?? '';
  const date = params.get('date') ?? todayInStudio();
  const durationMinutes = Number(params.get('duration')) || service.minDurationMinutes;
  const packageId = params.get('package') ?? undefined;
  const start = params.get('start');

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };

  if (start) {
    return (
      <ConfirmBooking
        service={service}
        room={roomSlug}
        startsAt={start}
        durationMinutes={durationMinutes}
        packageId={packageId}
        onBack={() => update({ start: null })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <StepHeading
        title={service.name}
        onBack={() => setParams(new URLSearchParams())}
        backLabel="Change service"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-semibold text-ink-900">
          Room
          <select
            value={roomSlug}
            onChange={(event) => update({ room: event.target.value, start: null })}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
          >
            {service.rooms.map((room) => (
              <option key={room.slug} value={room.slug}>
                {room.name} — {shillings(room.priceCents)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-ink-900">
          Date
          <input
            type="date"
            value={date}
            min={todayInStudio()}
            onChange={(event) => update({ date: event.target.value, start: null })}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
          />
        </label>

        <label className="block text-sm font-semibold text-ink-900">
          Session length
          <select
            value={String(durationMinutes)}
            onChange={(event) => update({ duration: event.target.value, start: null })}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
          >
            {durationOptions(service).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatMinutes(minutes)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {service.packages.length > 0 && (
        <label className="block text-sm font-semibold text-ink-900">
          Package
          <select
            value={packageId ?? service.packages[0]?.id}
            onChange={(event) => update({ package: event.target.value })}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950 sm:max-w-sm"
          >
            {service.packages.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — {shillings(entry.priceCents)}
              </option>
            ))}
          </select>
        </label>
      )}

      <section aria-labelledby="times-heading">
        <h3 id="times-heading" className="font-display text-xl font-bold uppercase text-ink-950">
          Available start times
        </h3>
        <div className="mt-3">
          {roomSlug ? (
            <SlotPicker
              service={service.slug}
              room={roomSlug}
              date={date}
              durationMinutes={durationMinutes}
              selectedStart={null}
              onSelect={(startsAt) => update({ start: startsAt })}
            />
          ) : (
            <p className="text-sm text-ink-600">This service has no bookable room.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StepHeading({
  title,
  onBack,
  backLabel,
}: {
  title: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-3xl font-bold uppercase text-ink-950">{title}</h2>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        leftIcon={<ArrowLeft className="size-4" />}
      >
        {backLabel}
      </Button>
    </div>
  );
}

function ConfirmBooking({
  service,
  room,
  startsAt,
  durationMinutes,
  packageId,
  onBack,
}: {
  service: PublicService;
  room: string;
  startsAt: string;
  durationMinutes: number;
  packageId: string | undefined;
  onBack: () => void;
}) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const slot = {
    service: service.slug,
    room,
    startsAt,
    durationMinutes,
    ...(packageId ? { packageId } : {}),
  };

  const quote = useQuery({
    queryKey: ['booking', 'quote', slot],
    queryFn: () => fetchQuote(slot),
  });

  const confirm = useMutation({
    mutationFn: () =>
      createBooking({
        ...slot,
        acceptTerms: true,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: (booking) => navigate(`/account/bookings/${booking.id}`),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setTermsError('Accept the Booking & Hire Terms to confirm.');
      return;
    }
    setTermsError(null);
    confirm.mutate();
  }

  if (quote.isPending) return <LoadingState label="Working out the price…" />;

  if (quote.error) {
    return (
      <ErrorState
        title="That time could not be priced"
        message={
          quote.error instanceof ApiClientError
            ? quote.error.message
            : 'The price is unavailable right now.'
        }
        requestId={quote.error instanceof ApiClientError ? quote.error.requestId : undefined}
        onRetry={() => void quote.refetch()}
      />
    );
  }

  const failure = confirm.error;

  return (
    <div className="space-y-6">
      <StepHeading title="Confirm your booking" onBack={onBack} backLabel="Change time" />

      {!quote.data.available && (
        <FormAlert>That time has just been taken. Choose another start time.</FormAlert>
      )}

      <QuoteSummary quote={quote.data} />

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

        <div className="rounded-card border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
          {quote.data.requiresApproval ? (
            <p>
              This service needs approval from studio staff. Your booking is held while they review
              it, and you will be told once it is approved.
            </p>
          ) : quote.data.depositCents > 0 ? (
            <p>
              Your room is held for {quote.data.paymentHoldMinutes} minutes for the deposit of{' '}
              <strong>{shillings(quote.data.depositCents)}</strong>.
            </p>
          ) : (
            <p>No deposit is needed. Your booking is confirmed as soon as you finish here.</p>
          )}
          {quote.data.cancellationWindowHours !== null && (
            <p className="mt-2">
              Free cancellation up to {quote.data.cancellationWindowHours} hours before the session
              starts.
            </p>
          )}
        </div>

        {failure && (
          <FormAlert>
            {failure instanceof ApiClientError
              ? failure.message
              : 'Your booking could not be made. Please try again.'}
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
              loading={confirm.isPending}
              disabled={!quote.data.available}
              leftIcon={<Check aria-hidden className="size-4" />}
            >
              Confirm booking
            </Button>
          </>
        ) : (
          <div className="rounded-card border border-ink-200 p-5 text-center">
            <p className="text-sm text-ink-700">
              You need an account to confirm a booking. We will bring you straight back here.
            </p>
            <Link
              to="/login"
              state={{ from: `/book?${new URLSearchParams(slotParams(slot)).toString()}` }}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Sign in to confirm
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}

/** The chosen slot as URL parameters, so signing in returns to this exact step. */
function slotParams(slot: {
  service: string;
  room: string;
  startsAt: string;
  durationMinutes: number;
  packageId?: string;
}): Record<string, string> {
  return {
    service: slot.service,
    room: slot.room,
    start: slot.startsAt,
    duration: String(slot.durationMinutes),
    ...(slot.packageId ? { package: slot.packageId } : {}),
  };
}
