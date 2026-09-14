import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_MIN_LENGTH, passwordChangeSchema } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert, PasswordField } from '@/components/ui/Field';
import { ApiClientError } from '@/lib/api-client';
import { zodFieldErrors } from '@/lib/forms';
import { changePassword } from '../api';
import { SettingsCard } from './SettingsCard';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function PasswordSection() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setValues(EMPTY);
      setNotice({
        tone: 'success',
        message: 'Password changed. Any other devices have been signed out.',
      });
      void queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] });
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors);
        setNotice({ tone: 'error', message: error.message });
      } else {
        setNotice({ tone: 'error', message: 'Your password could not be changed.' });
      }
    },
  });

  const update = (field: keyof typeof EMPTY) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const parsed = passwordChangeSchema.safeParse(values);
    const nextErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
    if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = 'The new passwords do not match.';
    }
    setErrors(nextErrors);
    if (!parsed.success || Object.keys(nextErrors).length > 0) return;

    mutation.mutate(parsed.data);
  }

  return (
    <SettingsCard
      title="Password"
      description="Changing your password signs out every other device on your account."
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {notice && <FormAlert tone={notice.tone}>{notice.message}</FormAlert>}
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={update('currentPassword')}
          error={errors.currentPassword}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={update('newPassword')}
            error={errors.newPassword}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={update('confirmPassword')}
            error={errors.confirmPassword}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
