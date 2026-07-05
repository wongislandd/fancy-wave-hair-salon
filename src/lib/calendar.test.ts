import { describe, expect, it } from "vitest";
import {
  buildCalendarDayLayouts,
  getCalendarViewDays,
  moveCalendarAnchor
} from "./calendar";
import type { Appointment } from "./types";

describe("calendar helpers", () => {
  it("builds day, 3-day, and week ranges from an anchor date", () => {
    expect(
      getCalendarViewDays(new Date("2026-07-06T12:00:00.000Z"), "day").map((day) =>
        day.toISOString().slice(0, 10)
      )
    ).toEqual(["2026-07-06"]);

    expect(
      getCalendarViewDays(new Date("2026-07-06T12:00:00.000Z"), "threeDay").map((day) =>
        day.toISOString().slice(0, 10)
      )
    ).toEqual(["2026-07-06", "2026-07-07", "2026-07-08"]);

    expect(
      getCalendarViewDays(new Date("2026-07-08T12:00:00.000Z"), "week").map((day) =>
        day.toISOString().slice(0, 10)
      )
    ).toEqual([
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11"
    ]);
  });

  it("moves the anchor by the active view size", () => {
    expect(moveCalendarAnchor(new Date("2026-07-06T12:00:00.000Z"), "day", 1).toISOString().slice(0, 10)).toBe("2026-07-07");
    expect(moveCalendarAnchor(new Date("2026-07-06T12:00:00.000Z"), "threeDay", 1).toISOString().slice(0, 10)).toBe("2026-07-09");
    expect(moveCalendarAnchor(new Date("2026-07-06T12:00:00.000Z"), "week", -1).toISOString().slice(0, 10)).toBe("2026-06-29");
  });

  it("places overlapping appointments into separate lanes", () => {
    const layouts = buildCalendarDayLayouts(
      [
        appointment("appt-1", "stylist-1", "2026-07-06T13:00:00.000Z", "2026-07-06T14:00:00.000Z"),
        appointment("appt-2", "stylist-2", "2026-07-06T13:30:00.000Z", "2026-07-06T14:15:00.000Z"),
        appointment("appt-3", "stylist-3", "2026-07-06T15:00:00.000Z", "2026-07-06T16:00:00.000Z")
      ],
      new Date("2026-07-06T12:00:00.000Z"),
      8,
      20
    );

    expect(layouts).toHaveLength(3);
    expect(layouts[0].lane).toBe(0);
    expect(layouts[1].lane).toBe(1);
    expect(layouts[0].laneCount).toBe(2);
    expect(layouts[1].laneCount).toBe(2);
    expect(layouts[2].lane).toBe(0);
  });

  it("places appointments on the salon calendar day", () => {
    const layouts = buildCalendarDayLayouts(
      [
        appointment(
          "late-night",
          "stylist-1",
          "2026-07-05T23:30:00.000Z",
          "2026-07-06T00:30:00.000Z"
        )
      ],
      new Date("2026-07-06T12:00:00.000Z"),
      8,
      10,
      "Asia/Tokyo"
    );

    expect(layouts).toHaveLength(1);
    expect(layouts[0].topPercent).toBe(25);
  });
});

function appointment(
  id: string,
  stylistId: string,
  startsAt: string,
  endsAt: string
): Appointment {
  return {
    id,
    bookingReference: `FW-${id}`,
    serviceId: "service-1",
    serviceNameSnapshot: "Signature Haircut",
    serviceDurationMinutesSnapshot: 60,
    servicePriceCentsSnapshot: 6500,
    customerName: id,
    customerEmail: `${id}@example.com`,
    customerPhone: "2125550101",
    stylistId,
    stylistNameSnapshot: stylistId,
    startsAt,
    endsAt,
    status: "confirmed",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z"
  };
}
