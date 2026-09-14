import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert, PasswordField, TextField } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { safeRedirect, zodFieldErrors } from '@/lib/forms';
import { usePageTitle } from '@/lib/page-title';

const linkClass = 'font-semibold text-brand-600 transition-colors hover:text-brand-700';

export function LoginPage() {
  usePageTitle('Sign in');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeRedirect((location.state as { from?: unknown } | null)?.from);

  const [values, setValues] = useState<LoginInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data);
      navigate(from, { replace: true });
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase text-ink-950">Sign in</h1>
      <p className="mt-2 text-ink-600">
        Welcome back. Sign in to see your bookings, payments and deliverables.
      </p>

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          error={errors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) =>
            setValues((current) => ({ ...current, password: event.target.value }))
          }
          error={errors.password}
        />

        <p className="text-sm text-ink-600">
          Forgotten your password?{' '}
          <Link to="/visit" className={linkClass}>
            Contact the studio
          </Link>{' '}
          and we will help you back in.
        </p>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-600">
        New to B.M.D Studio?{' '}
        <Link to="/register" state={location.state as unknown} className={linkClass}>
          Create an account
        </Link>
      </p>
    </>
  );
}
