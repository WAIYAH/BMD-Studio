import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PASSWORD_MIN_LENGTH, registerSchema } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { CheckboxField, FormAlert, PasswordField, TextField } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { safeRedirect, zodFieldErrors } from '@/lib/forms';
import { usePageTitle } from '@/lib/page-title';

const linkClass = 'font-semibold text-brand-600 transition-colors hover:text-brand-700';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  acceptTerms: boolean;
}

const EMPTY: RegisterForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  acceptTerms: false,
};

export function RegisterPage() {
  usePageTitle('Create an account');
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeRedirect((location.state as { from?: unknown } | null)?.from);

  const [values, setValues] = useState<RegisterForm>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update =
    (field: Exclude<keyof RegisterForm, 'acceptTerms'>) => (event: ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signUp(parsed.data);
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
      <h1 className="font-display text-4xl font-bold uppercase text-ink-950">Create an account</h1>
      <p className="mt-2 text-ink-600">
        One account for your studio sessions, equipment hire, payments and deliverables.
      </p>

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="First name"
            autoComplete="given-name"
            value={values.firstName}
            onChange={update('firstName')}
            error={errors.firstName}
          />
          <TextField
            label="Last name"
            autoComplete="family-name"
            value={values.lastName}
            onChange={update('lastName')}
            error={errors.lastName}
          />
        </div>
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
        />
        <TextField
          label="Mobile number"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={update('phone')}
          error={errors.phone}
          hint="Optional. A Kenyan mobile number, e.g. 0722 000 000."
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, including a letter and a number.`}
        />
        <CheckboxField
          checked={values.acceptTerms}
          onChange={(event) =>
            setValues((current) => ({ ...current, acceptTerms: event.target.checked }))
          }
          error={errors.acceptTerms}
          label={
            <>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Privacy Policy
              </Link>
              .
            </>
          }
        />

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" state={location.state as unknown} className={linkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}
