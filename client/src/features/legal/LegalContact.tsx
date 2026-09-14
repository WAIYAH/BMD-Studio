import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchStudios } from '@/features/studio/api';
import { LEGAL_ENTITY } from './entity';

/**
 * How to reach the business about a legal or privacy matter. It shows only the
 * contact details the studio has actually published; until an email or phone
 * number is published it directs people to the studio itself, never to an
 * address that does not exist.
 */
export function LegalContact() {
  const { data } = useQuery({ queryKey: ['studios'], queryFn: fetchStudios });
  const studio = data?.[0];
  const email = studio?.email ?? null;
  const phone = studio?.phone ?? null;
  const address = studio?.addressLine
    ? `${studio.addressLine}, ${LEGAL_ENTITY.location}`
    : LEGAL_ENTITY.location;

  return (
    <div className="rounded-card border border-ink-200 bg-ink-50 p-5">
      <p className="font-display text-xl font-bold uppercase text-ink-950">{LEGAL_ENTITY.name}</p>
      <p className="text-sm text-ink-700">{address}</p>

      {email || phone ? (
        <dl className="mt-3 space-y-1 text-sm">
          {email && (
            <div className="flex gap-2">
              <dt className="text-ink-500">Email</dt>
              <dd>
                <a href={`mailto:${email}`}>{email}</a>
              </dd>
            </div>
          )}
          {phone && (
            <div className="flex gap-2">
              <dt className="text-ink-500">Phone</dt>
              <dd>
                <a href={`tel:${phone}`}>{phone}</a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-ink-700">
          Speak to us in person at the studio during opening hours. Our hours and location are on
          the <Link to="/visit">Visit us</Link> page.
        </p>
      )}
    </div>
  );
}
