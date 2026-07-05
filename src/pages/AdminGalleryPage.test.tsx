// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { AdminGalleryPage } from "./AdminGalleryPage";
import type { GalleryPhoto } from "../lib/types";

const photos: GalleryPhoto[] = [
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

vi.mock("../components/AdminShell", () => ({
  AdminShell: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  )
}));

vi.mock("../lib/data", () => ({
  deleteGalleryPhoto: vi.fn(async () => undefined),
  listAdminGalleryPhotos: vi.fn(async () => photos),
  saveGalleryPhoto: vi.fn(async () => photos[0]),
  updateGalleryPhotoOrder: vi.fn(async () => undefined),
  uploadGalleryPhoto: vi.fn(async () => photos[0])
}));

function renderAdminGalleryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AdminGalleryPage />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AdminGalleryPage", () => {
  it("renders existing gallery photos and upload controls", async () => {
    window.localStorage.setItem("fancy-wave-language", "en");

    renderAdminGalleryPage();

    expect(await screen.findByRole("heading", { name: "Gallery management" })).toBeTruthy();
    expect(await screen.findByText("Salon color chair")).toBeTruthy();
    expect(screen.getByLabelText("Photo file")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "English" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Chinese" })).toBeNull();
    expect(screen.getByRole("heading", { name: "English description" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chinese description" })).toBeTruthy();
    expect(screen.getByLabelText("English description")).toBeTruthy();
    expect(screen.getByLabelText("Chinese description")).toBeTruthy();
    expect(screen.getByPlaceholderText("Salon color chair")).toBeTruthy();
    expect(screen.getByPlaceholderText("\u6c99\u9f99\u67d3\u53d1\u6905")).toBeTruthy();
    expect(screen.queryByText("Upload a salon photo to Supabase Storage")).toBeNull();
    expect(screen.queryByLabelText("Caption")).toBeNull();
    expect(screen.getByRole("button", { name: "New photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move photo down" })).toBeTruthy();
  });

  it("localizes gallery description uploads in Chinese", async () => {
    window.localStorage.setItem("fancy-wave-language", "zh");

    renderAdminGalleryPage();

    expect(await screen.findByRole("heading", { name: "\u76f8\u518c\u7ba1\u7406" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "\u82f1\u6587" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "\u4e2d\u6587" })).toBeNull();
    expect(screen.getByRole("heading", { name: "\u82f1\u6587\u7167\u7247\u63cf\u8ff0" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "\u4e2d\u6587\u7167\u7247\u63cf\u8ff0" })).toBeTruthy();
    expect(screen.getByLabelText("\u82f1\u6587\u7167\u7247\u63cf\u8ff0")).toBeTruthy();
    expect(screen.getByLabelText("\u4e2d\u6587\u7167\u7247\u63cf\u8ff0")).toBeTruthy();
    expect(screen.queryByText("\u4e0a\u4f20\u6c99\u9f99\u7167\u7247\u5230 Supabase Storage")).toBeNull();
  });
});
