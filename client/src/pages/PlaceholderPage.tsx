import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

/**
 * Honest placeholder for a route whose module has not been built yet.
 *
 * It deliberately shows no sample data: a screen that displays invented
 * bookings or a fake ON AIR state is worse than one that says "not built yet".
 */
export function PlaceholderPage({
  title,
  phase,
  summary,
}: {
  title: string;
  phase: string;
  summary: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-navy-50 text-navy-500">
        <Construction aria-hidden className="size-6" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-bold uppercase text-navy-900">{title}</h1>
      <p className="mt-3 text-navy-600">{summary}</p>
      <p className="mt-6 inline-flex rounded-full bg-navy-100 px-3 py-1 text-sm font-medium text-navy-700">
        Scheduled for {phase}
      </p>
      <div className="mt-8">
        <Link to="/" className="text-sm font-semibold text-signal-600 hover:text-signal-700">
          Back to home
        </Link>
      </div>
    </div>
  );
}
