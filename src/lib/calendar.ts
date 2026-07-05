import { addDays, startOfDay, startOfWeek } from "date-fns";
import {
  DEFAULT_SALON_TIME_ZONE,
  dateKeyInTimeZone,
  minutesIntoDayInTimeZone
} from "./booking";
import type { Appointment } from "./types";

export type CalendarViewMode = "day" | "threeDay" | "week";

export interface CalendarEventLayout {
  appointment: Appointment;
  topPercent: number;
  heightPercent: number;
  lane: number;
  laneCount: number;
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

function firstAvailableLane(laneEnds: number[], startMinutes: number): number {
  const lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMinutes);
  return lane === -1 ? laneEnds.length : lane;
}
