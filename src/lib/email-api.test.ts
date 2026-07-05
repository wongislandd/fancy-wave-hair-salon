import { describe, expect, it, vi } from "vitest";
import { sendBookingEmailBestEffort } from "./email-api";

describe("booking email function wrapper", () => {
  it("invokes the Supabase Edge Function with the booking email request", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });

    await sendBookingEmailBestEffort({ functions: { invoke } }, {
      appointmentId: "appt-1",
      kind: "booking_confirmation",
      managementToken: "manage-token"
    });

    expect(invoke).toHaveBeenCalledWith("send-booking-email", {
      body: {
        appointmentId: "appt-1",
        kind: "booking_confirmation",
        managementToken: "manage-token"
      }
    });
  });

  it("does not throw when the email function fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "SMTP credentials are missing" }
    });

    await expect(
      sendBookingEmailBestEffort({ functions: { invoke } }, {
        appointmentId: "appt-1",
        kind: "booking_confirmation",
        managementToken: "manage-token"
      })
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      "Booking email was not sent",
      expect.objectContaining({ message: "SMTP credentials are missing" })
    );
    warn.mockRestore();
  });
});
