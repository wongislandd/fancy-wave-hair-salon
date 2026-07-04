import { addDays, format } from "date-fns";
import {
  cancelBookingByToken,
  createAppointment,
  getBookingByToken,
  rescheduleBookingByToken
} from "./booking-api";
import { deriveAvailableSlots } from "./booking";
import {
  demoAppointments,
  demoBusinessHours,
  demoServices,
  demoSettings,
  demoTokenLookup
} from "./demo-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { RpcClient } from "./booking-api";
import type {
  Appointment,
  AppointmentConfirmation,
  AvailableSlot,
  BookingRequest,
  BusinessHour,
  ManageableBooking,
  Service
} from "./types";

export async function listPublicServices(): Promise<Service[]> {
  if (!supabase) {
    return demoServices.filter((service) => service.isActive);
  }

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapService);
}

export async function listAdminServices(): Promise<Service[]> {
  if (!supabase) return [...demoServices].sort((a, b) => a.displayOrder - b.displayOrder);

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapService);
}

export async function listAdminAppointments(): Promise<Appointment[]> {
  if (!supabase) return [...demoAppointments].sort(byStartsAt);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAppointment);
}

export async function listBusinessHours(): Promise<BusinessHour[]> {
  if (!supabase) return [...demoBusinessHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .order("day_of_week");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBusinessHour);
}

export async function getAvailableSlots(
  service: Service,
  date: string
): Promise<AvailableSlot[]> {
  if (!supabase) {
    return deriveAvailableSlots({
      date,
      service,
      businessHours: demoBusinessHours,
      existingAppointments: demoAppointments,
      salonTimeZone: demoSettings.timezone,
      slotIntervalMinutes: demoSettings.slotIntervalMinutes,
      now: new Date()
    });
  }

  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: service.id,
    p_date: date
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    starts_at: string;
    ends_at: string;
    label: string;
  }>;
  return rows.map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    label: row.label
  }));
}

export async function bookAppointment(
  request: BookingRequest
): Promise<AppointmentConfirmation> {
  if (!supabase) {
    const service = demoServices.find((item) => item.id === request.serviceId);
    if (!service) throw new Error("Service not found");

    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const startsAt = request.startsAt;
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.durationMinutes * 60_000
    ).toISOString();

    demoAppointments.push({
      id,
      bookingReference: `FW-${id.slice(0, 6).toUpperCase()}`,
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      serviceDurationMinutesSnapshot: service.durationMinutes,
      servicePriceCentsSnapshot: service.priceCents,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
      startsAt,
      endsAt,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    demoTokenLookup.set(token, id);

    return {
      appointmentId: id,
      bookingReference: `FW-${id.slice(0, 6).toUpperCase()}`,
      managementToken: token,
      startsAt,
      endsAt
    };
  }

  return createAppointment(asRpcClient(), request);
}

export async function loadBookingByToken(
  token: string
): Promise<ManageableBooking | null> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) return null;
    return {
      bookingReference: appointment.bookingReference,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceNameSnapshot,
      serviceDurationMinutes: appointment.serviceDurationMinutesSnapshot,
      servicePriceCents: appointment.servicePriceCentsSnapshot,
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status
    };
  }

  return getBookingByToken(asRpcClient(), token);
}

