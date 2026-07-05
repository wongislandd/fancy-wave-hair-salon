import { describe, expect, it, vi } from "vitest";
import {
  cancelBookingByToken,
  createAppointment,
  getBookingByToken,
  rescheduleBookingByToken
} from "./booking-api";

describe("booking API RPC wrappers", () => {
  it("calls create_appointment with normalized booking payload", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          appointment_id: "appt-1",
          booking_reference: "FW-123ABC",
          management_token: "secret-token",
          starts_at: "2026-07-06T14:00:00.000Z",
          ends_at: "2026-07-06T15:00:00.000Z"
        }
      ],
      error: null
    });

    const result = await createAppointment(
      { rpc },
      {
        serviceId: "service-1",
        stylistId: "stylist-1",
        startsAt: "2026-07-06T14:00:00.000Z",
        customerName: "Maya Chen",
        customerEmail: "maya@example.com",
        customerPhone: "2125550101",
        notes: ""
      }
    );

    expect(rpc).toHaveBeenCalledWith("create_appointment", {
      p_service_id: "service-1",
      p_stylist_id: "stylist-1",
      p_starts_at: "2026-07-06T14:00:00.000Z",
      p_customer_name: "Maya Chen",
      p_customer_email: "maya@example.com",
      p_customer_phone: "2125550101",
      p_notes: null
    });
    expect(result.bookingReference).toBe("FW-123ABC");
    expect(result.managementToken).toBe("secret-token");
  });

  it("loads a customer-manageable booking by token", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          booking_reference: "FW-123ABC",
          service_id: "service-1",
          service_name: "Signature Haircut",
          service_name_zh: "招牌剪发",
          service_duration_minutes: 60,
          service_price_cents: 6500,
          customer_name: "Maya Chen",
          customer_email: "maya@example.com",
          customer_phone: "212-555-0101",
          stylist_id: "stylist-1",
          stylist_name: "Nina Park",
          notes: "Soft layers.",
          can_manage_online: false,
          starts_at: "2026-07-06T14:00:00.000Z",
          ends_at: "2026-07-06T15:00:00.000Z",
          status: "confirmed"
        }
      ],
      error: null
    });

    const booking = await getBookingByToken({ rpc }, "secret-token");

    expect(rpc).toHaveBeenCalledWith("get_booking_by_token", {
      p_token: "secret-token"
    });
    expect(booking?.bookingReference).toBe("FW-123ABC");
    expect(booking?.serviceNameZh).toBe("招牌剪发");
    expect(booking?.stylistName).toBe("Nina Park");
    expect(booking?.customerPhone).toBe("212-555-0101");
    expect(booking?.notes).toBe("Soft layers.");
    expect(booking?.canManageOnline).toBe(false);
  });

  it("reschedules and cancels through token-scoped RPC calls", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ok: true }], error: null });

    await rescheduleBookingByToken(
      { rpc },
      "secret-token",
      "2026-07-06T16:00:00.000Z"
    );
    await cancelBookingByToken({ rpc }, "secret-token");

    expect(rpc).toHaveBeenNthCalledWith(1, "reschedule_booking_by_token", {
      p_token: "secret-token",
      p_new_starts_at: "2026-07-06T16:00:00.000Z"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "cancel_booking_by_token", {
      p_token: "secret-token"
    });
  });
});
