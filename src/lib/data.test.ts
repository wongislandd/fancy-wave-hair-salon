import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null
}));

import {
  bookAppointment,
  bookStaffAppointment,
  cancelManagedBooking,
  deleteBusinessHourException,
  deleteService,
  deleteStylist,
  getAvailableSlots,
  listBusinessHourExceptions,
  listAdminServices,
  loadBookingByToken,
  listAdminGalleryPhotos,
  listPublicServices,
  listPublicGalleryPhotos,
  listPublicStylists,
  listAdminStylists,
  listStylistHours,
  rescheduleManagedBooking,
  saveBusinessHourException,
  saveGalleryPhoto,
  saveService,
  saveStylist,
  signInStaff,
  updateGalleryPhotoOrder,
  updateServiceOrder,
  updateStylistHour
} from "./data";
import {
  demoAppointments,
  demoBusinessHourExceptions,
  demoBusinessHours,
  demoGalleryPhotos,
  demoServices,
  demoStylistHours,
  demoStylists
} from "./demo-data";
import type { Appointment, BusinessHourException, BusinessHour, GalleryPhoto, Service, Stylist, StylistHour } from "./types";

const originalServices = structuredClone(demoServices) as Service[];
const originalStylists = structuredClone(demoStylists) as Stylist[];
const originalStylistHours = structuredClone(demoStylistHours) as StylistHour[];
const originalAppointments = structuredClone(demoAppointments) as Appointment[];
const originalBusinessHourExceptions = structuredClone(demoBusinessHourExceptions) as BusinessHourException[];
const originalBusinessHours = structuredClone(demoBusinessHours) as BusinessHour[];
const originalGalleryPhotos = structuredClone(demoGalleryPhotos) as GalleryPhoto[];

