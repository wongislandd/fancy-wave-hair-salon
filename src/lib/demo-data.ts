import type { Appointment, BusinessHour, Service, SalonSettings } from "./types";

export const demoSettings: SalonSettings = {
  salonName: "Fancy Wave Hair Salon",
  timezone: "UTC",
  slotIntervalMinutes: 30,
  minBookingNoticeMinutes: 120,
  cancellationCutoffMinutes: 60
};

export const demoServices: Service[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Signature Haircut",
    description: "Wash, precision cut, and a soft finish.",
    durationMinutes: 60,
    priceCents: 6500,
    isActive: true,
    displayOrder: 1
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Gloss Treatment",
    description: "Tone refresh and shine treatment for luminous color.",
    durationMinutes: 45,
    priceCents: 8500,
    isActive: true,
    displayOrder: 2
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Blowout Styling",
    description: "Smooth, voluminous styling for everyday polish.",
    durationMinutes: 45,
    priceCents: 5500,
    isActive: true,
    displayOrder: 3
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Full Color",
    description: "All-over color consultation, application, and finish.",
    durationMinutes: 120,
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

export const demoAppointments: Appointment[] = [
  {
    id: "demo-appt-1",
    bookingReference: "FW-DEMO01",
    serviceId: demoServices[0].id,
    serviceNameSnapshot: demoServices[0].name,
    serviceDurationMinutesSnapshot: demoServices[0].durationMinutes,
    servicePriceCentsSnapshot: demoServices[0].priceCents,
    customerName: "Maya Chen",
    customerEmail: "maya@example.com",
    customerPhone: "212-555-0101",
    startsAt: nextDemoDateAt("14:00"),
    endsAt: nextDemoDateAt("15:00"),
    status: "confirmed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const demoTokenLookup = new Map<string, string>([["demo-token", "demo-appt-1"]]);

function nextDemoDateAt(time: string): string {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const [hours, minutes] = time.split(":").map(Number);
  day.setUTCHours(hours, minutes, 0, 0);
  return day.toISOString();
}
