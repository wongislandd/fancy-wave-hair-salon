import { z } from "zod";
import type {
  Appointment,
  AppointmentStatus,
  AvailableSlot,
  BusinessHour,
  Service
} from "./types";

export const DEFAULT_SALON_TIME_ZONE = "America/New_York";

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

export function formatPrice(priceCents: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(priceCents / 100);
}

export type ServicePriceRange = {
  priceCents: number;
  priceMaxCents?: number | null;
  priceIsStartingAt?: boolean;
};

export function formatPriceRange(price: ServicePriceRange, locale = "en-US"): string {
  const formattedBase = formatPrice(price.priceCents, locale);

  if (price.priceIsStartingAt) {
    return `${formattedBase}+`;
  }

  if (
    typeof price.priceMaxCents === "number" &&
    price.priceMaxCents > price.priceCents
  ) {
    return `${formattedBase}-${formatPrice(price.priceMaxCents, locale)}`;
  }

  return formattedBase;
}

export function formatAppointmentRange(
  startsAt: string,
  endsAt: string,
  timeZone = DEFAULT_SALON_TIME_ZONE,
  locale = "en-US"
): string {
  return `${formatDateTimeInTimeZone(new Date(startsAt), timeZone, locale)} - ${formatTimeInTimeZone(
    new Date(endsAt),
    timeZone,
    locale
  )}`;
}

export interface DeriveAvailableSlotsInput {
  date: string;
  service: Service;
  businessHours: BusinessHour[];
  existingAppointments: Appointment[];
  salonTimeZone: string;
  slotIntervalMinutes: number;
  stylistId: string;
  stylistName?: string;
  now: Date;
}

export function deriveAvailableSlots({
  date,
  service,
  businessHours,
  existingAppointments,
  salonTimeZone,
  slotIntervalMinutes,
  stylistId,
  stylistName = "",
  now
}: DeriveAvailableSlotsInput): AvailableSlot[] {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayOfWeek = dayStart.getUTCDay();
  const hours = businessHours.find((hour) => hour.dayOfWeek === dayOfWeek);

  if (!hours || hours.isClosed) {
    return [];
  }

  const open = zonedDateAndTimeToUtc(date, hours.opensAt, salonTimeZone);
  const close = zonedDateAndTimeToUtc(date, hours.closesAt, salonTimeZone);
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
          appointment.stylistId === stylistId &&
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
      label: formatSlotLabel(startsAt, salonTimeZone),
      stylistId,
      stylistName
    });
  }

  return slots;
}

export function zonedDateAndTimeToUtc(
  date: string,
  time: string,
  timeZone: string
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  let instant = new Date(localAsUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offset = getTimeZoneOffsetMs(instant, timeZone);
    instant = new Date(localAsUtc - offset);
  }

  return instant;
}

export function dateKeyInTimeZone(
  value: string | Date,
  timeZone = DEFAULT_SALON_TIME_ZONE
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = partsForDate(date, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function minutesIntoDayInTimeZone(
  value: string | Date,
  timeZone = DEFAULT_SALON_TIME_ZONE
): number {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = partsForDate(date, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function hourInTimeZone(
  value: string | Date,
  timeZone = DEFAULT_SALON_TIME_ZONE
): number {
  return Math.floor(minutesIntoDayInTimeZone(value, timeZone) / 60);
}

export function formatTimeInTimeZone(
  value: string | Date,
  timeZone = DEFAULT_SALON_TIME_ZONE,
  locale = "en-US"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatDateInTimeZone(
  value: string | Date,
  timeZone = DEFAULT_SALON_TIME_ZONE,
  options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" },
  locale = "en-US"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
}

export function formatDateKeyInTimeZone(
  dateKey: string,
  timeZone = DEFAULT_SALON_TIME_ZONE,
  options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" },
  locale = "en-US"
): string {
  return formatDateInTimeZone(
    zonedDateAndTimeToUtc(dateKey, "12:00", timeZone),
    timeZone,
    options,
    locale
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  const zonedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return zonedAsUtc - date.getTime();
}

function formatSlotLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDateTimeInTimeZone(date: Date, timeZone: string, locale = "en-US"): string {
  if (locale !== "en-US") {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  const parts = partsForDate(date, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return `${parts.weekday}, ${parts.month} ${parts.day} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function partsForDate(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, ...options })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
