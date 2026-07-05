import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { GalleryPhoto } from "../lib/types";

type GalleryCarouselProps = {
  photos: GalleryPhoto[];
  title: string;
  previousLabel: string;
  nextLabel: string;
};

type DragState = {
  active: boolean;
  dragging: boolean;
  startX: number;
  startY: number;
  scrollLeft: number;
};

export function GalleryCarousel({
  photos,
  title,
  previousLabel,
  nextLabel
}: GalleryCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState>({
    active: false,
    dragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0
  });
  const suppressOpenRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDraggingCarousel, setIsDraggingCarousel] = useState(false);
  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];

  const showAdjacentPhoto = useCallback((direction: -1 | 1) => {
    setSelectedIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return (currentIndex + direction + photos.length) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (selectedIndex === null) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") showAdjacentPhoto(-1);
      if (event.key === "ArrowRight") showAdjacentPhoto(1);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex, showAdjacentPhoto]);

  if (photos.length === 0) return null;

  const scrollByCard = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction * Math.min(460, scroller.clientWidth * 0.82),
      behavior: "smooth"
    });
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragStateRef.current = {
      active: true,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft
    };
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.active) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!dragState.dragging) {
      if (absX < 8 || absX <= absY) return;
      dragState.dragging = true;
      suppressOpenRef.current = true;
      setIsDraggingCarousel(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX;
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.active) return;

    if (dragState.dragging) {
      suppressOpenRef.current = true;
    }

    dragStateRef.current = {
      active: false,
      dragging: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0
    };
    setIsDraggingCarousel(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const openPhoto = (index: number) => {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      return;
    }

    setSelectedIndex(index);
  };

  return (
    <section className="bg-wave-cream py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">{title}</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={previousLabel}
              onClick={() => scrollByCard(-1)}
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-wave-deep/15 bg-white text-wave-deep"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label={nextLabel}
              onClick={() => scrollByCard(1)}
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full bg-wave-deep text-wave-blush"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          aria-label="Gallery photos"
          ref={scrollerRef}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className={`gallery-scroller flex snap-x gap-4 overflow-x-auto scroll-smooth select-none touch-pan-y ${
            isDraggingCarousel ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {photos.map((photo, index) => (
            <figure
              key={photo.id}
              className="min-w-[82%] snap-start overflow-hidden rounded-[1.375rem] bg-white sm:min-w-[360px] lg:min-w-[420px]"
            >
              <button
                type="button"
                aria-label={`Open ${photo.altText}`}
                onClick={() => openPhoto(index)}
                className="focus-ring block w-full bg-wave-ink text-left [cursor:inherit]"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.altText}
                  draggable={false}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="aspect-[4/3] w-full object-cover transition duration-300 hover:scale-[1.02]"
                />
              </button>
            </figure>
          ))}
        </div>
      </div>

      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedPhoto.altText}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6"
        >
          <button
            type="button"
            aria-label="Close gallery photo"
            onClick={() => setSelectedIndex(null)}
            className="absolute inset-0 cursor-zoom-out"
          />
          <button
            type="button"
            aria-label="Close gallery photo"
            onClick={() => setSelectedIndex(null)}
            className="focus-ring absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            aria-label={previousLabel}
            onClick={() => showAdjacentPhoto(-1)}
            className="focus-ring absolute left-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronLeft size={24} />
          </button>
          <figure className="relative z-10 flex max-h-full max-w-6xl flex-col items-center gap-3">
            <img
              src={selectedPhoto.imageUrl}
              alt={selectedPhoto.altText}
              className="max-h-[82vh] max-w-full object-contain shadow-2xl"
            />
          </figure>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={() => showAdjacentPhoto(1)}
            className="focus-ring absolute right-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </section>
  );
}
