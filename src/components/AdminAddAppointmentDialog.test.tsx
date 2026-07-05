// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAddAppointmentDialog } from "./AdminAddAppointmentDialog";
import { LanguageProvider } from "../lib/i18n";

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
  listPublicStylists: vi.fn(async () => []),
  nextBookableDates: vi.fn(() => ["2026-07-06"])
}));

describe("AdminAddAppointmentDialog", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
  });

  it("renders the staff booking form with optional contact fields", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AdminAddAppointmentDialog onClose={vi.fn()} />
        </LanguageProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Add appointment" })).toBeTruthy();
    expect(await screen.findByText("Signature Haircut")).toBeTruthy();
    expect(screen.getByLabelText("Guest name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
  });

  it("hides date choices until service and stylist are selected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AdminAddAppointmentDialog onClose={vi.fn()} />
        </LanguageProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Signature Haircut")).toBeTruthy();
    expect(screen.getByText("Choose a service and stylist to see times.")).toBeTruthy();
    expect(screen.queryByText("Mon")).toBeNull();
    expect(screen.queryByText("Jul 6")).toBeNull();
  });
});
