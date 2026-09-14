import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocationDisplay, authValue, renderWithProviders } from '@/test/render';
import { GuestOnly, RequireAuth } from './guards';

function renderProtected(auth: ReturnType<typeof authValue>, route: string) {
  renderWithProviders(
    <Routes>
      <Route
        path="/account/*"
        element={
          <RequireAuth>
            <p>Account content</p>
          </RequireAuth>
        }
      />
      <Route path="/login" element={<LocationDisplay />} />
    </Routes>,
    { auth, route },
  );
}

describe('RequireAuth', () => {
  it('sends a signed-out visitor to sign in, remembering where they were going', () => {
    renderProtected(authValue({ status: 'anonymous', user: null }), '/account/bookings?scope=past');

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/login|{"from":"/account/bookings?scope=past"}',
    );
    expect(screen.queryByText('Account content')).not.toBeInTheDocument();
  });

  it('waits while the stored session is being checked', () => {
    renderProtected(authValue({ status: 'loading', user: null }), '/account');

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session…');
    expect(screen.queryByText('Account content')).not.toBeInTheDocument();
  });

  it('shows the page to a signed-in customer', () => {
    renderProtected(authValue(), '/account');

    expect(screen.getByText('Account content')).toBeInTheDocument();
  });
});

describe('GuestOnly', () => {
  it('sends a signed-in visitor on to their account', () => {
    renderWithProviders(
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<p>Sign-in form</p>} />
        </Route>
        <Route path="/account" element={<LocationDisplay />} />
      </Routes>,
      { route: '/login' },
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/account|null');
    expect(screen.queryByText('Sign-in form')).not.toBeInTheDocument();
  });
});
