import type {
  Appointment,
  BusinessHourException,
  BusinessHour,
  GalleryPhoto,
  Service,
  SalonSettings,
  Stylist,
  StylistHour
} from "./types";
import { zonedDateAndTimeToUtc } from "./booking";
import { salonName } from "./salon";

export const demoSettings: SalonSettings = {
  salonName,
  timezone: "America/New_York",
  slotIntervalMinutes: 30,
  minBookingNoticeMinutes: 120,
  cancellationCutoffMinutes: 60
};

export const demoServices: Service[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    nameEn: "Signature Haircut",
    nameZh: "招牌剪发",
    descriptionEn: "Wash, precision cut, and a soft finish.",
    descriptionZh: "洗发、精剪和柔顺造型。",
    name: "Signature Haircut",
    description: "Wash, precision cut, and a soft finish.",
    durationMinutes: 60,
    calendarBlockMinutes: 60,
    priceCents: 6500,
    isActive: true,
    displayOrder: 1
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    nameEn: "Gloss Treatment",
    nameZh: "亮泽护理",
    descriptionEn: "Tone refresh and shine treatment for luminous color.",
    descriptionZh: "补色调理，让发色更亮泽。",
    name: "Gloss Treatment",
    description: "Tone refresh and shine treatment for luminous color.",
    durationMinutes: 45,
    calendarBlockMinutes: 45,
    priceCents: 8500,
    isActive: true,
    displayOrder: 2
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    nameEn: "Blowout Styling",
    nameZh: "吹风造型",
    descriptionEn: "Smooth, voluminous styling for everyday polish.",
    descriptionZh: "柔顺蓬松的日常吹风造型。",
    name: "Blowout Styling",
    description: "Smooth, voluminous styling for everyday polish.",
    durationMinutes: 45,
    calendarBlockMinutes: 45,
    priceCents: 5500,
    isActive: true,
    displayOrder: 3
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    nameEn: "Full Color",
    nameZh: "全头染发",
    descriptionEn: "All-over color consultation, application, and finish.",
    descriptionZh: "包含染发咨询、全头上色和造型。",
    name: "Full Color",
    description: "All-over color consultation, application, and finish.",
    durationMinutes: 120,
    calendarBlockMinutes: 120,
    priceCents: 16500,
    isActive: true,
    displayOrder: 4
  }
];

export const demoBusinessHours: BusinessHour[] = [
  { id: "sun", dayOfWeek: 0, opensAt: "10:00", closesAt: "15:00", isClosed: true },
  { id: "mon", dayOfWeek: 1, opensAt: "09:00", closesAt: "17:00", isClosed: false },
  { id: "tue", dayOfWeek: 2, opensAt: "09:00", closesAt: "17:00", isClosed: false },
  { id: "wed", dayOfWeek: 3, opensAt: "09:00", closesAt: "17:00", isClosed: false },
  { id: "thu", dayOfWeek: 4, opensAt: "10:00", closesAt: "19:00", isClosed: false },
  { id: "fri", dayOfWeek: 5, opensAt: "10:00", closesAt: "19:00", isClosed: false },
  { id: "sat", dayOfWeek: 6, opensAt: "09:00", closesAt: "16:00", isClosed: false }
];

export const demoBusinessHourExceptions: BusinessHourException[] = [];

export const demoStylists: Stylist[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Nina Park",
    bioEn: "Precision cuts, soft layers, and lived-in styling.",
    bioZh: "\u7cbe\u51c6\u526a\u53d1\u3001\u67d4\u548c\u5c42\u6b21\u548c\u81ea\u7136\u9020\u578b\u3002",
    bio: "Precision cuts, soft layers, and lived-in styling.",
    specialtiesEn: ["Cuts", "Layers", "Blowouts"],
    specialtiesZh: ["\u526a\u53d1", "\u5c42\u6b21", "\u5439\u98ce\u9020\u578b"],
    specialties: ["Cuts", "Layers", "Blowouts"],
    serviceIds: [demoServices[0].id, demoServices[2].id],
    isActive: true,
    displayOrder: 1
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Theo Brooks",
    bioEn: "Gloss, dimensional color, and healthy shine treatments.",
    bioZh: "\u4e13\u6ce8\u4eae\u6cfd\u3001\u7acb\u4f53\u67d3\u53d1\u548c\u5065\u5eb7\u5149\u6cfd\u62a4\u7406\u3002",
    bio: "Gloss, dimensional color, and healthy shine treatments.",
    specialtiesEn: ["Gloss", "Color", "Treatments"],
    specialtiesZh: ["\u4eae\u6cfd", "\u67d3\u53d1", "\u62a4\u7406"],
    specialties: ["Gloss", "Color", "Treatments"],
    serviceIds: [demoServices[1].id, demoServices[3].id, demoServices[2].id],
    isActive: true,
    displayOrder: 2
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Mara Lee",
    bioEn: "Full color transformations and polished event styling.",
    bioZh: "\u64c5\u957f\u5168\u5934\u67d3\u53d1\u8f6c\u53d8\u548c\u7cbe\u81f4\u6d3b\u52a8\u9020\u578b\u3002",
    bio: "Full color transformations and polished event styling.",
    specialtiesEn: ["Full Color", "Styling"],
    specialtiesZh: ["\u5168\u5934\u67d3\u53d1", "\u9020\u578b"],
    specialties: ["Full Color", "Styling"],
    serviceIds: [demoServices[0].id, demoServices[2].id, demoServices[3].id],
    isActive: true,
    displayOrder: 3
  }
];

