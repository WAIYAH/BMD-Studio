import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatKenyanPhone, profileUpdateSchema } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert, TextField } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';
import { zodFieldErrors } from '@/lib/forms';
import { updateProfile } from '../api';
import { SettingsCard } from './SettingsCard';

interface Notice {
  tone: 'error' | 'success';
  message: string;
}

export function ProfileSection() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ? formatKenyanPhone(user.phone) : '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      setNotice({ tone: 'success', message: 'Profile saved.' });
      void queryClient.invalidateQueries({ queryKey: ['me', 'dashboard'] });
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors);
        setNotice({ tone: 'error', message: error.message });
      } else {
        setNotice({ tone: 'error', message: 'Your profile could not be saved.' });
      }
    },
  });

  const update = (field: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = profileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <SettingsCard
      title="Profile"
      description="Your name and mobile number, as the studio sees them."
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {notice && <FormAlert tone={notice.tone}>{notice.message}</FormAlert>}
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
          value={user?.email ?? ''}
          disabled
          hint="To change your email address, contact the studio."
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
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
