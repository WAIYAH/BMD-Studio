import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { GalleryDetailPage } from '@/pages/GalleryDetailPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { HomePage } from '@/pages/HomePage';
import { LivePage } from '@/pages/LivePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ShowsPage } from '@/pages/ShowsPage';

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
        <Route path="services" element={<ServicesPage />} />
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
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="shows" element={<ShowsPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="gallery/:slug" element={<GalleryDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
