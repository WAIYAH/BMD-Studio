import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

/**
 * Route table. Public routes exist now; authenticated customer and staff route
 * trees are added in Phase 3 behind a route guard, and each placeholder below is
 * replaced by its module as the corresponding phase lands.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="services"
          element={
            <PlaceholderPage
              title="Services & pricing"
              phase="Phase 4"
              summary="The service catalogue is configured by studio staff, so this page is built once studio and service management exists."
            />
          }
        />
        <Route
          path="book"
          element={
            <PlaceholderPage
              title="Book a session"
              phase="Phase 5"
              summary="Booking requires the availability engine and server-side conflict prevention. It is built once those are in place, never before."
            />
          }
        />
        <Route
          path="equipment"
          element={
            <PlaceholderPage
              title="Equipment hire"
              phase="Phase 6"
              summary="Equipment browsing and rental requests arrive with the inventory module."
            />
          }
        />
        <Route
          path="shows"
          element={
            <PlaceholderPage
              title="Shows & schedule"
              phase="Phase 7"
              summary="The programme schedule is generated from real show recurrence rules."
            />
          }
        />
        <Route
          path="live"
          element={
            <PlaceholderPage
              title="Live"
              phase="Phase 8"
              summary="The live page shows genuine ON AIR state and a real stream from the configured provider. Until the streaming integration is connected, no live indicator is shown at all."
            />
          }
        />
        <Route
          path="gallery"
          element={
            <PlaceholderPage
              title="Gallery & portfolio"
              phase="Phase 9"
              summary="Galleries are served from object storage once the media module is built."
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
