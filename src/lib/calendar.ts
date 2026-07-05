import { addDays, startOfDay, startOfWeek } from "date-fns";
import {
  DEFAULT_SALON_TIME_ZONE,
  dateKeyInTimeZone,
  minutesIntoDayInTimeZone,
  zonedDateAndTimeToUtc
} from "./booking";
import {
  salonAddress as defaultSalonAddress,
  salonName as defaultSalonName
} from "./salon";
import type { Appointment } from "./types";

export type CalendarViewMode = "day" | "threeDay" | "week";

export interface CalendarEventLayout {
  appointment: Appointment;
  topPercent: number;
  heightPercent: number;
  lane: number;
  laneCount: number;
}

export interface CalendarDraftSelection {
  date: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  startMinutes: number;
  endMinutes: number;
}

export interface BuildCalendarDraftSelectionInput {
  day: Date;
  startPointerY: number;
  currentPointerY: number;
  hourHeightPx: number;
  startHour: number;
  endHour: number;
  snapMinutes?: number;
  minDurationMinutes?: number;
  timeZone?: string;
}

export interface AppointmentCalendarDetails {
  bookingReference: string;
  serviceName: string;
  stylistName: string;
  startsAt: string;
  endsAt: string;
  manageUrl?: string;
  salonName?: string;
  salonAddress?: string;
  timeZone?: string;
  generatedAt?: Date;
}

export interface AppointmentCalendarLinks {
  googleUrl: string;
  icsDataUri: string;
  fileName: string;
}

export function buildAppointmentCalendarLinks({
  bookingReference,
  serviceName,
  stylistName,
  startsAt,
  endsAt,
  manageUrl,
  salonName = defaultSalonName,
  salonAddress = defaultSalonAddress,
  timeZone = DEFAULT_SALON_TIME_ZONE,
  generatedAt = new Date()
}: AppointmentCalendarDetails): AppointmentCalendarLinks {
  const summary = `${serviceName} at ${salonName}`;
  const location = `${salonName}, ${salonAddress}`;
  const description = [
    `Stylist: ${stylistName}`,
    `Booking reference: ${bookingReference}`,
    manageUrl ? `Manage booking: ${manageUrl}` : ""
  ].filter(Boolean).join("\n");
  const dates = `${formatUtcCalendarDate(startsAt)}/${formatUtcCalendarDate(endsAt)}`;
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates,
    details: description,
    location,
    ctz: timeZone
  });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${salonName}//Appointment Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${calendarUid(bookingReference)}`,
    `DTSTAMP:${formatUtcCalendarDate(generatedAt)}`,
    `DTSTART:${formatUtcCalendarDate(startsAt)}`,
    `DTEND:${formatUtcCalendarDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "STATUS:CONFIRMED",
    manageUrl ? `URL;VALUE=URI:${manageUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  return {
    googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    icsDataUri: `data:text/calendar;charset=utf-8,${encodeURIComponent(`${ics}\r\n`)}`,
    fileName: `fancy-wave-${fileSafeToken(bookingReference)}.ics`
  };
}

export function getCalendarViewDays(
  anchorDate: Date,
  view: CalendarViewMode
): Date[] {
  const start =
    view === "week"
      ? startOfWeek(anchorDate, { weekStartsOn: 0 })
      : startOfDay(anchorDate);
  const count = view === "day" ? 1 : view === "threeDay" ? 3 : 7;

  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function moveCalendarAnchor(
  anchorDate: Date,
  view: CalendarViewMode,
  direction: -1 | 1
): Date {
  const days = view === "day" ? 1 : view === "threeDay" ? 3 : 7;
  return addDays(anchorDate, days * direction);
}

export function buildCalendarDayLayouts(
  appointments: Appointment[],
  day: Date,
  startHour: number,
  endHour: number,
  timeZone = DEFAULT_SALON_TIME_ZONE
): CalendarEventLayout[] {
  const dayKey = dateKeyInTimeZone(day, timeZone);
  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const rangeMinutes = rangeEndMinutes - rangeStartMinutes;
  const laneEnds: number[] = [];

  const layouts = appointments
    .filter((appointment) => dateKeyInTimeZone(appointment.startsAt, timeZone) === dayKey)
    .map((appointment) => {
      const startMinutes = minutesIntoDayInTimeZone(appointment.startsAt, timeZone);
      const endMinutes = minutesIntoDayInTimeZone(appointment.endsAt, timeZone);
      return {
        appointment,
        startMinutes: Math.max(startMinutes, rangeStartMinutes),
        endMinutes: Math.min(endMinutes, rangeEndMinutes)
      };
    })
    .filter((event) => event.endMinutes > rangeStartMinutes && event.startMinutes < rangeEndMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
    .map((event) => {
      const lane = firstAvailableLane(laneEnds, event.startMinutes);
      laneEnds[lane] = event.endMinutes;

      return {
        appointment: event.appointment,
        topPercent: ((event.startMinutes - rangeStartMinutes) / rangeMinutes) * 100,
        heightPercent: Math.max(((event.endMinutes - event.startMinutes) / rangeMinutes) * 100, 4),
        lane,
        laneCount: 1
      };
    });

  const laneCount = Math.max(1, laneEnds.length);
  return layouts.map((layout) => ({ ...layout, laneCount }));
}

export function calendarPointerYToMinutes(
  pointerY: number,
  hourHeightPx: number,
  startHour: number,
  endHour: number
): number {
  const rangeStartMinutes = startHour * 60;
  const totalHeight = (endHour - startHour) * hourHeightPx;
  const clampedY = clamp(pointerY, 0, totalHeight);

  return rangeStartMinutes + (clampedY / hourHeightPx) * 60;
}

export function buildCalendarDraftSelection({
  day,
  startPointerY,
  currentPointerY,
  hourHeightPx,
  startHour,
  endHour,
  snapMinutes = 30,
  minDurationMinutes = 30,
  timeZone = DEFAULT_SALON_TIME_ZONE
}: BuildCalendarDraftSelectionInput): CalendarDraftSelection {
  const rangeStartMinutes = startHour * 60;
  const rangeEndMinutes = endHour * 60;
  const rawStart = calendarPointerYToMinutes(startPointerY, hourHeightPx, startHour, endHour);
  const rawEnd = calendarPointerYToMinutes(currentPointerY, hourHeightPx, startHour, endHour);
  const lower = Math.min(rawStart, rawEnd);
  const upper = Math.max(rawStart, rawEnd);
  const latestStart = rangeEndMinutes - minDurationMinutes;
  const startMinutes = clamp(
    Math.floor(lower / snapMinutes) * snapMinutes,
    rangeStartMinutes,
    latestStart
  );
  const endMinutes = clamp(
    Math.ceil(upper / snapMinutes) * snapMinutes,
    startMinutes + minDurationMinutes,
    rangeEndMinutes
  );
  const date = dateKeyInTimeZone(day, timeZone);

  return {
    date,
    startsAt: zonedDateAndTimeToUtc(date, minutesToTime(startMinutes), timeZone).toISOString(),
    endsAt: zonedDateAndTimeToUtc(date, minutesToTime(endMinutes), timeZone).toISOString(),
    durationMinutes: endMinutes - startMinutes,
    startMinutes,
    endMinutes
  };
}

function firstAvailableLane(laneEnds: number[], startMinutes: number): number {
  const lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMinutes);
  return lane === -1 ? laneEnds.length : lane;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function formatUtcCalendarDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function calendarUid(bookingReference: string): string {
  return `${fileSafeToken(bookingReference)}@fancy-wave-beauty-salon`;
}

function fileSafeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "appointment";
}
