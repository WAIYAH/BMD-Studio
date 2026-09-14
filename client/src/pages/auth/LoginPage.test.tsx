import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { LocationDisplay, TEST_USER, authValue, renderWithProviders } from '@/test/render';
import { LoginPage } from './LoginPage';

function renderLogin(auth = authValue({ status: 'anonymous', user: null }), state?: unknown) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth, route: { pathname: '/login', state } },
  );
  return auth;
}

describe('LoginPage', () => {
  it('checks the form before sending anything', async () => {
    const auth = renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("shows the server's answer when the credentials are wrong", async () => {
    renderLogin(
      authValue({
        status: 'anonymous',
        user: null,
        signIn: vi.fn().mockRejectedValue(
          new ApiClientError('Email or password is incorrect.', {
            code: 'INVALID_CREDENTIALS',
            status: 401,
          }),
        ),
      }),
    );

    await userEvent.type(screen.getByLabelText('Email address'), 'wanjiku@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'not-the-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('signs in and returns the customer to the page they were trying to reach', async () => {
    const signIn = vi.fn().mockResolvedValue(TEST_USER);
    renderLogin(authValue({ status: 'anonymous', user: null, signIn }), {
      from: '/account/payments',
    });

    await userEvent.type(screen.getByLabelText('Email address'), ' Wanjiku@Example.test ');
    await userEvent.type(screen.getByLabelText('Password'), 'studio-pass-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByTestId('location')).toHaveTextContent('/account/payments');
    expect(signIn).toHaveBeenCalledWith({
      email: 'wanjiku@example.test',
      password: 'studio-pass-123',
    });
  });

  it('never redirects off the site, whatever the return address says', async () => {
    renderLogin(authValue({ status: 'anonymous', user: null }), { from: '//evil.example/steal' });

    await userEvent.type(screen.getByLabelText('Email address'), 'wanjiku@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'studio-pass-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/account\|/);
  });
});
