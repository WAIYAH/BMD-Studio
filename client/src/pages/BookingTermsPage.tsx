import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { PublicBookingPolicy } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchBookingPolicy } from '@/features/legal/api';
import { LegalContact } from '@/features/legal/LegalContact';
import { LegalDocument, type LegalSection } from '@/features/legal/LegalDocument';
import { LEGAL_ENTITY } from '@/features/legal/entity';
import { ApiClientError } from '@/lib/api-client';

const TITLE = 'Booking & Hire Terms';
const SUMMARY =
  'How studio bookings and equipment hire work: prices, deposits, cancellations, late returns and damage.';

const count = (value: number, one: string, many: string): string =>
  `${value} ${value === 1 ? one : many}`;

/**
 * The terms quote the deposit, cancellation period, late fee and VAT straight
 * from the studio's settings, so the page can never disagree with them. A
 * figure that is not configured is described, never guessed.
 */
function bookingSections(policy: PublicBookingPolicy): LegalSection[] {
  const {
    cancellationWindowHours,
    maxAdvanceDays,
    depositPercent,
    lateFeePercentPerDay,
    vatPercent,
  } = policy;

  return [
    {
      id: 'about',
      title: 'About these terms',
      body: (
        <>
          <p>
            These terms apply to every studio booking and equipment hire with {LEGAL_ENTITY.name},
            however it is made — in person, by phone, or online once online booking opens. They sit
            alongside our <Link to="/terms">Terms of Use</Link>.
          </p>
          <p>
            The deposit, cancellation period, late fee and VAT on this page are read directly from
            the studio’s current settings.
          </p>
          <LegalContact />
        </>
      ),
    },
    {
      id: 'bookings',
      title: 'Making a booking',
      body: (
        <ul>
          <li>A booking is for a specific service, room, date and time.</li>
          <li>
            Some services need approval from studio staff before a booking is confirmed. They are
            marked “Approval required” on the <Link to="/services">Services</Link> page.
          </li>
          <li>
            {maxAdvanceDays !== null
              ? `Sessions can be booked up to ${count(maxAdvanceDays, 'day', 'days')} in advance.`
              : 'How far in advance you can book is confirmed when you book.'}
          </li>
          <li>Sessions end at the booked time so the room can be prepared for the next booking.</li>
        </ul>
      ),
    },
    {
      id: 'prices-and-payment',
      title: 'Prices, deposits and payment',
      body: (
        <ul>
          <li>
            Prices are listed in Kenyan shillings on the <Link to="/services">Services</Link> page.
            The final price is calculated and confirmed when you book.
          </li>
          <li>
            {vatPercent !== null
              ? `VAT at ${vatPercent}% is added where it applies.`
              : 'VAT is added where it applies.'}
          </li>
          <li>
            {depositPercent === null
              ? 'Any deposit needed to confirm your booking is set out when you book.'
              : depositPercent > 0
                ? `A deposit of ${depositPercent}% of the total confirms your booking.`
                : 'No deposit is needed to confirm a booking.'}
          </li>
          <li>
            Payment can be made by M-Pesa, card, cash or bank transfer, as confirmed when you book.
            You receive a receipt for every payment.
          </li>
        </ul>
      ),
    },
    {
      id: 'cancellations',
      title: 'Cancelling or changing a booking',
      body: (
        <ul>
          <li>
            {cancellationWindowHours !== null
              ? `You can cancel free of charge up to ${count(cancellationWindowHours, 'hour', 'hours')} before your session starts.`
              : 'The period in which you can cancel free of charge is confirmed when you book.'}
          </li>
          <li>Later cancellations, and sessions you do not attend, are not free of charge.</li>
          <li>You can ask to move a booking to another time, subject to availability.</li>
          <li>
            If we have to cancel your session, you can move it to another available time or receive
            a full refund of what you paid for it.
          </li>
          <li>Refunds are paid back through the original payment method wherever possible.</li>
        </ul>
      ),
    },
    {
      id: 'equipment-hire',
      title: 'Equipment hire',
      body: (
        <ul>
          <li>
            Equipment is hired per day at the daily rate listed on the{' '}
            <Link to="/equipment">Equipment</Link> page. Where an item lists a deposit, it is paid
            before the item goes out and refunded once it comes back in good condition.
          </li>
          <li>We record the condition of each item when it goes out and when it comes back.</li>
          <li>
            Return equipment by the agreed time.{' '}
            {lateFeePercentPerDay !== null
              ? `Late returns are charged ${lateFeePercentPerDay}% of the item’s daily rate for each day late.`
              : 'Late returns are charged as confirmed when you hire.'}
          </li>
          <li>
            If equipment is lost or damaged while hired to you, you pay the reasonable cost of
            repair or replacement, which may be taken from the deposit. Normal wear and tear is not
            charged.
          </li>
          <li>Hired equipment must not be lent or re-hired to anyone else.</li>
        </ul>
      ),
    },
    {
      id: 'recordings',
      title: 'Recordings, photographs and livestreams',
      body: (
        <ul>
          <li>
            A photography package includes the number of edited photos and the turnaround shown for
            it on the <Link to="/services">Services</Link> page.
          </li>
          <li>
            You need the consent of everyone you bring who will be recorded, photographed or
            streamed — and of a parent or guardian for anyone under 18.
          </li>
          <li>A livestream is public on every platform it is broadcast to.</li>
        </ul>
      ),
    },
    {
      id: 'at-the-studio',
      title: 'At the studio',
      body: (
        <ul>
          <li>Follow the instructions of studio staff, especially around equipment and safety.</li>
          <li>
            You are responsible for damage to rooms or equipment caused by you or your guests.
          </li>
          <li>We may end a session early if conduct is unsafe or unlawful.</li>
        </ul>
      ),
    },
    {
      id: 'liability',
      title: 'Our liability',
      body: (
        <>
          <p>
            Nothing in these terms limits your rights under the Consumer Protection Act, 2012, or
            any liability that cannot be limited under Kenyan law, including for death or personal
            injury caused by negligence.
          </p>
          <p>
            Personal belongings you bring to the studio are your responsibility, unless loss or
            damage is caused by our negligence.
          </p>
        </>
      ),
    },
    {
      id: 'law',
      title: 'Governing law',
      body: (
        <p>
          These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction
          over any dispute about them.
        </p>
      ),
    },
  ];
}

export function BookingTermsPage() {
  const { data, error, refetch } = useQuery({
    queryKey: ['policies', 'booking'],
    queryFn: fetchBookingPolicy,
  });

  if (data) {
    return <LegalDocument title={TITLE} summary={SUMMARY} sections={bookingSections(data)} />;
  }

  // Terms without their figures would mislead, so nothing is shown until they load.
  return (
    <>
      <PageHeader eyebrow="Legal" title={TITLE} description={SUMMARY} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {error ? (
          <ErrorState
            title="These terms could not be loaded"
            message={
              error instanceof ApiClientError ? error.message : 'The booking terms are unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : (
          <LoadingState label="Loading the terms…" />
        )}
      </div>
    </>
  );
}
