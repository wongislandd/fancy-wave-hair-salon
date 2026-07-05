import type { RpcClient } from "./booking-api";
import type { AppointmentConfirmation } from "./types";

export type SaveStylistProfileRequest = {
  id?: string;
  name: string;
  bioEn: string;
  bioZh: string;
  specialtiesEn: string[];
  specialtiesZh: string[];
  serviceIds: string[];
  isActive: boolean;
};

export type StaffAppointmentRequest = {
  serviceId: string;
  stylistId: string;
  startsAt: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string | null;
  internalNotes?: string | null;
};

export type StaffAppointmentMoveResult = {
  appointmentId: string;
  bookingReference: string;
  recipientEmail: string;
  startsAt: string;
  endsAt: string;
};

export async function saveStylistProfile(
  client: RpcClient,
  request: SaveStylistProfileRequest
): Promise<string> {
  const { data, error } = await client.rpc("save_stylist_profile", {
    p_stylist_id: request.id ?? null,
    p_name: request.name,
    p_bio_en: request.bioEn,
    p_bio_zh: request.bioZh,
    p_specialties_en: request.specialtiesEn,
    p_specialties_zh: request.specialtiesZh,
    p_service_ids: request.serviceIds,
    p_is_active: request.isActive
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return String((row as Record<string, unknown>).stylist_id);
}

export async function createStaffAppointment(
  client: RpcClient,
  request: StaffAppointmentRequest
): Promise<AppointmentConfirmation> {
  const { data, error } = await client.rpc("create_staff_appointment", {
    p_service_id: request.serviceId,
    p_stylist_id: request.stylistId,
    p_starts_at: request.startsAt,
    p_customer_name: request.customerName,
    p_customer_email: request.customerEmail?.trim() ?? "",
    p_customer_phone: request.customerPhone?.trim() ?? "",
    p_notes: request.notes?.trim() ? request.notes.trim() : null,
    p_internal_notes: request.internalNotes?.trim() ? request.internalNotes.trim() : null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const values = row as Record<string, string>;

  return {
    appointmentId: values.appointment_id,
    bookingReference: values.booking_reference,
    managementToken: values.management_token,
    startsAt: values.starts_at,
    endsAt: values.ends_at
  };
}

export async function rescheduleStaffAppointment(
  client: RpcClient,
  appointmentId: string,
  newStartsAt: string
): Promise<StaffAppointmentMoveResult> {
  const { data, error } = await client.rpc("reschedule_staff_appointment", {
    p_appointment_id: appointmentId,
    p_new_starts_at: newStartsAt
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const values = row as Record<string, string | null>;

  return {
    appointmentId: String(values.appointment_id),
    bookingReference: String(values.booking_reference),
    recipientEmail: String(values.recipient_email ?? ""),
    startsAt: String(values.starts_at),
    endsAt: String(values.ends_at)
  };
}
