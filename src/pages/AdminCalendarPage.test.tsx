// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { AdminCalendarPage } from "./AdminCalendarPage";
import type { Appointment } from "../lib/types";

const mockAddAppointmentDialog = vi.hoisted(() => vi.fn(() => (
  <div data-testid="add-dialog">Add appointment drawer</div>
)));
const mockAppointmentDetailDrawer = vi.hoisted(() => vi.fn(
  ({ appointment }: { appointment: Appointment | null }) => (
    <div data-testid="detail-drawer">{appointment?.customerName ?? "No appointment selected"}</div>
  )
));

const appointments: Appointment[] = [
  {
    id: "appointment-1",
    bookingReference: "FW-TEST01",
    serviceId: "service-1",
    serviceNameSnapshot: "Signature Haircut",
    serviceDurationMinutesSnapshot: 60,
    servicePriceCentsSnapshot: 6500,
    customerName: "Test Guest",
    customerEmail: "guest@example.com",
    customerPhone: "2125550101",
    stylistId: "stylist-1",
    stylistNameSnapshot: "Nina Park",
    startsAt: "2026-07-05T14:00:00.000Z",
    endsAt: "2026-07-05T15:00:00.000Z",
    status: "confirmed",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z"
  }
];

vi.mock("../components/AdminShell", () => ({
  AdminShell: ({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {actions}
      {children}
    </section>
  )
}));

vi.mock("../components/AdminAddAppointmentDialog", () => ({
  AdminAddAppointmentDialog: mockAddAppointmentDialog
}));

vi.mock("../components/AppointmentDetailDrawer", () => ({
  AppointmentDetailDrawer: mockAppointmentDetailDrawer
}));

vi.mock("../lib/data", () => ({
  listAdminAppointments: vi.fn(async () => appointments)
}));

function renderAdminCalendarPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AdminCalendarPage />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function dispatchPointerEvent(
  element: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientY: number
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientY
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(element, event);
}

describe("AdminCalendarPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
    mockAddAppointmentDialog.mockClear();
    mockAppointmentDetailDrawer.mockClear();
  });

  it("opens the add appointment drawer with a dragged calendar range", async () => {
    renderAdminCalendarPage();

    const dayColumn = await screen.findByTitle("Drag to add appointment on Sunday, July 5");
    dispatchPointerEvent(dayColumn, "pointerdown", 136);
    dispatchPointerEvent(dayColumn, "pointermove", 210);
    dispatchPointerEvent(dayColumn, "pointerup", 210);

    expect(await screen.findByTestId("add-dialog")).toBeTruthy();
    expect(mockAddAppointmentDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSelection: expect.objectContaining({
          date: "2026-07-05",
          startsAt: "2026-07-05T13:00:00.000Z",
          endsAt: "2026-07-05T14:00:00.000Z",
          durationMinutes: 60
        })
      }),
      expect.anything()
    );
  });

  it("keeps existing appointment cards clickable for details", async () => {
    const user = userEvent.setup();

    renderAdminCalendarPage();

    await user.click(await screen.findByRole("button", {
      name: "10:00 AM - 11:00 AM, Test Guest, Signature Haircut, Nina Park"
    }));

    expect((await screen.findByTestId("detail-drawer")).textContent).toContain("Test Guest");
    expect(mockAddAppointmentDialog).not.toHaveBeenCalled();
  });
});
