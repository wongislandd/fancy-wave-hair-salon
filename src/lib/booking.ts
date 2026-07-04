import { format } from "date-fns";
import { z } from "zod";
import type {
  Appointment,
  AppointmentStatus,
  AvailableSlot,
  BusinessHour,
  Service
} from "./types";

export const bookingDetailsSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your name"),
  customerEmail: z.string().trim().email("Enter a valid email"),
  customerPhone: z.string().trim().min(7, "Enter a phone number"),
  notes: z.string().trim().max(500).optional().or(z.literal(""))
});

export type BookingDetails = z.infer<typeof bookingDetailsSchema>;

export function buildManageBookingPath(token: string): string {
  return `/manage-booking/${encodeURIComponent(token)}`;
}

export function calculateAppointmentEnd(
  startsAt: string,
  durationMinutes: number
): Date {
  return new Date(new Date(startsAt).getTime() + durationMinutes * 60_000);
}

export function isCustomerManageableStatus(
  status: AppointmentStatus
): boolean {
  return status === "confirmed";
}

export function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(priceCents / 100);
}

export function formatAppointmentRange(
  startsAt: string,
  endsAt: string
): string {
  return `${format(new Date(startsAt), "EEE, MMM d 'at' h:mm a")} - ${format(
    new Date(endsAt),
    "h:mm a"
  )}`;
}

export interface DeriveAvailableSlotsInput {
  date: string;
  service: Service;
  businessHours: BusinessHour[];
  existingAppointments: Appointment[];
  salonTimeZone: string;
  slotIntervalMinutes: number;
  now: Date;
}

export function deriveAvailableSlots({
  date,
  service,
  businessHours,
  existingAppointments,
  slotIntervalMinutes,
  now
}: DeriveAvailableSlotsInput): AvailableSlot[] {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayOfWeek = dayStart.getUTCDay();
  const hours = businessHours.find((hour) => hour.dayOfWeek === dayOfWeek);

  if (!hours || hours.isClosed) {
    return [];
  }

  const open = dateAndTimeToUtc(date, hours.opensAt);
  const close = dateAndTimeToUtc(date, hours.closesAt);
  const slots: AvailableSlot[] = [];
  const durationMs = service.durationMinutes * 60_000;
  const intervalMs = slotIntervalMinutes * 60_000;

  for (
    let cursor = open.getTime();
    cursor + durationMs <= close.getTime();
    cursor += intervalMs
  ) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor + durationMs);

    if (startsAt < now) {
      continue;
    }

    if (
      existingAppointments.some(
        (appointment) =>
          appointment.status === "confirmed" &&
          rangesOverlap(
            startsAt,
            endsAt,
            new Date(appointment.startsAt),
            new Date(appointment.endsAt)
          )
      )
    ) {
      continue;
    }

    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      label: format(startsAt, "h:mm a")
    });
  }

  return slots;
}

function dateAndTimeToUtc(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
