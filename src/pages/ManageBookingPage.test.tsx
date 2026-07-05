// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { cancelManagedBooking } from "../lib/data";
import { ManageBookingPage } from "./ManageBookingPage";
import type { ManageableBooking } from "../lib/types";

const confettiMock = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({
  default: confettiMock
}));

const booking: ManageableBooking = {
  bookingReference: "FW-123456",
  serviceId: "service-1",
  serviceName: "Signature Cut",
  serviceNameZh: "Signature Cut",
  serviceDurationMinutes: 45,
  servicePriceCents: 4800,
  servicePriceMaxCents: null,
  servicePriceIsStartingAt: false,
  customerName: "Mina Chen",
  customerEmail: "mina@example.com",
  customerPhone: "555-0100",
  stylistId: "stylist-1",
  stylistName: "Nina Park",
  notes: null,
  startsAt: "2026-07-07T14:00:00.000Z",
  endsAt: "2026-07-07T14:45:00.000Z",
  status: "confirmed",
  canManageOnline: true
};

vi.mock("../lib/data", () => ({
  cancelManagedBooking: vi.fn(),
  getAvailableSlots: vi.fn(async () => []),
  listPublicServices: vi.fn(async () => []),
  loadBookingByToken: vi.fn(async () => booking),
  nextBookableDates: vi.fn(() => ["2026-07-06"]),
  rescheduleManagedBooking: vi.fn()
}));

function renderConfirmedBooking({
  state,
  token = "fresh-token"
}: {
  state?: unknown;
  token?: string;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[{ pathname: `/booking-confirmed/${token}`, state }]}>
          <Routes>
            <Route path="/booking-confirmed/:token" element={<ManageBookingPage confirmed />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("ManageBookingPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
    window.sessionStorage.clear();
    confettiMock.mockClear();
    vi.mocked(cancelManagedBooking).mockClear();
  });

  it("shows confetti after a freshly completed booking", async () => {
    renderConfirmedBooking({ state: { bookingJustCompleted: true } });

    expect(await screen.findByText("FW-123456")).toBeTruthy();
    await waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(3));
  });

  it("does not show confetti when the confirmation page is revisited directly", async () => {
    renderConfirmedBooking({ token: "revisit-token" });

    expect(await screen.findByText("FW-123456")).toBeTruthy();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("does not replay confetti for the same confirmation token in one session", async () => {
    const firstRender = renderConfirmedBooking({ state: { bookingJustCompleted: true } });

    expect(await screen.findByText("FW-123456")).toBeTruthy();
    await waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(3));

    firstRender.unmount();
    confettiMock.mockClear();
    renderConfirmedBooking({ state: { bookingJustCompleted: true } });

    expect(await screen.findByText("FW-123456")).toBeTruthy();
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it("offers Google and Apple calendar links from the loaded booking", async () => {
    const user = userEvent.setup();
    renderConfirmedBooking({ token: "calendar-token" });

    const addButton = await screen.findByRole("button", {
      name: /add to calendar/i
    });
    await user.click(addButton);

    const googleLink = screen.getByRole("menuitem", { name: "Google Calendar" });
    const appleLink = screen.getByRole("menuitem", { name: "Apple Calendar" });
    const googleUrl = new URL(googleLink.getAttribute("href")!);
    const ics = decodeURIComponent(
      appleLink.getAttribute("href")!.replace("data:text/calendar;charset=utf-8,", "")
    );

    expect(googleUrl.searchParams.get("text")).toBe(
      "Signature Cut at Fancy Wave Beauty Salon"
    );
    expect(googleUrl.searchParams.get("dates")).toBe(
      "20260707T140000Z/20260707T144500Z"
    );
    expect(googleUrl.searchParams.get("details")).toContain("Nina Park");
    expect(appleLink.getAttribute("download")).toBe("fancy-wave-fw-123456.ics");
    expect(ics).toContain("DTSTART:20260707T140000Z");
    expect(ics).toContain("DTEND:20260707T144500Z");
    expect(ics).toContain("Booking reference: FW-123456");
  });

  it("asks for confirmation before cancelling a managed booking", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    renderConfirmedBooking({ token: "cancel-token" });

    const cancelButton = await screen.findByRole("button", {
      name: "Cancel appointment"
    });
    await user.click(cancelButton);

    expect(confirmSpy).toHaveBeenCalledWith("Cancel this appointment? This cannot be undone.");
    expect(cancelManagedBooking).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
