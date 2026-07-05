// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import {
  deleteStylist,
  saveStylist,
  updateStylistHour
} from "../lib/data";
import { AdminStylistsPage } from "./AdminStylistsPage";
import type { Service, Stylist } from "../lib/types";

const services: Service[] = [
  {
    id: "service-cut",
    name: "Haircut",
    nameEn: "Haircut",
    nameZh: "Haircut",
    description: "Clean shape.",
    descriptionEn: "Clean shape.",
    descriptionZh: "Clean shape.",
    durationMinutes: 45,
    priceCents: 6500,
    displayOrder: 1,
    isActive: true
  },
  {
    id: "service-color",
    name: "Color",
    nameEn: "Color",
    nameZh: "Color",
    description: "Dimensional color.",
    descriptionEn: "Dimensional color.",
    descriptionZh: "Dimensional color.",
    durationMinutes: 120,
    priceCents: 18000,
    displayOrder: 2,
    isActive: true
  }
];

const stylists: Stylist[] = [
  {
    id: "stylist-nina",
    name: "Nina Park",
    bioEn: "Precision cuts and soft layers.",
    bioZh: "\u7cbe\u51c6\u526a\u53d1\u548c\u67d4\u548c\u5c42\u6b21\u3002",
    bio: "Precision cuts and soft layers.",
    specialtiesEn: ["Cuts", "Styling"],
    specialtiesZh: ["\u526a\u53d1", "\u9020\u578b"],
    specialties: ["Cuts", "Styling"],
    serviceIds: ["service-cut", "service-color"],
    isActive: true,
    displayOrder: 1
  },
  {
    id: "stylist-mara",
    name: "Mara Lee",
    bioEn: "Color and transformations.",
    bioZh: "",
    bio: "Color and transformations.",
    specialtiesEn: ["Color"],
    specialtiesZh: [],
    specialties: ["Color"],
    serviceIds: ["service-color"],
    isActive: true,
    displayOrder: 2
  }
];

vi.mock("../lib/data", () => ({
  deleteStylist: vi.fn(),
  isStaffSignedIn: vi.fn(async () => true),
  listAdminServices: vi.fn(async () => services),
  listAdminStylists: vi.fn(async () => stylists),
  listStylistHours: vi.fn(async () => []),
  saveStylist: vi.fn(),
  updateStylistHour: vi.fn()
}));

function renderAdminStylistsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={["/admin/stylists"]}>
          <AdminStylistsPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AdminStylistsPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
    vi.mocked(deleteStylist).mockReset();
    vi.mocked(saveStylist).mockReset();
    vi.mocked(updateStylistHour).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("deletes a selected stylist after staff confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    renderAdminStylistsPage();

    await user.click(await screen.findByRole("button", { name: /Nina Park/ }));
    await user.click(screen.getByRole("button", { name: "Delete stylist" }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Nina Park"));
    await waitFor(() => expect(deleteStylist).toHaveBeenCalledWith("stylist-nina"));
  });

  it("renders Chinese profile placeholders as localized text", async () => {
    renderAdminStylistsPage();

    await screen.findByRole("button", { name: /Nina Park/ });

    expect(screen.getByLabelText("Chinese bio").getAttribute("placeholder")).toBe(
      "\u7cbe\u51c6\u526a\u53d1\u3001\u67d4\u548c\u5c42\u6b21\u548c\u81ea\u7136\u9020\u578b"
    );
    expect(screen.getByLabelText("Chinese specialties").getAttribute("placeholder")).toBe(
      "\u526a\u53d1, \u5c42\u6b21, \u5439\u98ce\u9020\u578b"
    );
  });

  it("saves separate English and Chinese stylist profile fields", async () => {
    const user = userEvent.setup();
    vi.mocked(saveStylist).mockResolvedValueOnce({
      ...stylists[0],
      bioEn: "Precision edits and soft finish.",
      bioZh: "\u7cbe\u51c6\u4fee\u526a\u548c\u67d4\u548c\u9020\u578b\u3002",
      specialtiesEn: ["Cuts", "Layers"],
      specialtiesZh: ["\u526a\u53d1", "\u5c42\u6b21"]
    });

    renderAdminStylistsPage();

    await user.click(await screen.findByRole("button", { name: /Nina Park/ }));
    await user.clear(screen.getByLabelText("English bio"));
    await user.type(screen.getByLabelText("English bio"), "Precision edits and soft finish.");
    await user.clear(screen.getByLabelText("Chinese bio"));
    await user.type(screen.getByLabelText("Chinese bio"), "\u7cbe\u51c6\u4fee\u526a\u548c\u67d4\u548c\u9020\u578b\u3002");
    await user.clear(screen.getByLabelText("English specialties"));
    await user.type(screen.getByLabelText("English specialties"), "Cuts, Layers");
    await user.clear(screen.getByLabelText("Chinese specialties"));
    await user.type(screen.getByLabelText("Chinese specialties"), "\u526a\u53d1, \u5c42\u6b21");

    await user.click(screen.getByRole("button", { name: "Save stylist" }));

    await waitFor(() =>
      expect(saveStylist).toHaveBeenCalledWith(
        {
          name: "Nina Park",
          bioEn: "Precision edits and soft finish.",
          bioZh: "\u7cbe\u51c6\u4fee\u526a\u548c\u67d4\u548c\u9020\u578b\u3002",
          specialtiesEn: ["Cuts", "Layers"],
          specialtiesZh: ["\u526a\u53d1", "\u5c42\u6b21"],
          serviceIds: ["service-cut", "service-color"],
          isActive: true
        },
        "stylist-nina"
      )
    );
  });
});
