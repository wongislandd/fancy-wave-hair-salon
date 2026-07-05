// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { LandingPage } from "./LandingPage";
import type { GalleryPhoto, Service } from "../lib/types";

const services: Service[] = [
  {
    id: "service-1",
    name: "Signature Haircut",
    nameEn: "Signature Haircut",
    nameZh: "招牌剪发",
    description: "Wash, precision cut, and a soft finish.",
    descriptionEn: "Wash, precision cut, and a soft finish.",
    descriptionZh: "洗发、精剪和柔顺造型。",
    durationMinutes: 60,
    priceCents: 6500,
    displayOrder: 1,
    isActive: true
  },
  {
    id: "service-2",
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
    id: "service-3",
    name: "Men's Haircut",
    nameEn: "Men's Haircut",
    nameZh: "男士剪发",
    description: "Wash, precision cut, and a soft finish.",
    descriptionEn: "Wash, precision cut, and a soft finish.",
    descriptionZh: "洗发、精剪和造型。",
    durationMinutes: 30,
    priceCents: 2800,
    priceIsStartingAt: true,
    displayOrder: 3,
    isActive: true
  }
];

const galleryPhotos: GalleryPhoto[] = [
  {
    id: "gallery-1",
    storagePath: "gallery/first.jpg",
    imageUrl: "/assets/salon-hero.png",
    altText: "Salon color chair",
    altTextEn: "Salon color chair",
    altTextZh: "\u6c99\u9f99\u67d3\u53d1\u6905",
    caption: "Fresh color and clean shine",
    displayOrder: 1,
    isActive: true,
    createdAt: "2026-07-05T12:00:00.000Z",
    updatedAt: "2026-07-05T12:00:00.000Z"
  }
];

vi.mock("../lib/data", () => ({
  listPublicGalleryPhotos: vi.fn(async () => galleryPhotos),
  listPublicServices: vi.fn(async () => services)
}));

function renderLandingPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <LandingPage />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("LandingPage", () => {
  it("renders customer-facing landing content with public services", async () => {
    window.localStorage.setItem("fancy-wave-language", "en");

    renderLandingPage();

    expect(
      screen.getByRole("heading", { name: "Fresh cuts, color, and blowouts." })
    ).toBeTruthy();
    expect(screen.getAllByText("135-45 Roosevelt Ave, Flushing, NY 11354").length).toBeGreaterThan(0);
    expect(await screen.findByText("Signature Haircut")).toBeTruthy();
    expect(screen.getByText("$65")).toBeTruthy();
    expect(screen.getByText("$28-$60")).toBeTruthy();
    expect(screen.getByText("$28+")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Gallery" })).toBeTruthy();
    expect(screen.getByAltText("Salon color chair")).toBeTruthy();
    expect(screen.queryByText("Fresh color and clean shine")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Salon color chair" })).toBeTruthy();
  });

  it("shows Chinese gallery descriptions when Chinese is selected", async () => {
    window.localStorage.setItem("fancy-wave-language", "zh");

    renderLandingPage();

    expect(await screen.findByRole("heading", { name: "\u76f8\u518c" })).toBeTruthy();
    expect(screen.getByAltText("\u6c99\u9f99\u67d3\u53d1\u6905")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open \u6c99\u9f99\u67d3\u53d1\u6905" })).toBeTruthy();
  });

});
