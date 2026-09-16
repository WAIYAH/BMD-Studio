import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import { AccountLayout } from '@/layouts/AccountLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AccountBookingDetailPage } from '@/pages/account/AccountBookingDetailPage';
import { AccountBookingReschedulePage } from '@/pages/account/AccountBookingReschedulePage';
import { AccountBookingsPage } from '@/pages/account/AccountBookingsPage';
import { AccountDeliverablesPage } from '@/pages/account/AccountDeliverablesPage';
import { AccountNotificationsPage } from '@/pages/account/AccountNotificationsPage';
import { AccountOverviewPage } from '@/pages/account/AccountOverviewPage';
import { AccountPaymentsPage } from '@/pages/account/AccountPaymentsPage';
import { AccountRentalDetailPage } from '@/pages/account/AccountRentalDetailPage';
import { AccountRentalsPage } from '@/pages/account/AccountRentalsPage';
import { AccountSettingsPage } from '@/pages/account/AccountSettingsPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { BookPage } from '@/pages/BookPage';
import { BookingTermsPage } from '@/pages/BookingTermsPage';
import { CookiePolicyPage } from '@/pages/CookiePolicyPage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { HirePage } from '@/pages/HirePage';
import { GalleryDetailPage } from '@/pages/GalleryDetailPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { HomePage } from '@/pages/HomePage';
import { LivePage } from '@/pages/LivePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ShowsPage } from '@/pages/ShowsPage';
import { TermsPage } from '@/pages/TermsPage';
import { VisitPage } from '@/pages/VisitPage';

/**
 * Route table: the public site, sign-in and sign-up, and the signed-in
 * customer area. Staff routes arrive with the admin dashboard.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route
        path="account"
        element={
          <RequireAuth>
            <AccountLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AccountOverviewPage />} />
        <Route path="bookings" element={<AccountBookingsPage />} />
        <Route path="bookings/:id" element={<AccountBookingDetailPage />} />
        <Route path="bookings/:id/reschedule" element={<AccountBookingReschedulePage />} />
        <Route path="rentals" element={<AccountRentalsPage />} />
        <Route path="rentals/:id" element={<AccountRentalDetailPage />} />
        <Route path="payments" element={<AccountPaymentsPage />} />
        <Route path="deliverables" element={<AccountDeliverablesPage />} />
        <Route path="notifications" element={<AccountNotificationsPage />} />
        <Route path="settings" element={<AccountSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="hire" element={<HirePage />} />
        <Route path="shows" element={<ShowsPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="gallery/:slug" element={<GalleryDetailPage />} />
        <Route path="visit" element={<VisitPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="cookies" element={<CookiePolicyPage />} />
        <Route path="booking-terms" element={<BookingTermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
