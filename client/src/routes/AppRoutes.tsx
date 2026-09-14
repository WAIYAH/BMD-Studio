import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { BookPage } from '@/pages/BookPage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { GalleryDetailPage } from '@/pages/GalleryDetailPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { HomePage } from '@/pages/HomePage';
import { LivePage } from '@/pages/LivePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ShowsPage } from '@/pages/ShowsPage';
import { VisitPage } from '@/pages/VisitPage';

/**
 * Route table. The public site is complete; authenticated customer and staff
 * route trees are added in Phase 3 behind a route guard.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="visit" element={<VisitPage />} />
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