export async function saveService(
  values: {
    name: string;
    description: string;
    durationMinutes: number;
    priceDollars: number;
    isActive: boolean;
  },
  existingId?: string
): Promise<void> {
  const payload = {
    name: values.name,
    description: values.description,
    duration_minutes: values.durationMinutes,
    price_cents: Math.round(values.priceDollars * 100),
    is_active: values.isActive,
    display_order: demoServices.length + 1
  };

  if (!supabase) {
    if (existingId) {
      const service = demoServices.find((item) => item.id === existingId);
      if (!service) return;
      service.name = values.name;
      service.description = values.description;
      service.durationMinutes = values.durationMinutes;
      service.priceCents = Math.round(values.priceDollars * 100);
      service.isActive = values.isActive;
    } else {
      demoServices.push({
        id: crypto.randomUUID(),
        name: values.name,
        description: values.description,
        durationMinutes: values.durationMinutes,
        priceCents: Math.round(values.priceDollars * 100),
        isActive: values.isActive,
        displayOrder: demoServices.length + 1
      });
    }
    return;
  }

  const query = existingId
    ? supabase.from("services").update(payload).eq("id", existingId)
    : supabase.from("services").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function updateBusinessHour(
  hour: BusinessHour,
  patch: Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed">
): Promise<void> {
  if (!supabase) {
    const target = demoBusinessHours.find((item) => item.id === hour.id);
    if (target) Object.assign(target, patch);
    return;
  }

  const { error } = await supabase
    .from("business_hours")
    .update({
      opens_at: patch.opensAt,
      closes_at: patch.closesAt,
      is_closed: patch.isClosed
    })
    .eq("id", hour.id);
  if (error) throw new Error(error.message);
}

export async function cancelAppointmentAsStaff(id: string): Promise<void> {
  if (!supabase) {
    const appointment = demoAppointments.find((item) => item.id === id);
    if (appointment) {
      appointment.status = "cancelled";
      appointment.cancelledAt = new Date().toISOString();
      appointment.updatedAt = new Date().toISOString();
    }
    return;
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: "Cancelled by staff"
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function rescheduleManagedBooking(
  token: string,
  newStartsAt: string
): Promise<void> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) throw new Error("Booking not found");
    appointment.startsAt = newStartsAt;
    appointment.endsAt = new Date(
      new Date(newStartsAt).getTime() +
        appointment.serviceDurationMinutesSnapshot * 60_000
    ).toISOString();
    appointment.updatedAt = new Date().toISOString();
    return;
  }

  return rescheduleBookingByToken(asRpcClient(), token, newStartsAt);
}

export async function cancelManagedBooking(token: string): Promise<void> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) throw new Error("Booking not found");
    appointment.status = "cancelled";
    appointment.cancelledAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    return;
  }

  return cancelBookingByToken(asRpcClient(), token);
}

export async function signInStaff(email: string, password: string): Promise<void> {
  if (!supabase) {
    if (email !== "staff@fancywave.test" || password !== "demo1234") {
      throw new Error("Use staff@fancywave.test / demo1234 in demo mode.");
    }
    sessionStorage.setItem("fancy-wave-demo-staff", "true");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutStaff(): Promise<void> {
  if (!supabase) {
    sessionStorage.removeItem("fancy-wave-demo-staff");
    return;
  }
  await supabase.auth.signOut();
}

export async function isStaffSignedIn(): Promise<boolean> {
  if (!supabase) {
    return sessionStorage.getItem("fancy-wave-demo-staff") === "true";
  }
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export function nextBookableDates(count = 10): string[] {
  return Array.from({ length: count }, (_, index) =>
    format(addDays(new Date(), index + 1), "yyyy-MM-dd")
  );
}

export function backendModeLabel(): string {
  return isSupabaseConfigured ? "Supabase connected" : "Demo data mode";
}

function mapService(row: Record<string, unknown>): Service {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    durationMinutes: Number(row.duration_minutes),
    priceCents: Number(row.price_cents),
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order)
  };
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    bookingReference: String(row.booking_reference),
    serviceId: String(row.service_id),
    serviceNameSnapshot: String(row.service_name_snapshot),
    serviceDurationMinutesSnapshot: Number(row.service_duration_minutes_snapshot),
    servicePriceCentsSnapshot: Number(row.service_price_cents_snapshot),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status as Appointment["status"],
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    cancelledReason: row.cancelled_reason ? String(row.cancelled_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapBusinessHour(row: Record<string, unknown>): BusinessHour {
  return {
    id: String(row.id),
    dayOfWeek: Number(row.day_of_week),
    opensAt: String(row.opens_at).slice(0, 5),
    closesAt: String(row.closes_at).slice(0, 5),
    isClosed: Boolean(row.is_closed)
  };
}

function byStartsAt(a: Appointment, b: Appointment): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function asRpcClient(): RpcClient {
  const client = supabase;
  if (!client) {
    throw new Error("Supabase is not configured");
  }

  return {
    rpc: async (name, params) => {
      const { data, error } = await client.rpc(name, params);
      return { data, error };
    }
  };
}
