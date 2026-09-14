import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, Check, Radio } from 'lucide-react';

const BENEFITS = [
  'Follow every upcoming studio session',
  'See your payments, receipts and balance',
  'Collect your photos and recordings',
  'Choose how the studio contacts you',
];

/** Split-screen frame for sign-in and sign-up: brand panel on the left, form on the right. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[28rem] rounded-full bg-brand-700"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-[22rem] rounded-full border-[3rem] border-brand-500"
        />

        <Link to="/" className="relative flex items-center gap-2.5" aria-label="B.M.D Studio home">
          <span className="grid size-10 place-items-center rounded-full bg-white text-brand-600">
            <Radio aria-hidden className="size-5" />
          </span>
          <span className="font-display text-2xl font-bold uppercase tracking-wide">
            B.M.D <span className="text-ink-950">Studio</span>
          </span>
        </Link>

        <div className="relative">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em]">
            Your studio account
          </p>
          <p className="mt-3 font-display text-6xl font-bold uppercase leading-[0.95]">
            Every session.
            <span className="block text-ink-950">One place.</span>
          </p>
          <ul className="mt-8 space-y-3 text-lg">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-brand-600">
                  <Check aria-hidden className="size-4" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm">B.M.D Studio · Nairobi, Kenya</p>
      </aside>

      <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 lg:invisible"
            aria-label="B.M.D Studio home"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-white">
              <Radio aria-hidden className="size-5" />
            </span>
            <span className="font-display text-xl font-bold uppercase tracking-wide text-ink-950">
              B.M.D <span className="text-brand-600">Studio</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 transition-colors hover:text-ink-950"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to website
          </Link>
        </div>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
