// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { deleteService, saveService, updateServiceOrder } from "../lib/data";
import { AdminServicesPage } from "./AdminServicesPage";
import type { Service, Stylist } from "../lib/types";

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

const stylists: Stylist[] = [
  {
    id: "stylist-nina",
    name: "Nina Park",
    bio: "Precision cuts and polish.",
    specialties: ["Cuts"],
    serviceIds: ["service-exact", "service-range"],
    isActive: true,
    displayOrder: 1
  },
  {
    id: "stylist-mara",
    name: "Mara Lee",
    bio: "Color and transformations.",
    specialties: ["Color"],
    serviceIds: ["service-open"],
    isActive: true,
    displayOrder: 2
  }
];

vi.mock("../lib/data", () => ({
  deleteService: vi.fn(),
  isStaffSignedIn: vi.fn(async () => true),
  listAdminServices: vi.fn(async () => services),
  listAdminStylists: vi.fn(async () => stylists),
  saveService: vi.fn(),
  updateServiceOrder: vi.fn()
}));

function renderAdminServicesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={["/admin/services"]}>
          <AdminServicesPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AdminServicesPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
    vi.mocked(deleteService).mockReset();
    vi.mocked(saveService).mockReset();
    vi.mocked(updateServiceOrder).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows exact, bounded range, and plus prices in stylist coverage", async () => {
    renderAdminServicesPage();

    expect(await screen.findByRole("heading", { name: "Stylist coverage" })).toBeTruthy();
    expect(screen.getAllByText("30 min / $28").length).toBeGreaterThan(0);
    expect(screen.getAllByText("45 min / $28-$60").length).toBeGreaterThan(0);
    expect(screen.getAllByText("120 min / $165+").length).toBeGreaterThan(0);
  });

  it("shows save failures instead of silently leaving old service prices", async () => {
    vi.mocked(saveService).mockRejectedValueOnce(
      new Error("column services.price_max_cents does not exist")
    );
    const user = userEvent.setup();

    renderAdminServicesPage();

    await user.click(await screen.findByRole("button", { name: "Men's Haircut 30 min / $28 Active" }));
    await user.click(screen.getByRole("button", { name: "Save service" }));

    expect(await screen.findByText("column services.price_max_cents does not exist")).toBeTruthy();
  });

  it("saves customer duration separately from calendar block duration", async () => {
    const user = userEvent.setup();

    renderAdminServicesPage();

    await user.click(await screen.findByRole("button", { name: "Men's Haircut 30 min / $28 Active" }));
    await user.clear(screen.getByLabelText("Shown to customers"));
    await user.type(screen.getByLabelText("Shown to customers"), "240");
    await user.clear(screen.getByLabelText("Blocks calendar"));
    await user.type(screen.getByLabelText("Blocks calendar"), "60");
    await user.click(screen.getByRole("button", { name: "Save service" }));

    expect(saveService).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMinutes: 240,
        calendarBlockMinutes: 60
      }),
      "service-exact"
    );
    expect(screen.getByTitle("The duration guests see in booking, confirmations, and service details.")).toBeTruthy();
    expect(screen.getByTitle("How long this service makes the stylist unavailable on the salon calendar.")).toBeTruthy();
  });

  it("saves the admin service order when a service is moved", async () => {
    const user = userEvent.setup();

    renderAdminServicesPage();

    await screen.findByRole("heading", { name: "Stylist coverage" });
    await user.click(screen.getAllByRole("button", { name: "Move service down" })[0]);

    expect(vi.mocked(updateServiceOrder).mock.calls[0][0]).toEqual([
      "service-range",
      "service-exact",
      "service-open"
    ]);
  });

  it("deletes a selected service after staff confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    renderAdminServicesPage();

    await user.click(await screen.findByRole("button", { name: /Gloss Treatment 45 min/ }));
    await user.click(screen.getByRole("button", { name: "Delete service" }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Gloss Treatment"));
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith("service-range"));
  });
});
