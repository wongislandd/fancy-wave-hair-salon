import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookingRequest } from "./types";

const bookingRequest: BookingRequest = {
  serviceId: "service-1",
  stylistId: "stylist-1",
  startsAt: "2026-07-06T14:00:00.000Z",
  customerName: "Maya Chen",
  customerEmail: "maya@example.com",
  customerPhone: "2125550101",
  notes: "Soft layers"
};

describe("live booking email notifications", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./supabase");
  });

  it("asks the Edge Function to send a confirmation after a live booking", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          appointment_id: "appt-1",
          booking_reference: "FW-123ABC",
          management_token: "manage-token",
          starts_at: "2026-07-06T14:00:00.000Z",
          ends_at: "2026-07-06T15:00:00.000Z"
        }
      ],
      error: null
    });
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { rpc, functions: { invoke } }
    }));

    const { bookAppointment } = await import("./data");

    const confirmation = await bookAppointment(bookingRequest);

    expect(confirmation.bookingReference).toBe("FW-123ABC");
    expect(invoke).toHaveBeenCalledWith("send-booking-email", {
      body: {
        appointmentId: "appt-1",
        kind: "booking_confirmation",
        managementToken: "manage-token"
      }
    });
  });

  it("asks the Edge Function to send customer reschedule and cancellation notices", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ok: true }], error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { rpc, functions: { invoke } }
    }));

    const { cancelManagedBooking, rescheduleManagedBooking } = await import("./data");

    await rescheduleManagedBooking("manage-token", "2026-07-07T14:00:00.000Z");
    await cancelManagedBooking("manage-token");

    expect(invoke).toHaveBeenNthCalledWith(1, "send-booking-email", {
      body: {
        kind: "booking_rescheduled",
        managementToken: "manage-token"
      }
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "send-booking-email", {
      body: {
        kind: "booking_cancelled",
        managementToken: "manage-token"
      }
    });
  });

  it("queues and sends a cancellation notice when staff cancels a live appointment", async () => {
    const updateEq = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "appt-1",
            booking_reference: "FW-123ABC",
            customer_email: "maya@example.com"
          },
          error: null
        })
      }))
    }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "appointments") return { update };
      if (table === "email_logs") return { insert };
      throw new Error(`Unexpected table ${table}`);
    });
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { from, functions: { invoke } }
    }));

    const { cancelAppointmentAsStaff } = await import("./data");

    await cancelAppointmentAsStaff("appt-1");

    expect(insert).toHaveBeenCalledWith({
      appointment_id: "appt-1",
      kind: "booking_cancelled",
      recipient_email: "maya@example.com",
      subject: "Your Fancy Wave appointment was cancelled",
      body: "Your booking reference FW-123ABC has been cancelled by the salon."
    });
    expect(invoke).toHaveBeenCalledWith("send-booking-email", {
      body: {
        appointmentId: "appt-1",
        kind: "booking_cancelled"
      }
    });
  });

  it("soft-deletes live services and removes stylist assignments", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteAssignments = vi.fn(() => ({ eq: deleteEq }));
    const from = vi.fn((table: string) => {
      if (table === "services") return { update };
      if (table === "stylist_services") return { delete: deleteAssignments };
      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { from }
    }));

    const { deleteService } = await import("./data");

    await deleteService("service-1");

    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      is_active: false
    });
    expect(updateEq).toHaveBeenCalledWith("id", "service-1");
    expect(deleteAssignments).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("service_id", "service-1");
  });

  it("soft-deletes live stylists and removes assignments and custom hours", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const serviceAssignmentDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteServiceAssignments = vi.fn(() => ({ eq: serviceAssignmentDeleteEq }));
    const hoursDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteHours = vi.fn(() => ({ eq: hoursDeleteEq }));
    const from = vi.fn((table: string) => {
      if (table === "stylists") return { update };
      if (table === "stylist_services") return { delete: deleteServiceAssignments };
      if (table === "stylist_hours") return { delete: deleteHours };
      throw new Error(`Unexpected table ${table}`);
    });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { from }
    }));

    const { deleteStylist } = await import("./data");

    await deleteStylist("stylist-1");

    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      is_active: false
    });
    expect(updateEq).toHaveBeenCalledWith("id", "stylist-1");
    expect(deleteServiceAssignments).toHaveBeenCalled();
    expect(serviceAssignmentDeleteEq).toHaveBeenCalledWith("stylist_id", "stylist-1");
    expect(deleteHours).toHaveBeenCalled();
    expect(hoursDeleteEq).toHaveBeenCalledWith("stylist_id", "stylist-1");
  });

  it("queues and sends a reschedule notice when staff moves a live appointment", async () => {
    const existingAppointment = {
      id: "appt-1",
      booking_reference: "FW-123ABC",
      customer_email: "maya@example.com",
      service_duration_minutes_snapshot: 60,
      starts_at: "2026-07-06T14:00:00.000Z"
    };
    const selectSingle = vi.fn().mockResolvedValue({
      data: existingAppointment,
      error: null
    });
    const selectEq = vi.fn(() => ({ single: selectSingle }));
    const updateSingle = vi.fn().mockResolvedValue({
      data: {
        id: "appt-1",
        booking_reference: "FW-123ABC",
        customer_email: "maya@example.com"
      },
      error: null
    });
    const updateSelect = vi.fn(() => ({ single: updateSingle }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const appointmentsSelect = vi.fn(() => ({ eq: selectEq }));
    const emailInsert = vi.fn().mockResolvedValue({ error: null });
    const eventInsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "appointments") {
        return { select: appointmentsSelect, update };
      }
      if (table === "email_logs") return { insert: emailInsert };
      if (table === "appointment_events") return { insert: eventInsert };
      throw new Error(`Unexpected table ${table}`);
    });
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    vi.doMock("./supabase", () => ({
      isSupabaseConfigured: true,
      supabase: { from, functions: { invoke } }
    }));

    const { rescheduleAppointmentAsStaff } = await import("./data");

    await rescheduleAppointmentAsStaff("appt-1", "2026-07-07T14:00:00.000Z");

    expect(update).toHaveBeenCalledWith({
      starts_at: "2026-07-07T14:00:00.000Z",
      ends_at: "2026-07-07T15:00:00.000Z"
    });
    expect(eventInsert).toHaveBeenCalledWith({
      appointment_id: "appt-1",
      event_type: "rescheduled",
      actor_type: "staff",
      metadata: {
        previous_starts_at: "2026-07-06T14:00:00.000Z",
        new_starts_at: "2026-07-07T14:00:00.000Z"
      }
    });
    expect(emailInsert).toHaveBeenCalledWith({
      appointment_id: "appt-1",
      kind: "booking_rescheduled",
      recipient_email: "maya@example.com",
      subject: "Your Fancy Wave appointment was moved",
      body: "Your booking reference FW-123ABC has been rescheduled by the salon."
    });
    expect(invoke).toHaveBeenCalledWith("send-booking-email", {
      body: {
        appointmentId: "appt-1",
        kind: "booking_rescheduled"
      }
    });
  });
});
