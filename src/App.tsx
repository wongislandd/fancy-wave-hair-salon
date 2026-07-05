import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AdminAppointmentsPage } from "./pages/AdminAppointmentsPage";
import { AdminCalendarPage } from "./pages/AdminCalendarPage";
import { AdminGalleryPage } from "./pages/AdminGalleryPage";
import { AdminHoursPage } from "./pages/AdminHoursPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminServicesPage } from "./pages/AdminServicesPage";
import { AdminStylistsPage } from "./pages/AdminStylistsPage";
import { BookingPage } from "./pages/BookingPage";
import { LandingPage } from "./pages/LandingPage";
import { ManageBookingPage } from "./pages/ManageBookingPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/booking-confirmed/:token" element={<ManageBookingPage confirmed />} />
        <Route path="/manage-booking/:token" element={<ManageBookingPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminAppointmentsPage />} />
        <Route path="/admin/calendar" element={<AdminCalendarPage />} />
        <Route path="/admin/services" element={<AdminServicesPage />} />
        <Route path="/admin/stylists" element={<AdminStylistsPage />} />
        <Route path="/admin/hours" element={<AdminHoursPage />} />
        <Route path="/admin/gallery" element={<AdminGalleryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
