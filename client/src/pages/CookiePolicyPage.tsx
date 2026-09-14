import { Link } from 'react-router-dom';
import { LegalDocument, type LegalSection } from '@/features/legal/LegalDocument';

const SECTIONS: LegalSection[] = [
  {
    id: 'what-cookies-are',
    title: 'What cookies are',
    body: (
      <p>
        Cookies are small text files a website stores in your browser so it can recognise that
        browser on a later request — for example, to keep you signed in as you move between pages.
      </p>
    ),
  },
  {
    id: 'our-cookie',
    title: 'The cookie we use',
    body: (
      <>
        <p>We set one cookie, and only when you sign in:</p>
        <div className="overflow-x-auto rounded-card border border-ink-200">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-ink-950 text-white">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Purpose
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  How long
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="px-4 py-3 font-mono text-ink-950">bmd_rt</td>
                <td className="px-4 py-3">
                  Keeps you signed in securely. Scripts on the page cannot read it, and your browser
                  sends it only to our sign-in service.
                </td>
                <td className="px-4 py-3">Strictly necessary</td>
                <td className="px-4 py-3">Until you sign out or your sign-in session expires</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We use no analytics or advertising cookies, and we do not store anything else in your
          browser.
        </p>
      </>
    ),
  },
  {
    id: 'other-services',
    title: 'Content from other services',
    body: (
      <>
        <p>Some pages load content from other companies, which have their own policies:</p>
        <ul>
          <li>
            <strong>YouTube and Facebook.</strong> While a livestream is on, the{' '}
            <Link to="/live">Live</Link> page shows the platform’s video player. Loading it lets
            YouTube or Facebook set their own cookies and receive information about your visit. See{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google’s privacy policy
            </a>{' '}
            and{' '}
            <a
              href="https://www.facebook.com/privacy/policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta’s privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Google Fonts.</strong> Our fonts are downloaded from Google when a page loads,
            so Google receives your IP address. Google Fonts does not set cookies.
          </li>
          <li>
            <strong>Google Maps.</strong> The <Link to="/visit">Visit us</Link> page links to Google
            Maps. Nothing is loaded from Google Maps unless you follow that link.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'managing',
    title: 'Managing cookies',
    body: (
      <>
        <p>
          You can block or delete cookies in your browser settings. If you block our sign-in cookie
          you can still browse the website, but you will not be able to stay signed in.
        </p>
        <p>
          Because the only cookie we set is needed to keep you signed in, there are no optional
          cookies to accept or refuse. If we ever want to use optional cookies, we will ask for your
          consent first and update this policy.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        When we change this policy we update the date at the top of this page. Our{' '}
        <Link to="/privacy">Privacy Policy</Link> explains how we handle personal data more
        generally.
      </p>
    ),
  },
];

export function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      summary="The one cookie B.M.D Studio sets, and the content from other services some pages load."
      sections={SECTIONS}
    />
  );
}
