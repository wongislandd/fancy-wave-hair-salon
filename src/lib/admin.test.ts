import { describe, expect, it } from "vitest";
import {
  customerHistoryForAppointment,
  galleryPhotoFormSchema,
  groupAppointmentsByDay,
  serviceFormSchema,
  staffAppointmentFormSchema,
  stylistFormSchema
} from "./admin";
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
        stylistId: "stylist-1",
        stylistNameSnapshot: "Nina Park",
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
        stylistId: "stylist-2",
        stylistNameSnapshot: "Theo Brooks",
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

  it("groups appointments by salon day instead of browser day", () => {
    const appointments: Appointment[] = [
      {
        id: "late-night",
        bookingReference: "FW-LATE",
        serviceId: "service-1",
        serviceNameSnapshot: "Signature Haircut",
        serviceDurationMinutesSnapshot: 60,
        servicePriceCentsSnapshot: 6500,
        customerName: "Maya Chen",
        customerEmail: "maya@example.com",
        customerPhone: "2125550101",
        stylistId: "stylist-1",
        stylistNameSnapshot: "Nina Park",
        startsAt: "2026-07-06T01:30:00.000Z",
        endsAt: "2026-07-06T02:30:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ];

    const grouped = groupAppointmentsByDay(appointments, "Asia/Tokyo");

    expect(Object.keys(grouped)).toEqual(["2026-07-06"]);
  });

  it("finds previous appointments for the reservation customer", () => {
    const appointments: Appointment[] = [
      {
        id: "current",
        bookingReference: "FW-CURRENT",
        serviceId: "service-1",
        serviceNameSnapshot: "Signature Haircut",
        serviceDurationMinutesSnapshot: 60,
        servicePriceCentsSnapshot: 6500,
        customerName: "Maya Chen",
        customerEmail: "maya@example.com",
        customerPhone: "2125550101",
        stylistId: "stylist-1",
        stylistNameSnapshot: "Nina Park",
        startsAt: "2026-07-20T14:00:00.000Z",
        endsAt: "2026-07-20T15:00:00.000Z",
        status: "confirmed",
        internalNotes: "Likes soft layers around the face.",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "previous",
        bookingReference: "FW-PREV",
        serviceId: "service-2",
        serviceNameSnapshot: "Gloss Treatment",
        serviceDurationMinutesSnapshot: 45,
        servicePriceCentsSnapshot: 8500,
        customerName: "Maya Chen",
        customerEmail: "MAYA@example.com",
        customerPhone: "2125550101",
        stylistId: "stylist-2",
        stylistNameSnapshot: "Theo Brooks",
        startsAt: "2026-06-10T15:00:00.000Z",
        endsAt: "2026-06-10T15:45:00.000Z",
        status: "completed",
        internalNotes: "Preferred clear gloss.",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z"
      },
      {
        id: "future",
        bookingReference: "FW-FUTURE",
        serviceId: "service-3",
        serviceNameSnapshot: "Blowout Styling",
        serviceDurationMinutesSnapshot: 45,
        servicePriceCentsSnapshot: 5500,
        customerName: "Maya Chen",
        customerEmail: "maya@example.com",
        customerPhone: "2125550101",
        stylistId: "stylist-3",
        stylistNameSnapshot: "Mara Lee",
        startsAt: "2026-08-10T15:00:00.000Z",
        endsAt: "2026-08-10T15:45:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      }
    ];

    const history = customerHistoryForAppointment(appointments, appointments[0]);

    expect(history).toHaveLength(1);
    expect(history[0].bookingReference).toBe("FW-PREV");
  });

  it("does not infer customer history from blank email addresses", () => {
    const appointments: Appointment[] = [
      {
        id: "current",
        bookingReference: "FW-CURRENT",
        serviceId: "service-1",
        serviceNameSnapshot: "Signature Haircut",
        serviceDurationMinutesSnapshot: 60,
        servicePriceCentsSnapshot: 6500,
        customerName: "Jo Carter",
        customerEmail: "",
        customerPhone: "",
        stylistId: "stylist-1",
        stylistNameSnapshot: "Nina Park",
        startsAt: "2026-07-20T14:00:00.000Z",
        endsAt: "2026-07-20T15:00:00.000Z",
        status: "confirmed",
        createdAt: "2026-07-01T12:00:00.000Z",
        updatedAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "previous",
        bookingReference: "FW-PREV",
        serviceId: "service-2",
        serviceNameSnapshot: "Gloss Treatment",
        serviceDurationMinutesSnapshot: 45,
        servicePriceCentsSnapshot: 8500,
        customerName: "Different Guest",
        customerEmail: "",
        customerPhone: "",
        stylistId: "stylist-2",
        stylistNameSnapshot: "Theo Brooks",
        startsAt: "2026-06-10T15:00:00.000Z",
        endsAt: "2026-06-10T15:45:00.000Z",
        status: "completed",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z"
      }
    ];

    const history = customerHistoryForAppointment(appointments, appointments[0]);

    expect(history).toEqual([]);
  });

  it("validates service form data", () => {
    const service = serviceFormSchema.parse({
      nameEn: "Signature Haircut",
      nameZh: "招牌剪发",
      descriptionEn: "Cut, wash, and finish",
      descriptionZh: "洗发、精剪和造型",
      durationMinutes: 60,
      priceDollars: 65,
      isActive: true
    });

    expect(service.priceDollars).toBe(65);
    expect(service.nameZh).toBe("招牌剪发");
  });

  it("allows service managers to fill only one language with fallback display", () => {
    const service = serviceFormSchema.parse({
      nameEn: "",
      nameZh: "护理染发",
      descriptionEn: "",
      descriptionZh: "补色、护理和亮泽处理",
      durationMinutes: 45,
      priceDollars: 85,
      isActive: true
    });

    expect(service.nameEn).toBe("");
    expect(service.nameZh).toBe("护理染发");
  });

  it("validates stylist profiles with assigned services and parsed specialties", () => {
    const stylist = stylistFormSchema.parse({
      name: "Nina Park",
      bio: "Precision cuts, soft layers, and lived-in styling.",
      specialties: "Cuts, Layers, Blowouts",
      serviceIds: ["service-haircut", "service-blowout"],
      isActive: true
    });

    expect(stylist.specialties).toEqual(["Cuts", "Layers", "Blowouts"]);
    expect(stylist.serviceIds).toEqual(["service-haircut", "service-blowout"]);
  });

  it("validates staff-created appointment details with optional contact fields", () => {
    const values = staffAppointmentFormSchema.parse({
      serviceId: "service-1",
      stylistId: "stylist-1",
      startsAt: "2026-07-06T14:00:00.000Z",
      customerName: " Jo Carter ",
      customerEmail: "",
      customerPhone: "",
      notes: "",
      internalNotes: " Phone booking "
    });

    expect(values).toMatchObject({
      serviceId: "service-1",
      stylistId: "stylist-1",
      startsAt: "2026-07-06T14:00:00.000Z",
      customerName: "Jo Carter",
      customerEmail: "",
      customerPhone: "",
      notes: "",
      internalNotes: "Phone booking"
    });
  });

  it("rejects staff appointment forms missing scheduling details or valid optional email", () => {
    const missingSchedule = staffAppointmentFormSchema.safeParse({
      serviceId: "",
      stylistId: "",
      startsAt: "",
      customerName: "J",
      customerEmail: "",
      customerPhone: "",
      notes: "",
      internalNotes: ""
    });
    const invalidEmail = staffAppointmentFormSchema.safeParse({
      serviceId: "service-1",
      stylistId: "stylist-1",
      startsAt: "2026-07-06T14:00:00.000Z",
      customerName: "Jo Carter",
      customerEmail: "not-an-email",
      customerPhone: "",
      notes: "",
      internalNotes: ""
    });

    expect(missingSchedule.success).toBe(false);
    expect(invalidEmail.success).toBe(false);
  });

  it("validates gallery photo metadata for admin uploads", () => {
    const values = galleryPhotoFormSchema.parse({
      altTextEn: " Salon color chair ",
      altTextZh: " \u67d3\u53d1 ",
      isActive: true
    });
    const chineseOnly = galleryPhotoFormSchema.parse({
      altTextEn: "",
      altTextZh: " \u67d3\u53d1 ",
      isActive: true
    });
    const invalid = galleryPhotoFormSchema.safeParse({
      altTextEn: " ",
      altTextZh: " ",
      isActive: true
    });

    expect(values).toEqual({
      altTextEn: "Salon color chair",
      altTextZh: "\u67d3\u53d1",
      isActive: true
    });
    expect(chineseOnly.altTextZh).toBe("\u67d3\u53d1");
    expect(invalid.success).toBe(false);
  });
});
