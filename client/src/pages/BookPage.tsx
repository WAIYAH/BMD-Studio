import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const NEXT_STEPS = [
  {
    to: '/services',
    title: 'Services & pricing',
    description: 'Every bookable service, the rooms it runs in and exactly what it costs.',
  },
  {
    to: '/visit',
    title: 'Visit the studio',
    description: 'Opening hours, where to find us and the rooms available.',
  },
];

/**
 * Online booking needs customer accounts and the availability engine, and
 * neither is live yet. Until then this page says so plainly and points visitors
 * at what already works, rather than showing a form that cannot be submitted.
 */
export function BookPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bookings"
        title="Book a session"
        description="Online booking is not open yet. You can already browse every service and its price, and check when the studio is open."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {NEXT_STEPS.map((step) => (
            <li key={step.to} className="flex">
              <Link
                to={step.to}
                className="group flex w-full flex-col rounded-card border border-ink-200 p-6 transition-colors hover:border-brand-600"
              >
                <span className="font-display text-2xl font-bold uppercase text-ink-950">
                  {step.title}
                </span>
                <span className="mt-2 text-sm text-ink-600">{step.description}</span>
                <ArrowRight
                  aria-hidden
                  className="mt-5 size-5 text-brand-600 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
