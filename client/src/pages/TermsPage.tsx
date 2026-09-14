import { Link } from 'react-router-dom';
import { LegalContact } from '@/features/legal/LegalContact';
import { LegalDocument, type LegalSection } from '@/features/legal/LegalDocument';
import { LEGAL_ENTITY } from '@/features/legal/entity';

const SECTIONS: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>
          These terms govern your use of this website, which is run by {LEGAL_ENTITY.name},{' '}
          {LEGAL_ENTITY.location}. By using the website you agree to them.
        </p>
        <p>
          Studio bookings and equipment hire are also covered by our{' '}
          <Link to="/booking-terms">Booking &amp; Hire Terms</Link>. How we handle personal data is
          explained in our <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <LegalContact />
      </>
    ),
  },
  {
    id: 'using-the-site',
    title: 'Using the website',
    body: (
      <>
        <p>You may use the website for lawful purposes only. You must not:</p>
        <ul>
          <li>try to get into parts of the website, accounts or systems you are not allowed to;</li>
          <li>disrupt the website, or overload it with automated requests;</li>
          <li>upload or send anything harmful, such as viruses or malicious code; or</li>
          <li>pretend to be someone else, or give false information.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <>
        <p>When customer accounts are available, if you create one you must:</p>
        <ul>
          <li>give accurate details and keep them up to date;</li>
          <li>
            keep your password secret, as you are responsible for activity on your account; and
          </li>
          <li>tell us straight away if you think someone else has used it.</li>
        </ul>
        <p>We may suspend or close an account that is used in breach of these terms.</p>
      </>
    ),
  },
  {
    id: 'information-and-prices',
    title: 'Information, prices and availability',
    body: (
      <>
        <p>
          We work to keep service details, prices and equipment availability on the website accurate
          and current. Prices are in Kenyan shillings. The final price, including VAT where it
          applies, is confirmed when you book.
        </p>
        <p>
          Equipment availability shows what is in the store at that moment and does not reserve it.
          Show schedules can change, and a livestream can be interrupted by events outside our
          control.
        </p>
        <p>
          If we find a mistake in a price or description, we will correct it before confirming a
          booking.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Our content and livestreams',
    body: (
      <>
        <p>
          The website’s text, logos, photographs, recordings, shows and livestreams belong to{' '}
          {LEGAL_ENTITY.name} or to the people who licensed them to us. You may view them for your
          own personal, non-commercial use.
        </p>
        <p>
          You may not copy, re-broadcast, record or republish them without our written permission.
          Streams played through YouTube or Facebook are also subject to those platforms’ own terms.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Content you give us',
    body: (
      <p>
        If you give us material — for example audio, video or images for a session — you confirm
        that you have the right to use it and the consent of anyone who appears in it. You keep
        ownership of it, and you allow us to use it to provide the service you asked for.
      </p>
    ),
  },
  {
    id: 'other-sites',
    title: 'Other websites',
    body: (
      <p>
        The website links to and embeds content from other services, such as YouTube, Facebook and
        Google Maps. We do not control those services and are not responsible for their content or
        how they handle your data.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability of the website',
    body: (
      <p>
        We aim to keep the website running, but we cannot promise it will always be available or
        free of errors. We may change, suspend or withdraw any part of it, for example for
        maintenance.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Our liability',
    body: (
      <>
        <p>
          Nothing in these terms limits or excludes liability that cannot be limited or excluded
          under Kenyan law, including your rights under the Consumer Protection Act, 2012, or
          liability for death or personal injury caused by negligence.
        </p>
        <p>
          Subject to that, we are not responsible for loss that could not reasonably have been
          foreseen, or for loss caused by events outside our reasonable control.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms from time to time. The date at the top of this page shows when
        they last changed. The version on the website when you use it is the one that applies.
      </p>
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

export function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Use"
      summary="The rules for using the B.M.D Studio website, its shows, livestreams and galleries."
      sections={SECTIONS}
    />
  );
}
