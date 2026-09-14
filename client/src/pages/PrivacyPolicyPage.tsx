import { Link } from 'react-router-dom';
import { LegalContact } from '@/features/legal/LegalContact';
import { LegalDocument, type LegalSection } from '@/features/legal/LegalDocument';
import { LEGAL_ENTITY } from '@/features/legal/entity';

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          {LEGAL_ENTITY.name} is a radio, podcast, photography, video and livestream production
          studio in {LEGAL_ENTITY.location}. We decide how and why your personal data is used, which
          makes us its data controller under Kenya’s Data Protection Act, 2019.
        </p>
        <p>For any question about this policy or your personal data, contact us:</p>
        <LegalContact />
      </>
    ),
  },
  {
    id: 'scope',
    title: 'What this policy covers',
    body: (
      <>
        <p>
          This policy covers personal data we handle when you use this website, watch our shows and
          livestreams, and when you book a studio session or hire equipment from us — whether
          online, by phone or in person.
        </p>
        <p>
          Some online services, such as customer accounts and online payments, are not available
          yet. Where a section below describes them, it applies from the day they open.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'Information we collect',
    body: (
      <>
        <p>
          <strong>When you browse the website.</strong> We do not use analytics or advertising
          trackers. Our servers keep technical logs of requests — your IP address, browser type, the
          page requested and the time — to run the site and keep it secure.
        </p>
        <p>
          <strong>When you have an account.</strong> Your name, email address, phone number and
          password. We never store the password itself, only a one-way scrambled version (a hash)
          that cannot be turned back into it. You may also add a profile photo.
        </p>
        <p>
          <strong>When you sign in.</strong> Each signed-in session records the IP address and
          browser it came from, so unfamiliar sign-ins can be spotted and ended.
        </p>
        <p>
          <strong>When you book or hire.</strong> The service, room, date and time you book, the
          equipment you hire, notes you give us, and the condition of equipment when it goes out and
          comes back.
        </p>
        <p>
          <strong>When you pay.</strong> The amount, the payment method, its status and the
          provider’s transaction reference — for M-Pesa, the phone number that paid. Card numbers
          are handled by the card payment provider; we never see or store a full card number.
        </p>
        <p>
          <strong>When we contact you.</strong> Messages we send you, and your choices about which
          messages you receive and how.
        </p>
        <p>
          <strong>Recordings and photographs.</strong> Sessions may be recorded or photographed as
          part of the service you book, and the results stored so we can deliver them. A livestream
          is broadcast publicly on the platforms chosen for it, and a published gallery can be seen
          by anyone, so people who appear in them can be seen by the public.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use it and why',
    body: (
      <>
        <p>We only use personal data where Kenyan data protection law allows it:</p>
        <ul>
          <li>
            <strong>To provide what you ask for</strong> — bookings, equipment hire, recordings,
            deliverables, receipts and messages about them. This is necessary to perform our
            agreement with you.
          </li>
          <li>
            <strong>To take payments and keep financial records</strong>, as tax and accounting law
            requires.
          </li>
          <li>
            <strong>To keep the website, accounts and bookings secure</strong> — preventing fraud,
            misuse and double bookings. This is in our legitimate interests and yours.
          </li>
          <li>
            <strong>To publish photographs or recordings of you</strong> only where you have agreed
            to it, or where it is the service you booked, such as a livestream.
          </li>
          <li>
            <strong>To send marketing</strong> only if you have agreed to receive it. You can
            withdraw that consent at any time.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>We do not sell personal data. We share it only with:</p>
        <ul>
          <li>
            <strong>Payment providers</strong> — Safaricom for M-Pesa payments, and a card payment
            provider for card payments.
          </li>
          <li>
            <strong>Messaging providers</strong> that deliver our emails, SMS and WhatsApp messages
            to you.
          </li>
          <li>
            <strong>Hosting and storage providers</strong> that run our servers, database and file
            storage.
          </li>
          <li>
            <strong>YouTube and Facebook</strong>, when we livestream on those platforms.
          </li>
          <li>
            <strong>Authorities</strong>, such as the Kenya Revenue Authority or a court, when the
            law requires it.
          </li>
        </ul>
        <p>
          Providers act on our instructions and may use your data only to provide their service to
          us.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Transfers outside Kenya',
    body: (
      <p>
        Some of our providers store or process data outside Kenya. We transfer personal data abroad
        only where the Data Protection Act allows — for example, where the destination offers
        adequate protection or appropriate safeguards are in place.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>We keep personal data only as long as we need it:</p>
        <ul>
          <li>Account details, for as long as your account is open.</li>
          <li>
            Booking, payment and invoice records, for as long as Kenyan tax and accounting law
            requires.
          </li>
          <li>Signed-in sessions expire automatically, and end immediately when you sign out.</li>
          <li>Technical and security logs, only as long as needed to run and secure the site.</li>
          <li>Recordings and photographs, for the delivery period agreed for your booking.</li>
        </ul>
        <p>When we no longer need data, we delete it or make it anonymous.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <>
        <ul>
          <li>Passwords are stored only as strong one-way hashes.</li>
          <li>
            Information travels between your browser and our servers over encrypted connections.
          </li>
          <li>
            Staff can see only the information their role needs, and sensitive actions are logged.
          </li>
        </ul>
        <p>
          If a data breach puts your personal data at risk, we will tell the Data Protection
          Commissioner and, where required, you.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the Data Protection Act, 2019 you have the right to:</p>
        <ul>
          <li>be told how your personal data is used;</li>
          <li>see the personal data we hold about you;</li>
          <li>have inaccurate or misleading data corrected;</li>
          <li>have data deleted when we no longer have a lawful reason to keep it;</li>
          <li>object to how we use your data, including for marketing;</li>
          <li>receive your data in a portable format; and</li>
          <li>withdraw consent you have given, at any time.</li>
        </ul>
        <p>
          To use any of these rights, contact us using the details in section 1. We may need to
          confirm your identity first, and we will respond without undue delay.
        </p>
        <p>
          If you are unhappy with how we handle your data, you can complain to the Office of the
          Data Protection Commissioner at{' '}
          <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">
            www.odpc.go.ke
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        A booking for anyone under 18 must be made by their parent or guardian. We process a child’s
        personal data — including recording, photographing or streaming them — only with the consent
        of their parent or guardian.
      </p>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <p>
        We use a single cookie, and only to keep you signed in. Our{' '}
        <Link to="/cookies">Cookie Policy</Link> explains it, along with the content from YouTube,
        Facebook and Google that some pages load.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        When we change this policy we update the date at the top of this page. If a change
        significantly affects how we use your data, we will also tell you directly when we can.
      </p>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="What personal data B.M.D Studio collects, why, who it is shared with, and the rights you have over it."
      sections={SECTIONS}
    />
  );
}
