import { describe, expect, it, vi } from "vitest";
import { createStaffAppointment, saveStylistProfile } from "./admin-api";

describe("admin API RPC wrappers", () => {
  it("saves stylist profile and service assignments with one transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ stylist_id: "stylist-1" }],
      error: null
    });

    const stylistId = await saveStylistProfile(
      { rpc },
      {
        id: "stylist-1",
        name: "Nina Park",
        bioEn: "Precision cuts and soft layers.",
        bioZh: "\u7cbe\u51c6\u526a\u53d1\u548c\u67d4\u548c\u5c42\u6b21\u3002",
        specialtiesEn: ["Cuts", "Layers"],
        specialtiesZh: ["\u526a\u53d1", "\u5c42\u6b21"],
        serviceIds: ["service-1", "service-2"],
        isActive: true
      }
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_stylist_profile", {
      p_stylist_id: "stylist-1",
      p_name: "Nina Park",
      p_bio_en: "Precision cuts and soft layers.",
      p_bio_zh: "\u7cbe\u51c6\u526a\u53d1\u548c\u67d4\u548c\u5c42\u6b21\u3002",
      p_specialties_en: ["Cuts", "Layers"],
      p_specialties_zh: ["\u526a\u53d1", "\u5c42\u6b21"],
      p_service_ids: ["service-1", "service-2"],
      p_is_active: true
    });
    expect(stylistId).toBe("stylist-1");
  });

  it("creates a staff appointment with optional contact fields", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          appointment_id: "appt-1",
          booking_reference: "FW-STAFF1",
          management_token: "staff-token",
          starts_at: "2026-07-06T14:00:00.000Z",
          ends_at: "2026-07-06T15:00:00.000Z"
        }
      ],
      error: null
    });

    const confirmation = await createStaffAppointment(
      { rpc },
      {
        serviceId: "service-1",
        stylistId: "stylist-1",
        startsAt: "2026-07-06T14:00:00.000Z",
        customerName: "Jo Carter",
        customerEmail: "",
        customerPhone: "",
        notes: "",
        internalNotes: "Booked by phone"
      }
    );

    expect(rpc).toHaveBeenCalledWith("create_staff_appointment", {
      p_service_id: "service-1",
      p_stylist_id: "stylist-1",
      p_starts_at: "2026-07-06T14:00:00.000Z",
      p_customer_name: "Jo Carter",
      p_customer_email: "",
      p_customer_phone: "",
      p_notes: null,
      p_internal_notes: "Booked by phone"
    });
    expect(confirmation.bookingReference).toBe("FW-STAFF1");
    expect(confirmation.managementToken).toBe("staff-token");
  });
});
