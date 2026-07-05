import { describe, expect, it } from "vitest";
import {
  buildAppointmentCalendarLinks,
  buildCalendarDayLayouts,
  buildCalendarDraftSelection,
  calendarPointerYToMinutes,
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

  it("converts calendar pointer positions into visible-day minutes", () => {
    expect(calendarPointerYToMinutes(60, 120, 8, 20)).toBe(510);
    expect(calendarPointerYToMinutes(-24, 120, 8, 20)).toBe(480);
    expect(calendarPointerYToMinutes(2000, 120, 8, 20)).toBe(1200);
  });

  it("builds snapped drag selections with minimum duration and calendar bounds", () => {
    const day = new Date("2026-07-06T12:00:00.000Z");

    expect(
      buildCalendarDraftSelection({
        day,
        startPointerY: 145,
        currentPointerY: 228,
        hourHeightPx: 120,
        startHour: 8,
        endHour: 20,
        timeZone: "America/New_York"
      })
    ).toMatchObject({
      date: "2026-07-06",
      startsAt: "2026-07-06T13:00:00.000Z",
      endsAt: "2026-07-06T14:00:00.000Z",
      durationMinutes: 60,
      startMinutes: 540,
      endMinutes: 600
    });

    expect(
      buildCalendarDraftSelection({
        day,
        startPointerY: 120,
        currentPointerY: 126,
        hourHeightPx: 120,
        startHour: 8,
        endHour: 20,
        timeZone: "America/New_York"
      })
    ).toMatchObject({
      startsAt: "2026-07-06T13:00:00.000Z",
      endsAt: "2026-07-06T13:30:00.000Z",
      durationMinutes: 30
    });

    expect(
      buildCalendarDraftSelection({
        day,
        startPointerY: 2000,
        currentPointerY: 2200,
        hourHeightPx: 120,
        startHour: 8,
        endHour: 20,
        timeZone: "America/New_York"
      })
    ).toMatchObject({
      startsAt: "2026-07-06T23:30:00.000Z",
      endsAt: "2026-07-07T00:00:00.000Z",
      durationMinutes: 30,
      startMinutes: 1170,
      endMinutes: 1200
    });
  });

  it("builds Google and iCal links from the current appointment details", () => {
    const links = buildAppointmentCalendarLinks({
      bookingReference: "FW-8661A33A",
      serviceName: "Gloss Treatment",
      stylistName: "Mara Lee",
      startsAt: "2026-07-06T14:00:00.000Z",
      endsAt: "2026-07-06T14:45:00.000Z",
      manageUrl: "https://example.com/manage-booking/manage-token",
      generatedAt: new Date("2026-07-05T16:00:00.000Z")
    });
    const googleUrl = new URL(links.googleUrl);
    const ics = decodeURIComponent(
      links.icsDataUri.replace("data:text/calendar;charset=utf-8,", "")
    );

    expect(googleUrl.origin).toBe("https://calendar.google.com");
    expect(googleUrl.searchParams.get("action")).toBe("TEMPLATE");
    expect(googleUrl.searchParams.get("text")).toBe(
      "Gloss Treatment at Fancy Wave Beauty Salon"
    );
    expect(googleUrl.searchParams.get("dates")).toBe(
      "20260706T140000Z/20260706T144500Z"
    );
    expect(googleUrl.searchParams.get("ctz")).toBe("America/New_York");
    expect(googleUrl.searchParams.get("location")).toContain(
      "135-45 Roosevelt Ave"
    );
    expect(googleUrl.searchParams.get("details")).toContain("Mara Lee");
    expect(googleUrl.searchParams.get("details")).toContain("FW-8661A33A");
    expect(links.fileName).toBe("fancy-wave-fw-8661a33a.ics");
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(ics).toContain("UID:fw-8661a33a@fancy-wave-beauty-salon");
    expect(ics).toContain("DTSTAMP:20260705T160000Z");
    expect(ics).toContain("DTSTART:20260706T140000Z");
    expect(ics).toContain("DTEND:20260706T144500Z");
    expect(ics).toContain(
      "SUMMARY:Gloss Treatment at Fancy Wave Beauty Salon"
    );
    expect(ics).toContain(
      "LOCATION:Fancy Wave Beauty Salon\\, 135-45 Roosevelt Ave\\, Flushing\\, NY 11354"
    );
    expect(ics).toContain(
      "DESCRIPTION:Stylist: Mara Lee\\nBooking reference: FW-8661A33A\\nManage booking: https://example.com/manage-booking/manage-token"
    );
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