export const demoStylistHours: StylistHour[] = [
  {
    id: "theo-monday-hours",
    stylistId: demoStylists[1].id,
    dayOfWeek: 1,
    opensAt: "11:00",
    closesAt: "18:00",
    isClosed: false,
    usesSalonHours: false
  },
  {
    id: "theo-saturday-hours",
    stylistId: demoStylists[1].id,
    dayOfWeek: 6,
    opensAt: "09:00",
    closesAt: "16:00",
    isClosed: true,
    usesSalonHours: false
  },
  {
    id: "mara-friday-hours",
    stylistId: demoStylists[2].id,
    dayOfWeek: 5,
    opensAt: "09:00",
    closesAt: "15:00",
    isClosed: false,
    usesSalonHours: false
  }
];

export const demoAppointments: Appointment[] = [
  {
    id: "demo-appt-1",
    bookingReference: "FW-DEMO01",
    serviceId: demoServices[0].id,
    serviceNameSnapshot: demoServices[0].name,
    serviceNameZhSnapshot: demoServices[0].nameZh,
    serviceDurationMinutesSnapshot: demoServices[0].durationMinutes,
    servicePriceCentsSnapshot: demoServices[0].priceCents,
    customerName: "Maya Chen",
    customerEmail: "maya@example.com",
    customerPhone: "212-555-0101",
    stylistId: demoStylists[0].id,
    stylistNameSnapshot: demoStylists[0].name,
    notes: "First visit. Wants a low-maintenance shape.",
    internalNotes: "Usually asks for soft face-framing layers.",
    startsAt: nextDemoDateAt("14:00"),
    endsAt: nextDemoDateAt("15:00"),
    status: "confirmed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "demo-appt-previous-1",
    bookingReference: "FW-DEMO00",
    serviceId: demoServices[2].id,
    serviceNameSnapshot: demoServices[2].name,
    serviceNameZhSnapshot: demoServices[2].nameZh,
    serviceDurationMinutesSnapshot: demoServices[2].durationMinutes,
    servicePriceCentsSnapshot: demoServices[2].priceCents,
    customerName: "Maya Chen",
    customerEmail: "maya@example.com",
    customerPhone: "212-555-0101",
    stylistId: demoStylists[2].id,
    stylistNameSnapshot: demoStylists[2].name,
    notes: "Asked for a bouncy finish with loose waves.",
    internalNotes: "Prefers lower heat around the fringe.",
    startsAt: "2026-06-19T15:00:00.000Z",
    endsAt: "2026-06-19T15:45:00.000Z",
    status: "completed",
    createdAt: "2026-06-12T14:00:00.000Z",
    updatedAt: "2026-06-19T16:00:00.000Z"
  }
];

export const demoGalleryPhotos: GalleryPhoto[] = [
  {
    id: "gallery-demo-1",
    storagePath: "demo/salon-floor.jpg",
    imageUrl: "/assets/salon-hero.png",
    altText: "Fancy Wave salon styling floor",
    altTextEn: "Fancy Wave salon styling floor",
    altTextZh: "\u6c99\u9f99\u9020\u578b\u533a",
    caption: "A calm, polished space on Roosevelt Ave.",
    displayOrder: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "gallery-demo-2",
    storagePath: "demo/color-station.jpg",
    imageUrl: "/assets/salon-hero.png",
    altText: "Hair color and blowout station",
    altTextEn: "Hair color and blowout station",
    altTextZh: "\u67d3\u53d1\u548c\u5439\u98ce\u5de5\u4f4d",
    caption: "Ready for color, cuts, and everyday shine.",
    displayOrder: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "gallery-demo-3",
    storagePath: "demo/guest-chair.jpg",
    imageUrl: "/assets/salon-hero.png",
    altText: "Guest chair inside Fancy Wave Beauty Salon",
    altTextEn: "Guest chair inside Fancy Wave Beauty Salon",
    altTextZh: "\u6c99\u9f99\u5ba2\u4eba\u5ea7\u6905",
    caption: "Fresh appointments, friendly staff, clean finish.",
    displayOrder: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const demoTokenLookup = new Map<string, string>([["demo-token", "demo-appt-1"]]);

function nextDemoDateAt(time: string): string {
  const now = new Date();
  const date = nextOpenDemoDate(now);

  return zonedDateAndTimeToUtc(date, time, demoSettings.timezone).toISOString();
}

function nextOpenDemoDate(now: Date): string {
  for (let dayOffset = 1; dayOffset <= 14; dayOffset += 1) {
    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset
    ));
    const hours = demoBusinessHours.find(
      (businessHour) => businessHour.dayOfWeek === candidate.getUTCDay()
    );

    if (hours && !hours.isClosed) {
      return candidate.toISOString().slice(0, 10);
    }
  }

  throw new Error("No open demo business day found");
}
