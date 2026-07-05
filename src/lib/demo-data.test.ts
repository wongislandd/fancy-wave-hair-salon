import { afterEach, describe, expect, it, vi } from "vitest";

describe("demo data", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("seeds the demo appointment on the next open business day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
    vi.resetModules();

    const { demoAppointments } = await import("./demo-data");

    expect(demoAppointments[0].startsAt).toBe("2026-07-06T18:00:00.000Z");
    expect(demoAppointments[0].endsAt).toBe("2026-07-06T19:00:00.000Z");
  });
});
