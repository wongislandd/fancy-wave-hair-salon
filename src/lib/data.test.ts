import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null
}));

import {
  bookAppointment,
  bookStaffAppointment,
  cancelManagedBooking,
  getAvailableSlots,
  loadBookingByToken,
  listAdminGalleryPhotos,
  listPublicGalleryPhotos,
  listPublicStylists,
  listStylistHours,
  rescheduleManagedBooking,
  saveGalleryPhoto,
  saveStylist,
  signInStaff,
  updateGalleryPhotoOrder,
  updateStylistHour
} from "./data";
import {
  demoAppointments,
  demoBusinessHours,
  demoGalleryPhotos,
  demoServices,
  demoStylistHours,
  demoStylists
} from "./demo-data";
import type { Appointment, BusinessHour, GalleryPhoto, Stylist, StylistHour } from "./types";

const originalStylists = structuredClone(demoStylists) as Stylist[];
const originalStylistHours = structuredClone(demoStylistHours) as StylistHour[];
const originalAppointments = structuredClone(demoAppointments) as Appointment[];
const originalBusinessHours = structuredClone(demoBusinessHours) as BusinessHour[];
const originalGalleryPhotos = structuredClone(demoGalleryPhotos) as GalleryPhoto[];

describe("demo data access", () => {
  afterEach(() => {
    vi.useRealTimers();
    demoStylists.splice(0, demoStylists.length, ...structuredClone(originalStylists));
    demoStylistHours.splice(0, demoStylistHours.length, ...structuredClone(originalStylistHours));
    demoAppointments.splice(0, demoAppointments.length, ...structuredClone(originalAppointments));
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

  it("saves stylist service assignments used by the public booking flow", async () => {
    const nina = demoStylists[0];
    const gloss = demoServices[1];

    await saveStylist(
      {
        name: nina.name,
        bio: nina.bio,
        specialties: nina.specialties,
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
