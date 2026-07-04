import { describe, expect, it } from "vitest";
import { groupAppointmentsByDay, serviceFormSchema } from "./admin";
import type { Appointment } from "./types";

describe("admin helpers", () => {
  it("groups appointments by local day for agenda rendering", () => {
    const appointments: Appointment[] = [
      {
        id: "appt-1",
        bookingReference: "FW-111111",
        serviceId: "service-1",
        serviceNameSnapshot: "Signature Haircut",
        serviceDurationMinutesSnapshot: 60,
        servicePriceCentsSnapshot: 6500,
        customerName: "Maya Chen",
        customerEmail: "maya@example.com",
        customerPhone: "2125550101",
        startsAt: "2026-07-06T14:00:00.000Z",
        endsAt: "2026-07-06T15:00:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "appt-2",
        bookingReference: "FW-222222",
        serviceId: "service-2",
        serviceNameSnapshot: "Gloss Treatment",
        serviceDurationMinutesSnapshot: 45,
        servicePriceCentsSnapshot: 8500,
        customerName: "Jo Carter",
        customerEmail: "jo@example.com",
        customerPhone: "2125550199",
        startsAt: "2026-07-07T15:00:00.000Z",
        endsAt: "2026-07-07T15:45:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ];

    const grouped = groupAppointmentsByDay(appointments);

    expect(Object.keys(grouped)).toEqual(["2026-07-06", "2026-07-07"]);
    expect(grouped["2026-07-06"][0].bookingReference).toBe("FW-111111");
  });

  it("validates service form data", () => {
    const service = serviceFormSchema.parse({
      name: "Signature Haircut",
      description: "Cut, wash, and finish",
      durationMinutes: 60,
      priceDollars: 65,
      isActive: true
    });

    expect(service.priceDollars).toBe(65);
  });
});
