import { describe, expect, it } from "vitest";
import {
  getAppointmentServiceName,
  getLocalizedGalleryPhotoText,
  getLocalizedServiceText,
  getManageableBookingServiceName
} from "./localization";
import type { Appointment, GalleryPhoto, ManageableBooking, Service } from "./types";

const bilingualService: Service = {
  id: "service-1",
  nameEn: "Signature Haircut",
  nameZh: "招牌剪发",
  descriptionEn: "Wash, precision cut, and a soft finish.",
  descriptionZh: "洗发、精剪和柔顺造型。",
  name: "Signature Haircut",
  description: "Wash, precision cut, and a soft finish.",
  durationMinutes: 60,
  priceCents: 6500,
  isActive: true,
  displayOrder: 1
};

const bilingualGalleryPhoto: GalleryPhoto = {
  id: "gallery-1",
  storagePath: "gallery/first.jpg",
  imageUrl: "/assets/salon-hero.png",
  altText: "Salon color chair",
  altTextEn: "Salon color chair",
  altTextZh: "\u6c99\u9f99\u67d3\u53d1\u6905",
  caption: null,
  displayOrder: 1,
  isActive: true,
  createdAt: "2026-07-05T12:00:00.000Z",
  updatedAt: "2026-07-05T12:00:00.000Z"
};

describe("localization helpers", () => {
  it("returns service copy for the selected language", () => {
    expect(getLocalizedServiceText(bilingualService, "en")).toEqual({
      name: "Signature Haircut",
      description: "Wash, precision cut, and a soft finish."
    });

    expect(getLocalizedServiceText(bilingualService, "zh")).toEqual({
      name: "招牌剪发",
      description: "洗发、精剪和柔顺造型。"
    });
  });

  it("falls back to the available service language when a translation is blank", () => {
    const service: Service = {
      ...bilingualService,
      nameEn: "",
      name: "",
      descriptionEn: "",
      description: "",
      nameZh: "染发",
      descriptionZh: "全头染发和造型。"
    };

    expect(getLocalizedServiceText(service, "en")).toEqual({
      name: "染发",
      description: "全头染发和造型。"
    });
  });

  it("returns gallery photo descriptions for the selected language", () => {
    expect(getLocalizedGalleryPhotoText(bilingualGalleryPhoto, "en")).toEqual({
      altText: "Salon color chair"
    });
    expect(getLocalizedGalleryPhotoText(bilingualGalleryPhoto, "zh")).toEqual({
      altText: "\u6c99\u9f99\u67d3\u53d1\u6905"
    });
  });

  it("falls back to the available gallery photo description", () => {
    expect(getLocalizedGalleryPhotoText({
      ...bilingualGalleryPhoto,
      altText: "",
      altTextEn: "",
      altTextZh: "\u67d3\u53d1"
    }, "en")).toEqual({
      altText: "\u67d3\u53d1"
    });
  });

  it("localizes appointment service snapshots", () => {
    const appointment: Appointment = {
      id: "appt-1",
      bookingReference: "FW-123",
      serviceId: bilingualService.id,
      serviceNameSnapshot: "Signature Haircut",
      serviceNameZhSnapshot: "招牌剪发",
      serviceDurationMinutesSnapshot: 60,
      servicePriceCentsSnapshot: 6500,
      customerName: "Maya Chen",
      customerEmail: "maya@example.com",
      customerPhone: "212-555-0101",
      stylistId: "stylist-1",
      stylistNameSnapshot: "Nina Park",
      startsAt: "2026-07-06T14:00:00.000Z",
      endsAt: "2026-07-06T15:00:00.000Z",
      status: "confirmed",
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z"
    };

    expect(getAppointmentServiceName(appointment, "zh")).toBe("招牌剪发");
  });

  it("localizes managed booking service snapshots", () => {
    const booking: ManageableBooking = {
      bookingReference: "FW-123",
      serviceId: bilingualService.id,
      serviceName: "Signature Haircut",
      serviceNameZh: "招牌剪发",
      serviceDurationMinutes: 60,
      servicePriceCents: 6500,
      customerName: "Maya Chen",
      customerEmail: "maya@example.com",
      customerPhone: "212-555-0101",
      stylistId: "stylist-1",
      stylistName: "Nina Park",
      startsAt: "2026-07-06T14:00:00.000Z",
      endsAt: "2026-07-06T15:00:00.000Z",
      status: "confirmed",
      canManageOnline: true
    };

    expect(getManageableBookingServiceName(booking, "zh")).toBe("招牌剪发");
  });
});
