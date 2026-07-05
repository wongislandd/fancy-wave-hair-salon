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
});
