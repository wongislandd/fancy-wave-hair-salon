export type AppointmentStatus = "confirmed" | "cancelled" | "completed";

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
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

export interface Appointment {
  id: string;
  bookingReference: string;
  serviceId: string;
  serviceNameSnapshot: string;
  serviceDurationMinutesSnapshot: number;
  servicePriceCentsSnapshot: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
  label: string;
}

export interface ManageableBooking {
  bookingReference: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceCents: number;
  customerName: string;
  customerEmail: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
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
