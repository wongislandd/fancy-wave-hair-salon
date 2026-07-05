import type {
  AppointmentConfirmation,
  BookingRequest,
  ManageableBooking
} from "./types";

export type RpcClient = {
  rpc: (name: string, params?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export async function createAppointment(
  client: RpcClient,
  request: BookingRequest
): Promise<AppointmentConfirmation> {
  const { data, error } = await client.rpc("create_appointment", {
    p_service_id: request.serviceId,
    p_stylist_id: request.stylistId,
    p_starts_at: request.startsAt,
    p_customer_name: request.customerName,
    p_customer_email: request.customerEmail,
    p_customer_phone: request.customerPhone,
    p_notes: request.notes?.trim() ? request.notes.trim() : null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data) as Record<string, string>;

  return {
    appointmentId: row.appointment_id,
    bookingReference: row.booking_reference,
    managementToken: row.management_token,
    startsAt: row.starts_at,
    endsAt: row.ends_at
  };
}

export async function getBookingByToken(
  client: RpcClient,
  token: string
): Promise<ManageableBooking | null> {
  const { data, error } = await client.rpc("get_booking_by_token", {
    p_token: token
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRow(data) as Record<string, unknown> | null;

  if (!row) {
    return null;
  }

  return {
    bookingReference: String(row.booking_reference),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name),
    serviceNameZh: row.service_name_zh ? String(row.service_name_zh) : null,
    serviceDurationMinutes: Number(row.service_duration_minutes),
    servicePriceCents: Number(row.service_price_cents),
    servicePriceMaxCents:
      row.service_price_max_cents === null || row.service_price_max_cents === undefined
        ? null
        : Number(row.service_price_max_cents),
    servicePriceIsStartingAt: Boolean(row.service_price_is_starting_at),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    stylistId: String(row.stylist_id),
    stylistName: String(row.stylist_name),
    notes: row.notes ? String(row.notes) : null,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status as ManageableBooking["status"],
    canManageOnline: Boolean(row.can_manage_online)
  };
}

export async function rescheduleBookingByToken(
  client: RpcClient,
  token: string,
  newStartsAt: string
): Promise<void> {
  const { error } = await client.rpc("reschedule_booking_by_token", {
    p_token: token,
    p_new_starts_at: newStartsAt
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelBookingByToken(
  client: RpcClient,
  token: string
): Promise<void> {
  const { error } = await client.rpc("cancel_booking_by_token", {
    p_token: token
  });

  if (error) {
    throw new Error(error.message);
  }
}

function firstRow(data: unknown): unknown | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}
