import { Link } from 'react-router-dom';
import { usePageTitle } from '@/lib/page-title';

export function NotFoundPage() {
  usePageTitle('Page not found');

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="font-display text-8xl font-bold text-brand-600">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold uppercase text-ink-950">
        Page not found
      </h1>
      <p className="mt-3 text-ink-600">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-6 font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Back to home
      </Link>
    </div>
  );
}
