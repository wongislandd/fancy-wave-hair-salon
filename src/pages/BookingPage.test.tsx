// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { BookingPage } from "./BookingPage";
import type { Service } from "../lib/types";

const services: Service[] = [
  {
    id: "service-exact",
    name: "Men's Haircut",
    nameEn: "Men's Haircut",
    nameZh: "男士剪发",
    description: "Wash, precision cut, and a soft finish.",
    descriptionEn: "Wash, precision cut, and a soft finish.",
    descriptionZh: "洗发、精剪和造型。",
    durationMinutes: 30,
    priceCents: 2800,
    displayOrder: 1,
    isActive: true
  },
  {
    id: "service-range",
    name: "Gloss Treatment",
    nameEn: "Gloss Treatment",
    nameZh: "亮泽护理",
    description: "Tone refresh and shine treatment.",
    descriptionEn: "Tone refresh and shine treatment.",
    descriptionZh: "补色和亮泽护理。",
    durationMinutes: 45,
    priceCents: 2800,
    priceMaxCents: 6000,
    displayOrder: 2,
    isActive: true
  },
  {
    id: "service-open",
    name: "Full Color",
    nameEn: "Full Color",
    nameZh: "全头染发",
    description: "All-over color consultation, application, and finish.",
    descriptionEn: "All-over color consultation, application, and finish.",
    descriptionZh: "染发咨询、全头上色和造型。",
    durationMinutes: 120,
    priceCents: 16500,
    priceIsStartingAt: true,
    displayOrder: 3,
    isActive: true
  }
];

vi.mock("../lib/data", () => ({
  bookAppointment: vi.fn(),
  getAvailableSlots: vi.fn(async () => []),
  listPublicServices: vi.fn(async () => services),
  listPublicStylists: vi.fn(async () => []),
  nextBookableDates: vi.fn(() => ["2026-07-06"])
}));

function renderBookingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>
          <BookingPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("BookingPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
  });

  it("shows exact, bounded range, and plus service prices", async () => {
    renderBookingPage();

    expect(await screen.findByText("Men's Haircut")).toBeTruthy();
    expect(screen.getByText("30 min / $28")).toBeTruthy();
    expect(screen.getByText("45 min / $28-$60")).toBeTruthy();
    expect(screen.getByText("120 min / $165+")).toBeTruthy();
  });
});