describe("demo data access", () => {
  afterEach(() => {
    vi.useRealTimers();
    demoServices.splice(0, demoServices.length, ...structuredClone(originalServices));
    demoStylists.splice(0, demoStylists.length, ...structuredClone(originalStylists));
    demoStylistHours.splice(0, demoStylistHours.length, ...structuredClone(originalStylistHours));
    demoAppointments.splice(0, demoAppointments.length, ...structuredClone(originalAppointments));
    demoBusinessHourExceptions.splice(0, demoBusinessHourExceptions.length, ...structuredClone(originalBusinessHourExceptions));
    demoBusinessHours.splice(0, demoBusinessHours.length, ...structuredClone(originalBusinessHours));
    demoGalleryPhotos.splice(0, demoGalleryPhotos.length, ...structuredClone(originalGalleryPhotos));
  });

  it("lists active public gallery photos in display order", async () => {
    demoGalleryPhotos.splice(
      0,
      demoGalleryPhotos.length,
      {
        id: "gallery-hidden",
        storagePath: "gallery/hidden.jpg",
        imageUrl: "/assets/salon-hero.png",
        altText: "Hidden station detail",
        altTextEn: "Hidden station detail",
        altTextZh: "\u9690\u85cf\u5de5\u4f4d\u7ec6\u8282",
        caption: "Hidden from the home page",
        displayOrder: 1,
        isActive: false,
        createdAt: "2026-07-05T12:00:00.000Z",
        updatedAt: "2026-07-05T12:00:00.000Z"
      },
      {
        id: "gallery-second",
        storagePath: "gallery/second.jpg",
        imageUrl: "/assets/salon-hero.png",
        altText: "Color chair detail",
        altTextEn: "Color chair detail",
        altTextZh: "\u67d3\u53d1\u6905\u7ec6\u8282",
        caption: "Color-ready stations",
        displayOrder: 20,
        isActive: true,
        createdAt: "2026-07-05T12:00:00.000Z",
        updatedAt: "2026-07-05T12:00:00.000Z"
      },
      {
        id: "gallery-first",
        storagePath: "gallery/first.jpg",
        imageUrl: "/assets/salon-hero.png",
        altText: "Front salon seating",
        altTextEn: "Front salon seating",
        altTextZh: "\u6c99\u9f99\u524d\u5385\u5ea7\u4f4d",
        caption: "Roosevelt Ave salon floor",
        displayOrder: 10,
        isActive: true,
        createdAt: "2026-07-05T12:00:00.000Z",
        updatedAt: "2026-07-05T12:00:00.000Z"
      }
    );

    const photos = await listPublicGalleryPhotos();

    expect(photos.map((photo) => photo.altText)).toEqual([
      "Front salon seating",
      "Color chair detail"
    ]);
  });

  it("saves and reorders demo gallery photos for admin management", async () => {
    demoGalleryPhotos.splice(
      0,
      demoGalleryPhotos.length,
      {
        id: "gallery-existing",
        storagePath: "gallery/existing.jpg",
        imageUrl: "/assets/salon-hero.png",
        altText: "Existing salon photo",
        altTextEn: "Existing salon photo",
        altTextZh: "\u73b0\u6709\u6c99\u9f99\u7167\u7247",
        caption: null,
        displayOrder: 1,
        isActive: true,
        createdAt: "2026-07-05T12:00:00.000Z",
        updatedAt: "2026-07-05T12:00:00.000Z"
      }
    );

    const saved = await saveGalleryPhoto({
      storagePath: "gallery/new-photo.jpg",
      imageUrl: "/assets/salon-hero.png",
      altTextEn: " Fresh color result ",
      altTextZh: " \u67d3\u53d1 ",
      isActive: true
    });

    expect(saved).toMatchObject({
      storagePath: "gallery/new-photo.jpg",
      altText: "Fresh color result",
      altTextEn: "Fresh color result",
      altTextZh: "\u67d3\u53d1",
      caption: null,
      displayOrder: 2,
      isActive: true
    });

    await updateGalleryPhotoOrder([saved.id, "gallery-existing"]);

    const adminPhotos = await listAdminGalleryPhotos();

    expect(adminPhotos.map((photo) => [photo.id, photo.displayOrder])).toEqual([
      [saved.id, 1],
      ["gallery-existing", 2]
    ]);
  });

  it("lists active public services in display order", async () => {
    demoServices.splice(
      0,
      demoServices.length,
      {
        id: "service-hidden",
        name: "Hidden Color",
        nameEn: "Hidden Color",
        nameZh: "\u9690\u85cf\u67d3\u53d1",
        description: "Hidden from booking.",
        descriptionEn: "Hidden from booking.",
        descriptionZh: "\u9884\u7ea6\u4e2d\u9690\u85cf\u3002",
        durationMinutes: 90,
        priceCents: 12000,
        displayOrder: 1,
        isActive: false
      },
      {
        id: "service-second",
        name: "Gloss Treatment",
        nameEn: "Gloss Treatment",
        nameZh: "\u4eae\u6cfd\u62a4\u7406",
        description: "Tone refresh and shine.",
        descriptionEn: "Tone refresh and shine.",
        descriptionZh: "\u8865\u8272\u548c\u4eae\u6cfd\u3002",
        durationMinutes: 45,
        priceCents: 8500,
        displayOrder: 20,
        isActive: true
      },
      {
        id: "service-first",
        name: "Blowout Styling",
        nameEn: "Blowout Styling",
        nameZh: "\u5439\u98ce\u9020\u578b",
        description: "Smooth finish.",
        descriptionEn: "Smooth finish.",
        descriptionZh: "\u67d4\u987a\u9020\u578b\u3002",
        durationMinutes: 45,
        priceCents: 5500,
        displayOrder: 10,
        isActive: true
      }
    );

    const services = await listPublicServices();

    expect(services.map((service) => service.id)).toEqual([
      "service-first",
      "service-second"
    ]);
  });

  it("saves and reorders demo services for admin management", async () => {
    demoServices.splice(
      0,
      demoServices.length,
      {
        id: "service-high",
        name: "Full Color",
        nameEn: "Full Color",
        nameZh: "\u5168\u5934\u67d3\u53d1",
        description: "All-over color.",
        descriptionEn: "All-over color.",
        descriptionZh: "\u5168\u5934\u67d3\u53d1\u3002",
        durationMinutes: 120,
        priceCents: 16500,
        displayOrder: 10,
        isActive: true
      },
      {
        id: "service-low",
        name: "Men's Haircut",
        nameEn: "Men's Haircut",
        nameZh: "\u7537\u58eb\u526a\u53d1",
        description: "Clean shape.",
        descriptionEn: "Clean shape.",
        descriptionZh: "\u6e05\u723d\u4fee\u526a\u3002",
        durationMinutes: 30,
        priceCents: 2800,
        displayOrder: 5,
        isActive: true
      }
    );

    await saveService({
      nameEn: " Color Melt ",
      nameZh: " \u6e10\u5c42\u67d3 ",
      descriptionEn: " Soft dimensional color ",
      descriptionZh: " \u67d4\u548c\u5c42\u6b21\u67d3 ",
      durationMinutes: 150,
      priceDollars: 220,
      priceMaxDollars: null,
      priceIsStartingAt: false,
      isActive: true
    });

    const created = demoServices.find((service) => service.name === "Color Melt");
    expect(created).toMatchObject({
      nameZh: "\u6e10\u5c42\u67d3",
      descriptionEn: "Soft dimensional color",
      displayOrder: 11
    });

    await saveService({
      nameEn: " Full Color Refresh ",
      nameZh: "",
      descriptionEn: " Updated color service ",
      descriptionZh: "",
      durationMinutes: 120,
      priceDollars: 175,
      priceMaxDollars: null,
      priceIsStartingAt: false,
      isActive: true
    }, "service-high");

    expect(demoServices.find((service) => service.id === "service-high")?.displayOrder).toBe(10);

    await updateServiceOrder([created!.id, "service-low", "service-high"]);

    const adminServices = await listAdminServices();

    expect(adminServices.map((service) => [service.id, service.displayOrder])).toEqual([
      [created!.id, 1],
      ["service-low", 2],
      ["service-high", 3]
    ]);
  });

  it("deletes demo services and clears stylist assignments", async () => {
    demoServices.splice(
      0,
      demoServices.length,
      {
        id: "service-high",
        name: "Full Color",
        nameEn: "Full Color",
        nameZh: "\u5168\u5934\u67d3\u53d1",
        description: "All-over color.",
        descriptionEn: "All-over color.",
        descriptionZh: "\u5168\u5934\u67d3\u53d1\u3002",
        durationMinutes: 120,
        priceCents: 16500,
        displayOrder: 10,
        isActive: true
      },
      {
        id: "service-low",
        name: "Men's Haircut",
        nameEn: "Men's Haircut",
        nameZh: "\u7537\u58eb\u526a\u53d1",
        description: "Clean shape.",
        descriptionEn: "Clean shape.",
        descriptionZh: "\u6e05\u723d\u4fee\u526a\u3002",
        durationMinutes: 30,
        priceCents: 2800,
        displayOrder: 5,
        isActive: true
      }
    );
    demoStylists.splice(
      0,
      demoStylists.length,
      {
        id: "stylist-nina",
        name: "Nina Park",
        bio: "Precision cuts.",
        specialties: ["Cuts"],
        serviceIds: ["service-high", "service-low"],
        isActive: true,
        displayOrder: 1
      }
    );

    await deleteService("service-low");

    const adminServices = await listAdminServices();

    expect(adminServices.map((service) => [service.id, service.displayOrder])).toEqual([
      ["service-high", 1]
    ]);
    expect(demoStylists[0].serviceIds).toEqual(["service-high"]);
  });

  it("saves stylist service assignments used by the public booking flow", async () => {
    const nina = demoStylists[0];
    const gloss = demoServices[1];

    await saveStylist(
      {
        name: nina.name,
        bioEn: nina.bio,
        bioZh: nina.bio,
        specialtiesEn: nina.specialties,
        specialtiesZh: nina.specialties,
        serviceIds: [gloss.id],
        isActive: true
      },
      nina.id
    );

    const haircutStylists = await listPublicStylists(demoServices[0].id);
    const glossStylists = await listPublicStylists(gloss.id);

    expect(haircutStylists.map((stylist) => stylist.id)).not.toContain(nina.id);
    expect(glossStylists.map((stylist) => stylist.id)).toContain(nina.id);
  });

  it("deletes demo stylists and clears custom hours", async () => {
    demoStylists.splice(
      0,
      demoStylists.length,
      {
        id: "stylist-nina",
        name: "Nina Park",
        bio: "Precision cuts.",
        specialties: ["Cuts"],
        serviceIds: ["service-high"],
        isActive: true,
        displayOrder: 10
      },
      {
        id: "stylist-mara",
        name: "Mara Lee",
        bio: "Color services.",
        specialties: ["Color"],
        serviceIds: ["service-low"],
        isActive: true,
        displayOrder: 5
      }
    );
    demoStylistHours.splice(
      0,
      demoStylistHours.length,
      {
        id: "hour-nina-monday",
        stylistId: "stylist-nina",
        dayOfWeek: 1,
        opensAt: "10:00",
        closesAt: "16:00",
        isClosed: false,
        usesSalonHours: false
      },
      {
        id: "hour-mara-monday",
        stylistId: "stylist-mara",
        dayOfWeek: 1,
        opensAt: "11:00",
        closesAt: "17:00",
        isClosed: false,
        usesSalonHours: false
      }
    );

    await deleteStylist("stylist-nina");

    const adminStylists = await listAdminStylists();

    expect(adminStylists.map((stylist) => [stylist.id, stylist.displayOrder])).toEqual([
      ["stylist-mara", 1]
    ]);
    expect(demoStylistHours.map((hour) => hour.stylistId)).toEqual(["stylist-mara"]);
  });

  it("persists stylist hour overrides with salon-hour fallback rows", async () => {
    const nina = demoStylists[0];
    const monday = (await listStylistHours(nina.id)).find((hour) => hour.dayOfWeek === 1);

    expect(monday).toMatchObject({
      stylistId: nina.id,
      opensAt: "09:00",
      closesAt: "17:00",
      usesSalonHours: true
    });

    await updateStylistHour(monday!, {
      opensAt: "12:00",
      closesAt: "14:00",
      isClosed: false,
      usesSalonHours: false
    });

    const override = (await listStylistHours(nina.id)).find((hour) => hour.dayOfWeek === 1);

    expect(override).toMatchObject({
      stylistId: nina.id,
      opensAt: "12:00",
      closesAt: "14:00",
      usesSalonHours: false
    });

    await updateStylistHour(override!, {
      opensAt: "12:00",
      closesAt: "14:00",
      isClosed: false,
      usesSalonHours: true
    });

    const reverted = (await listStylistHours(nina.id)).find((hour) => hour.dayOfWeek === 1);

    expect(reverted).toMatchObject({
      opensAt: "09:00",
      closesAt: "17:00",
      usesSalonHours: true
    });
  });

  it("uses stylist hour overrides when deriving demo availability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    const nina = demoStylists[0];
    const haircut = demoServices[0];
    const monday = (await listStylistHours(nina.id)).find((hour) => hour.dayOfWeek === 1);

    await updateStylistHour(monday!, {
      opensAt: "12:00",
      closesAt: "14:00",
      isClosed: false,
      usesSalonHours: false
    });

    const slots = await getAvailableSlots(haircut, "2026-07-06", nina);

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-07-06T16:00:00.000Z",
      "2026-07-06T16:30:00.000Z",
      "2026-07-06T17:00:00.000Z"
    ]);
  });

  it("saves, edits, and deletes demo special hours", async () => {
    const saved = await saveBusinessHourException({
      startsOn: "2026-07-06",
      endsOn: "2026-07-07",
      opensAt: "09:00",
      closesAt: "17:00",
      isClosed: true,
      note: "Holiday closure"
    });

    expect(await listBusinessHourExceptions()).toEqual([
      expect.objectContaining({
        id: saved.id,
        startsOn: "2026-07-06",
        endsOn: "2026-07-07",
        isClosed: true,
        note: "Holiday closure"
      })
    ]);

    await saveBusinessHourException({
      startsOn: "2026-07-06",
      endsOn: "2026-07-06",
      opensAt: "10:00",
      closesAt: "14:00",
      isClosed: false,
      note: "Short day"
    }, saved.id);

    expect(await listBusinessHourExceptions()).toEqual([
      expect.objectContaining({
        id: saved.id,
        startsOn: "2026-07-06",
        endsOn: "2026-07-06",
        opensAt: "10:00",
        closesAt: "14:00",
        isClosed: false,
        note: "Short day"
      })
    ]);

    await deleteBusinessHourException(saved.id);

    expect(await listBusinessHourExceptions()).toEqual([]);
  });

  it("uses special hour closures and custom ranges when deriving demo availability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    const nina = demoStylists[0];
    const haircut = demoServices[0];

    await saveBusinessHourException({
      startsOn: "2026-07-06",
      endsOn: "2026-07-06",
      opensAt: "09:00",
      closesAt: "17:00",
      isClosed: true,
      note: "Closed"
    });

    await expect(getAvailableSlots(haircut, "2026-07-06", nina)).resolves.toEqual([]);

    demoBusinessHourExceptions.splice(0, demoBusinessHourExceptions.length);
    await saveBusinessHourException({
      startsOn: "2026-07-06",
      endsOn: "2026-07-06",
      opensAt: "10:00",
      closesAt: "12:00",
      isClosed: false,
      note: "Morning only"
    });

    const slots = await getAvailableSlots(haircut, "2026-07-06", nina);

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-07-06T14:00:00.000Z",
      "2026-07-06T14:30:00.000Z",
      "2026-07-06T15:00:00.000Z"
    ]);
  });

  it("rejects stale demo booking attempts that overlap an existing stylist appointment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-06T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-06T15:00:00.000Z";

    await expect(
      bookAppointment({
        serviceId: demoServices[0].id,
        stylistId: demoStylists[0].id,
        startsAt: "2026-07-06T14:00:00.000Z",
        customerName: "Jo Carter",
        customerEmail: "jo@example.com",
        customerPhone: "212-555-0199"
      })
    ).rejects.toThrow("Selected time is no longer available");
  });

  it("creates staff appointments in demo mode with optional contact fields", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    const confirmation = await bookStaffAppointment({
      serviceId: demoServices[0].id,
      stylistId: demoStylists[0].id,
      startsAt: "2026-07-06T15:00:00.000Z",
      customerName: "Jo Carter",
      customerEmail: "",
      customerPhone: "",
      notes: "",
      internalNotes: "Phone booking"
    });

    const appointment = demoAppointments.find((item) => item.id === confirmation.appointmentId);

    expect(appointment).toMatchObject({
      bookingReference: confirmation.bookingReference,
      serviceId: demoServices[0].id,
      serviceNameSnapshot: demoServices[0].name,
      serviceNameZhSnapshot: demoServices[0].nameZh,
      customerName: "Jo Carter",
      customerEmail: "",
      customerPhone: "",
      stylistId: demoStylists[0].id,
      stylistNameSnapshot: demoStylists[0].name,
      internalNotes: "Phone booking",
      startsAt: "2026-07-06T15:00:00.000Z",
      endsAt: "2026-07-06T16:00:00.000Z",
      status: "confirmed"
    });
  });

  it("stores the exposed service duration while blocking only the calendar duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    demoServices[0].durationMinutes = 240;
    demoServices[0].calendarBlockMinutes = 60;

    const confirmation = await bookStaffAppointment({
      serviceId: demoServices[0].id,
      stylistId: demoStylists[0].id,
      startsAt: "2026-07-06T15:00:00.000Z",
      customerName: "Jo Carter",
      customerEmail: "",
      customerPhone: ""
    });

    const appointment = demoAppointments.find((item) => item.id === confirmation.appointmentId);

    expect(appointment).toMatchObject({
      serviceDurationMinutesSnapshot: 240,
      startsAt: "2026-07-06T15:00:00.000Z",
      endsAt: "2026-07-06T16:00:00.000Z"
    });
  });

  it("rejects staff-created demo appointments that overlap the selected stylist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-06T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-06T15:00:00.000Z";

    await expect(
      bookStaffAppointment({
        serviceId: demoServices[0].id,
        stylistId: demoStylists[0].id,
        startsAt: "2026-07-06T14:00:00.000Z",
        customerName: "Jo Carter",
        customerEmail: "",
        customerPhone: ""
      })
    ).rejects.toThrow("Selected time is no longer available");
  });

  it("rejects staff-created demo appointments outside selected stylist availability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    await expect(
      bookStaffAppointment({
        serviceId: demoServices[0].id,
        stylistId: demoStylists[0].id,
        startsAt: "2026-07-06T22:00:00.000Z",
        customerName: "Jo Carter",
        customerEmail: "",
        customerPhone: ""
      })
    ).rejects.toThrow("Selected time is no longer available");
  });

  it("rejects demo bookings outside the selected stylist availability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));

    await expect(
      bookAppointment({
        serviceId: demoServices[0].id,
        stylistId: demoStylists[0].id,
        startsAt: "2026-07-06T22:00:00.000Z",
        customerName: "Jo Carter",
        customerEmail: "jo@example.com",
        customerPhone: "212-555-0199"
      })
    ).rejects.toThrow("Selected time is no longer available");
  });

  it("rejects demo reschedules outside the selected stylist availability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-08T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-08T15:00:00.000Z";

    await expect(
      rescheduleManagedBooking("demo-token", "2026-07-06T22:00:00.000Z")
    ).rejects.toThrow("Selected time is no longer available");
  });

  it("marks customer-managed bookings as locked inside the change cutoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T13:30:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-06T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-06T15:00:00.000Z";

    const booking = await loadBookingByToken("demo-token");

    expect(booking?.canManageOnline).toBe(false);
  });

  it("rejects customer reschedules inside the change cutoff in demo mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T13:30:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-06T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-06T15:00:00.000Z";

    await expect(
      rescheduleManagedBooking("demo-token", "2026-07-07T14:00:00.000Z")
    ).rejects.toThrow("This booking can no longer be changed online");
  });

  it("rejects customer cancellations inside the change cutoff in demo mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T13:30:00.000Z"));
    demoAppointments[0].startsAt = "2026-07-06T14:00:00.000Z";
    demoAppointments[0].endsAt = "2026-07-06T15:00:00.000Z";

    await expect(cancelManagedBooking("demo-token")).rejects.toThrow(
      "This booking can no longer be changed online"
    );
  });

  it("does not allow demo staff credentials when Supabase is not configured", async () => {
    await expect(signInStaff("manager@example.com", "correct horse")).rejects.toThrow(
      "Supabase is not configured"
    );
  });
});
