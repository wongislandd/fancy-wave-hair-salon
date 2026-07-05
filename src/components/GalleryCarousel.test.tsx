// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GalleryCarousel } from "./GalleryCarousel";
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
  },
  {
    id: "gallery-2",
    storagePath: "gallery/second.jpg",
    imageUrl: "/assets/salon-hero.png",
    altText: "Salon styling mirror",
    altTextEn: "Salon styling mirror",
    altTextZh: "\u6c99\u9f99\u9020\u578b\u955c",
    caption: null,
    displayOrder: 2,
    isActive: true,
    createdAt: "2026-07-05T12:00:00.000Z",
    updatedAt: "2026-07-05T12:00:00.000Z"
  }
];

describe("GalleryCarousel", () => {
  it("renders gallery photos with descriptions and carousel controls", () => {
    render(
      <GalleryCarousel
        photos={photos}
        title="Gallery"
        previousLabel="Previous gallery photos"
        nextLabel="Next gallery photos"
      />
    );

    expect(screen.getByRole("heading", { name: "Gallery" })).toBeTruthy();
    expect(screen.queryByText("Recent salon moments")).toBeNull();
    expect(screen.getByAltText("Salon color chair")).toBeTruthy();
    expect(screen.getByAltText("Salon styling mirror")).toBeTruthy();
    expect(screen.queryByText("Fresh color and clean shine")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous gallery photos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next gallery photos" })).toBeTruthy();
  });

  it("opens photos in an immersive viewer with previous, next, and close controls", async () => {
    const user = userEvent.setup();

    render(
      <GalleryCarousel
        photos={photos}
        title="Gallery"
        previousLabel="Previous gallery photos"
        nextLabel="Next gallery photos"
      />
    );

    await user.click(screen.getByRole("button", { name: "Open Salon color chair" }));

    expect(screen.getByRole("dialog", { name: "Salon color chair" })).toBeTruthy();
    expect(screen.queryByText("Fresh color and clean shine")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Next gallery photos" }).at(-1)!);

    expect(screen.getByRole("dialog", { name: "Salon styling mirror" })).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Previous gallery photos" }).at(-1)!);

    expect(screen.getByRole("dialog", { name: "Salon color chair" })).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("scrolls by dragging without opening a dragged photo", async () => {
    const user = userEvent.setup();

    render(
      <GalleryCarousel
        photos={photos}
        title="Gallery"
        previousLabel="Previous gallery photos"
        nextLabel="Next gallery photos"
      />
    );

    const scroller = screen.getByLabelText("Gallery photos");
    const openButton = screen.getByRole("button", { name: "Open Salon color chair" });
    Object.defineProperty(scroller, "scrollLeft", {
      value: 100,
      writable: true
    });

    fireEvent(openButton, new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 260,
      clientY: 20
    }));
    fireEvent(scroller, new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 120,
      clientY: 24
    }));
    fireEvent(scroller, new MouseEvent("pointerup", {
      bubbles: true
    }));
    fireEvent.click(openButton);

    expect(scroller.scrollLeft).toBe(240);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(openButton);

    expect(screen.getByRole("dialog", { name: "Salon color chair" })).toBeTruthy();
  });

  it("renders nothing when there are no photos", () => {
    const { container } = render(
      <GalleryCarousel
        photos={[]}
        title="Gallery"
        previousLabel="Previous gallery photos"
        nextLabel="Next gallery photos"
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
