import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationCategoryValue,
  type NotificationChannelValue,
  type NotificationPreference,
} from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ApiClientError } from '@/lib/api-client';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../api';
import { NOTIFICATION_CATEGORY_LABEL, NOTIFICATION_CHANNEL_LABEL } from '../labels';
import { SettingsCard } from './SettingsCard';

const PREFERENCES_QUERY_KEY = ['me', 'notification-preferences'] as const;

export function PreferencesSection() {
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: fetchNotificationPreferences,
  });
  // Unsaved edits; null means the stored preferences are shown as they are.
  const [draft, setDraft] = useState<NotificationPreference[] | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (stored) => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, stored);
      setDraft(null);
      setSaved(true);
    },
  });

  const current = draft ?? data ?? [];
  const isOn = (channel: NotificationChannelValue, category: NotificationCategoryValue) =>
    current.find((entry) => entry.channel === channel && entry.category === category)?.enabled ??
    false;

  function toggle(channel: NotificationChannelValue, category: NotificationCategoryValue) {
    setSaved(false);
    setDraft(
      current.map((entry) =>
        entry.channel === channel && entry.category === category
          ? { ...entry, enabled: !entry.enabled }
          : entry,
      ),
    );
  }

  return (
    <SettingsCard
      title="Notifications"
      description="Choose how the studio contacts you about each kind of message."
    >
      {isPending ? (
        <LoadingState label="Loading preferences…" />
      ) : error ? (
        <ErrorState
          title="Preferences could not be loaded"
          message={
            error instanceof ApiClientError ? error.message : 'Your preferences are unavailable.'
          }
          requestId={error instanceof ApiClientError ? error.requestId : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-ink-200">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Notification preferences by channel</caption>
              <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Message
                  </th>
                  {NOTIFICATION_CHANNELS.map((channel) => (
                    <th key={channel} scope="col" className="px-4 py-3 text-center font-semibold">
                      {NOTIFICATION_CHANNEL_LABEL[channel]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {NOTIFICATION_CATEGORIES.map((category) => {
                  const { label, description } = NOTIFICATION_CATEGORY_LABEL[category];
                  return (
                    <tr key={category}>
                      <th scope="row" className="px-4 py-3 font-normal">
                        <span className="block font-semibold text-ink-950">{label}</span>
                        <span className="block text-xs text-ink-500">{description}</span>
                      </th>
                      {NOTIFICATION_CHANNELS.map((channel) => (
                        <td key={channel} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="size-5 accent-brand-600"
                            checked={isOn(channel, category)}
                            onChange={() => toggle(channel, category)}
                            aria-label={`${label} by ${NOTIFICATION_CHANNEL_LABEL[channel]}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500">
            Email, SMS and WhatsApp delivery is still being connected. Your choices are saved now
            and apply as soon as each channel goes live.
          </p>
          {save.error && (
            <FormAlert>Your preferences could not be saved. Please try again.</FormAlert>
          )}
          {saved && <FormAlert tone="success">Preferences saved.</FormAlert>}
          <div className="flex justify-end">
            <Button
              onClick={() => save.mutate(current)}
              loading={save.isPending}
              disabled={draft === null}
            >
              Save preferences
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
