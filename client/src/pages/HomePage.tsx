import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Headphones, Mic, Radio, Video } from 'lucide-react';
import { PRICING_MODEL_UNIT, formatKes, type PublicService } from '@bmd/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ON_AIR_QUERY_KEY, fetchOnAir } from '@/features/broadcast/api';
import { fetchServiceCatalogue } from '@/features/catalogue/api';
import { formatClock, formatClockRange, formatDayHeading } from '@/lib/datetime';
import { usePageTitle } from '@/lib/page-title';

const CAPABILITIES = [
  {
    icon: Radio,
    title: 'Radio broadcast',
    description: 'A full broadcast studio with a live desk, guest positions and an engineer.',
  },
  {
    icon: Mic,
    title: 'Podcast recording',
    description: 'Acoustically treated rooms, multi-mic setups and same-day raw files.',
  },
  {
    icon: Video,
    title: 'Livestream production',
    description: 'Multi-camera production streamed to YouTube, Facebook and your own channels.',
  },
  {
    icon: Camera,
    title: 'Photography',
    description: 'Portrait and product photography with retouched deliverables.',
  },
  {
    icon: Headphones,
    title: 'Voice-over & music',
    description: 'Booth time for adverts, narration, dubbing and music recording.',
  },
];

const SECONDARY_LINKS = [
  {
    to: '/equipment',
    title: 'Equipment hire',
    description: 'Cameras, microphones, lighting and audio gear from the studio’s own store.',
  },
  {
    to: '/shows',
    title: 'Shows & schedule',
    description: 'What is on the studio’s radio this week, and who presents it.',
  },
  {
    to: '/visit',
    title: 'Visit the studio',
    description: 'Opening hours, where to find us and the rooms you can book.',
  },
];

const shillings = (cents: number) => formatKes(cents, { withDecimals: false });

export function HomePage() {
  usePageTitle(null);

  return (
    <>
      <section className="bg-brand-600 text-white [&_:focus-visible]:outline-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em]">
              Nairobi · Kenya
            </p>
            <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-[0.95] sm:text-6xl lg:text-7xl">
              Broadcast-grade studios
              <span className="block text-ink-950">in Nairobi.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg">
              Radio, podcast, photography, video and livestream production under one roof — with the
              rooms, engineers and equipment to take your idea on air.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/services"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-brand-700 transition-colors hover:bg-ink-100"
              >
                Explore services
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                to="/live"
                className="inline-flex h-12 items-center justify-center rounded-full bg-ink-950 px-6 text-base font-semibold text-white transition-colors hover:bg-ink-800"
              >
                Watch live
              </Link>
            </div>
          </div>

          <OnAirPanel />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          What we do
        </p>
        <h2 className="mt-2 font-display text-4xl font-bold uppercase text-ink-950">
          What we produce
        </h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-card border border-ink-200 p-6 transition-colors hover:border-brand-600"
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-600 text-white">
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="mt-4 text-2xl font-bold uppercase text-ink-950">{title}</h3>
              <p className="mt-1 text-sm text-ink-600">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <FeaturedServices />

      <section className="bg-ink-950 text-white">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          {SECONDARY_LINKS.map((link) => (
            <li key={link.to} className="flex">
              <Link
                to={link.to}
                className="group flex w-full flex-col rounded-card border border-ink-800 p-6 transition-colors hover:border-brand-600"
              >
                <span className="font-display text-2xl font-bold uppercase">{link.title}</span>
                <span className="mt-2 text-sm text-ink-300">{link.description}</span>
                <ArrowRight
                  aria-hidden
                  className="mt-5 size-5 text-brand-500 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** What is on the studio's radio now, or next — read from the real schedule. */
function OnAirPanel() {
  const { data, isPending, isError } = useQuery({
    queryKey: ON_AIR_QUERY_KEY,
    queryFn: fetchOnAir,
    refetchInterval: 30_000,
  });

  let body;
  if (isPending) {
    body = (
      <p role="status" className="text-ink-400">
        Checking the schedule…
      </p>
    );
  } else if (isError) {
    body = <p className="text-ink-300">The live schedule is unavailable right now.</p>;
  } else if (data.current) {
    const { current, timezone } = data;
    body = (
      <>
        <StatusBadge tone="live" pulse>
          On air
        </StatusBadge>
        <p className="mt-3 font-display text-4xl font-bold uppercase">{current.showName}</p>
        {current.title && <p className="text-ink-300">{current.title}</p>}
        <p className="mt-2 font-mono text-sm text-ink-300">
          {formatClockRange(current.startsAt, current.endsAt, timezone)}
        </p>
      </>
    );
  } else if (data.next) {
    const { next, timezone } = data;
    body = (
      <>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Next on air</p>
        <p className="mt-2 font-display text-4xl font-bold uppercase">{next.showName}</p>
        <p className="mt-2 text-ink-300">
          {`${formatDayHeading(next.startsAt, timezone)} · ${formatClock(next.startsAt, timezone)}`}
        </p>
      </>
    );
  } else {
    body = <p className="text-ink-300">No shows are scheduled yet.</p>;
  }

  return (
    <aside
      aria-labelledby="home-onair-title"
      className="rounded-card bg-ink-950 p-6 text-white shadow-2xl sm:p-8"
    >
      <h2
        id="home-onair-title"
        className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-400"
      >
        Studio radio
      </h2>
      <div className="mt-4 min-h-28">{body}</div>
      <Link
        to="/shows"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-brand-300"
      >
        Full schedule
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </aside>
  );
}

/**
 * One headline service from each category, priced exactly as the catalogue
 * states. This is a teaser: while it loads or if it fails it stays out of the
 * way, and the Services page reports the problem in full.
 */
function FeaturedServices() {
  const { data, isError } = useQuery({
    queryKey: ['catalogue', 'services'],
    queryFn: fetchServiceCatalogue,
  });

  const services = (data ?? []).flatMap((category) => category.services.slice(0, 1)).slice(0, 3);
  if (isError || services.length === 0) return null;

  return (
    <section className="bg-ink-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
              Book the studio
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase text-ink-950">
              Popular services
            </h2>
          </div>
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            All services &amp; pricing
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <li key={service.slug} className="flex">
              <FeaturedServiceCard service={service} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeaturedServiceCard({ service }: { service: PublicService }) {
  const titleId = `featured-${service.slug}-title`;
  const priceVaries =
    new Set([
      ...service.rooms.map((room) => room.priceCents),
      ...service.packages.map((pkg) => pkg.priceCents),
    ]).size > 1;

  return (
    <article
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-card border-t-4 border-brand-600 bg-white p-6 shadow-sm"
    >
      <h3 id={titleId} className="text-2xl font-bold uppercase text-ink-950">
        {service.name}
      </h3>
      {service.description && <p className="mt-2 text-sm text-ink-600">{service.description}</p>}
      <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-5">
        {priceVaries && <span className="text-sm text-ink-500">From</span>}
        <span className="text-2xl font-semibold text-ink-950">
          {shillings(service.fromPriceCents)}
        </span>
        <span className="text-sm text-ink-500">{PRICING_MODEL_UNIT[service.pricingModel]}</span>
      </p>
    </article>
  );
}
