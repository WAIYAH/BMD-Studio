import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { DevicesSection } from '@/features/account/settings/DevicesSection';
import { PasswordSection } from '@/features/account/settings/PasswordSection';
import { PreferencesSection } from '@/features/account/settings/PreferencesSection';
import { ProfileSection } from '@/features/account/settings/ProfileSection';

export function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Profile & security"
        description="Your details, password, signed-in devices and how the studio contacts you."
      />
      <ProfileSection />
      <PasswordSection />
      <DevicesSection />
      <PreferencesSection />
    </div>
  );
}
