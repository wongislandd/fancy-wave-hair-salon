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

  const row = firstRow(data) as Record<string, string | number> | null;

  if (!row) {
    return null;
  }

  return {
    bookingReference: String(row.booking_reference),
    serviceId: String(row.service_id),
    serviceName: String(row.service_name),
    serviceDurationMinutes: Number(row.service_duration_minutes),
    servicePriceCents: Number(row.service_price_cents),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status as ManageableBooking["status"]
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
