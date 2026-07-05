export type AppointmentStatus = "confirmed" | "cancelled" | "completed";

export interface Service {
  id: string;
  nameEn?: string;
  nameZh?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  priceMaxCents?: number | null;
  priceIsStartingAt?: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface Stylist {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  serviceIds: string[];
  isActive: boolean;
  displayOrder: number;
}

export interface BusinessHour {
  id: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface StylistHour {
  id: string;
  stylistId: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  usesSalonHours: boolean;
}

export interface Appointment {
  id: string;
  bookingReference: string;
  serviceId: string;
  serviceNameSnapshot: string;
  serviceNameZhSnapshot?: string | null;
  serviceDurationMinutesSnapshot: number;
  servicePriceCentsSnapshot: number;
  servicePriceMaxCentsSnapshot?: number | null;
  servicePriceIsStartingAtSnapshot?: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  stylistId: string;
  stylistNameSnapshot: string;
  notes?: string | null;
  internalNotes?: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryPhoto {
  id: string;
  storagePath: string;
  imageUrl: string;
  altText: string;
  altTextEn?: string;
  altTextZh?: string;
  caption?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
  label: string;
  stylistId: string;
  stylistName: string;
}

export interface ManageableBooking {
  bookingReference: string;
  serviceId: string;
  serviceName: string;
  serviceNameZh?: string | null;
  serviceDurationMinutes: number;
  servicePriceCents: number;
  servicePriceMaxCents?: number | null;
  servicePriceIsStartingAt?: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  stylistId: string;
  stylistName: string;
  notes?: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  canManageOnline: boolean;
}

export interface AppointmentConfirmation {
  appointmentId: string;
  bookingReference: string;
  managementToken: string;
  startsAt: string;
  endsAt: string;
}

export interface BookingRequest {
  serviceId: string;
  stylistId: string;
  startsAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string | null;
}

export interface SalonSettings {
  salonName: string;
  timezone: string;
  slotIntervalMinutes: number;
  minBookingNoticeMinutes: number;
  cancellationCutoffMinutes: number;
}
