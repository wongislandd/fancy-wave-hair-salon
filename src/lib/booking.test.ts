import { describe, expect, it } from "vitest";
import {
  bookingDetailsSchema,
  buildManageBookingPath,
  calculateAppointmentEnd,
  deriveAvailableSlots,
  isCustomerManageableStatus
} from "./booking";
import type { Appointment, BusinessHour, Service } from "./types";

const haircut: Service = {
  id: "service-haircut",
  name: "Signature Haircut",
  description: "Cut, wash, and finish",
  durationMinutes: 60,
  priceCents: 6500,
  isActive: true,
  displayOrder: 1
};

const mondayHours: BusinessHour[] = [
  {
    id: "hours-monday",
    dayOfWeek: 1,
    opensAt: "09:00",
    closesAt: "17:00",
    isClosed: false
  }
];

describe("booking domain helpers", () => {
  it("builds customer management paths from opaque tokens", () => {
    expect(buildManageBookingPath("abc123")).toBe("/manage-booking/abc123");
  });

  it("calculates appointment end times from service duration", () => {
    const end = calculateAppointmentEnd("2026-07-06T14:30:00.000Z", 75);

    expect(end.toISOString()).toBe("2026-07-06T15:45:00.000Z");
  });

  it("marks only future confirmed appointments as customer-manageable", () => {
    expect(isCustomerManageableStatus("confirmed")).toBe(true);
    expect(isCustomerManageableStatus("cancelled")).toBe(false);
    expect(isCustomerManageableStatus("completed")).toBe(false);
  });

  it("derives available slots inside business hours while excluding overlaps", () => {
    const existingAppointments: Appointment[] = [
      {
        id: "appt-1",
        bookingReference: "FW-ABC123",
        serviceId: haircut.id,
        serviceNameSnapshot: haircut.name,
        serviceDurationMinutesSnapshot: haircut.durationMinutes,
        servicePriceCentsSnapshot: haircut.priceCents,
        customerName: "Jamie Rivera",
        customerEmail: "jamie@example.com",
        customerPhone: "555-0100",
        startsAt: "2026-07-06T14:00:00.000Z",
        endsAt: "2026-07-06T15:00:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ];

    const slots = deriveAvailableSlots({
      date: "2026-07-06",
      service: haircut,
      businessHours: mondayHours,
      existingAppointments,
      salonTimeZone: "UTC",
      slotIntervalMinutes: 30,
      now: new Date("2026-07-05T12:00:00.000Z")
    });

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-07-06T09:00:00.000Z",
      "2026-07-06T09:30:00.000Z",
      "2026-07-06T10:00:00.000Z",
      "2026-07-06T10:30:00.000Z",
      "2026-07-06T11:00:00.000Z",
      "2026-07-06T11:30:00.000Z",
      "2026-07-06T12:00:00.000Z",
      "2026-07-06T12:30:00.000Z",
      "2026-07-06T13:00:00.000Z",
      "2026-07-06T15:00:00.000Z",
      "2026-07-06T15:30:00.000Z",
      "2026-07-06T16:00:00.000Z"
    ]);
  });

  it("validates customer booking details", () => {
    const parsed = bookingDetailsSchema.parse({
      customerName: "Maya Chen",
      customerEmail: "maya@example.com",
      customerPhone: "(212) 555-0101",
      notes: "Prefers a quiet appointment"
    });

    expect(parsed.customerEmail).toBe("maya@example.com");
  });
});
