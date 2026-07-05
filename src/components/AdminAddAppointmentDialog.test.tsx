// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAddAppointmentDialog } from "./AdminAddAppointmentDialog";
import { LanguageProvider } from "../lib/i18n";
import { getAvailableSlots, listPublicStylists } from "../lib/data";
import type { CalendarDraftSelection } from "../lib/calendar";
import type { Stylist } from "../lib/types";

const stylists: Stylist[] = [
  {
    id: "stylist-1",
    name: "Nina Park",
    bio: "Precision cuts and polish.",
    specialties: ["Cuts"],
    serviceIds: ["service-1"],
    isActive: true,
    displayOrder: 1
  }
];

const draggedSelection: CalendarDraftSelection = {
  date: "2026-07-20",
  startsAt: "2026-07-20T14:00:00.000Z",
  endsAt: "2026-07-20T14:30:00.000Z",
  durationMinutes: 30,
  startMinutes: 600,
  endMinutes: 630
};

vi.mock("../lib/data", () => ({
  bookStaffAppointment: vi.fn(),
  getAvailableSlots: vi.fn(async () => []),
  listPublicServices: vi.fn(async () => [
    {
      id: "service-1",
      nameEn: "Signature Haircut",
      nameZh: "招牌剪发",
      descriptionEn: "Cut, wash, and finish",
      descriptionZh: "洗发、精剪和造型",
      name: "Signature Haircut",
      description: "Cut, wash, and finish",
      durationMinutes: 60,
      priceCents: 6500,
      isActive: true,
      displayOrder: 1
    }
  ]),
  listPublicStylists: vi.fn(async () => stylists),
  nextBookableDates: vi.fn(() => ["2026-07-06"])
}));

function renderAdminAddAppointmentDialog(initialSelection?: CalendarDraftSelection) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AdminAddAppointmentDialog
          initialSelection={initialSelection}
          onClose={vi.fn()}
        />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AdminAddAppointmentDialog", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
    vi.mocked(getAvailableSlots).mockResolvedValue([]);
    vi.mocked(listPublicStylists).mockResolvedValue(stylists);
  });

  it("renders the staff booking form with optional contact fields", async () => {
    renderAdminAddAppointmentDialog();

    expect(screen.getByRole("heading", { name: "Add appointment" })).toBeTruthy();
    expect(await screen.findByText("Signature Haircut")).toBeTruthy();
    expect(screen.getByLabelText("Guest name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
  });

  it("hides date choices until service and stylist are selected", async () => {
    renderAdminAddAppointmentDialog();

    expect(await screen.findByText("Signature Haircut")).toBeTruthy();
    expect(screen.getByText("Choose a service and stylist to see times.")).toBeTruthy();
    expect(screen.queryByText("Mon")).toBeNull();
    expect(screen.queryByText("Jul 6")).toBeNull();
  });

  it("opens with a dragged date and auto-selects the matching available slot", async () => {
    const user = userEvent.setup();
    vi.mocked(getAvailableSlots).mockResolvedValue([
      {
        startsAt: draggedSelection.startsAt,
        endsAt: "2026-07-20T15:00:00.000Z",
        label: "10:00 AM",
        stylistId: "stylist-1",
        stylistName: "Nina Park"
      }
    ]);

    renderAdminAddAppointmentDialog(draggedSelection);

    expect(screen.getByText("Draft time")).toBeTruthy();
    expect(screen.getByText("Monday, July 20, 10:00 AM - 10:30 AM")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Signature Haircut 60 min / $65" }));
    await user.click(await screen.findByRole("button", { name: "Nina Park Cuts" }));

    expect(await screen.findByRole("button", { name: "Mon Jul 20" })).toBeTruthy();
    expect(await screen.findByText("Signature Haircut with Nina Park")).toBeTruthy();
    expect(screen.getByText("The selected service will block 60 minutes on the calendar.")).toBeTruthy();
  });

  it("shows a clear message when the dragged start is unavailable", async () => {
    const user = userEvent.setup();
    vi.mocked(getAvailableSlots).mockResolvedValue([
      {
        startsAt: "2026-07-20T15:00:00.000Z",
        endsAt: "2026-07-20T16:00:00.000Z",
        label: "11:00 AM",
        stylistId: "stylist-1",
        stylistName: "Nina Park"
      }
    ]);

    renderAdminAddAppointmentDialog(draggedSelection);

    await user.click(await screen.findByRole("button", { name: "Signature Haircut 60 min / $65" }));
    await user.click(await screen.findByRole("button", { name: "Nina Park Cuts" }));

    expect(await screen.findByText("That dragged start time is not available for this service and stylist. Pick another time below.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "11:00 AM Nina Park" })).toBeTruthy();
  });
});
