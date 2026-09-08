import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="font-display text-6xl font-bold text-navy-200">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold uppercase text-navy-900">
        Page not found
      </h1>
      <p className="mt-3 text-navy-600">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-signal-600 px-6 font-semibold text-white transition-colors hover:bg-signal-700"
      >
        Back to home
      </Link>
    </div>
  );
}
