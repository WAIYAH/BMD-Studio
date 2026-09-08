import { Link } from 'react-router-dom';
import { Camera, Headphones, Mic, Radio, Video } from 'lucide-react';
import { ApiStatusPanel } from '@/features/system/ApiStatusPanel';

const CAPABILITIES = [
  {
    icon: Radio,
    title: 'Radio broadcast',
    description: 'Full broadcast studio with live desk, guest positions and show scheduling.',
  },
  {
    icon: Mic,
    title: 'Podcast recording',
    description: 'Treated rooms, multi-mic setups and same-day edited audio.',
  },
  {
    icon: Video,
    title: 'Livestream production',
    description: 'Multi-camera production streamed to YouTube, Facebook and your own channels.',
  },
  {
    icon: Camera,
    title: 'Photography',
    description: 'Portrait, product and event photography with retouched deliverables.',
  },
  {
    icon: Headphones,
    title: 'Voice-over & music',
    description: 'Voice-over booths, music recording, mixing and mastering.',
  },
];

export function HomePage() {
  return (
    <>
      <section className="bg-navy-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-onair-400">
              Nairobi · Kenya
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-tight sm:text-5xl lg:text-6xl">
              Broadcast-grade studios,
              <span className="block text-signal-400">booked in minutes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-200">
              B.M.D Studio runs radio, podcast, photography, video and livestream production under
              one roof — and one operating system. Check availability, book a room, hire equipment
              and pay with M-Pesa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/book"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-signal-600 px-6 text-base font-semibold text-white transition-colors hover:bg-signal-700"
              >
                Book a session
              </Link>
              <Link
                to="/live"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                Watch live
              </Link>
            </div>
          </div>

          <div className="rounded-card bg-white/5 p-1 ring-1 ring-white/10">
            <div className="rounded-[0.6rem] bg-white p-5 text-navy-900">
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-navy-500">
                System status
              </p>
              <div className="mt-3">
                <ApiStatusPanel />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold uppercase text-navy-900">What we produce</h2>
        <p className="mt-2 max-w-2xl text-navy-600">
          Every service below is configured in the management system — pricing, duration and
          availability are set by studio staff, not hard-coded.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-card border border-navy-100 p-5 transition-shadow hover:shadow-sm"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-signal-50 text-signal-600">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-navy-900">{title}</h3>
              <p className="mt-1 text-sm text-navy-600">{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
