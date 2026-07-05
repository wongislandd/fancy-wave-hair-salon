import { Clock3, MapPin, Navigation } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GalleryCarousel } from "../components/GalleryCarousel";
import { listPublicGalleryPhotos, listPublicServices } from "../lib/data";
import { formatPriceRange } from "../lib/booking";
import { salonHeroImage } from "../lib/assets";
import { useLanguage } from "../lib/use-language";
import { getLocalizedGalleryPhotoText, getLocalizedServiceText, localeForLanguage } from "../lib/localization";
import { googleMapsDirectionsUrl, googleMapsEmbedUrl, salonAddress, salonName } from "../lib/salon";

const landingServiceLimit = 4;

export function LandingPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const { data: services = [] } = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });
  const { data: galleryPhotos = [] } = useQuery({
    queryKey: ["public-gallery-photos"],
    queryFn: listPublicGalleryPhotos
  });
  const localizedGalleryPhotos = useMemo(
    () =>
      galleryPhotos.map((photo) => ({
        ...photo,
        altText: getLocalizedGalleryPhotoText(photo, language).altText
      })),
    [galleryPhotos, language]
  );
  const featuredServices = services.slice(0, landingServiceLimit);
  const hoursLines = t("landing.hoursCopy").split(" / ");

  return (
    <div>
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-wave-deep">
              {t("landing.eyebrow")}
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal text-wave-ink sm:text-5xl lg:text-6xl">
              {t("landing.title")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-wave-ink/70">
              {t("landing.copy")}
            </p>
            <div className="mt-8 grid gap-3 text-sm text-wave-ink/70 sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <MapPin className="shrink-0 text-wave-deep" size={18} />
                {salonAddress}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="shrink-0 text-wave-deep" size={18} />
                {t("landing.openDays")}
              </p>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem]">
            <img
              src={salonHeroImage}
              alt="Clean modern hair salon interior"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t("landing.servicesTitle")}</h2>
            <p className="mt-2 text-wave-ink/65">
              {t("landing.servicesCopy")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featuredServices.map((service) => {
            const serviceText = getLocalizedServiceText(service, language);

            return (
              <article key={service.id} className="rounded-2xl border border-wave-deep/10 bg-white p-5 shadow-sm">
                <h3 className="font-bold">{serviceText.name}</h3>
                <p className="mt-2 min-h-14 text-sm leading-6 text-wave-ink/65">{serviceText.description}</p>
                <div className="mt-5 flex items-center justify-between text-sm font-semibold">
                  <span>{service.durationMinutes} {t("common.min")}</span>
                  <span>{formatPriceRange(service, locale)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="location" className="bg-white py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{t("landing.locationEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">{t("landing.locationTitle")}</h2>

            <div className="mt-6 divide-y divide-wave-deep/10 rounded-[1.375rem] border border-wave-deep/10 bg-white">
              <div className="p-4">
                <p className="flex items-start gap-3 font-semibold">
                  <MapPin className="mt-0.5 shrink-0 text-wave-deep" size={20} />
                  <span>
                    <span className="block">{salonName}</span>
                    <span className="mt-1 block text-sm font-normal text-wave-ink/65">{salonAddress}</span>
                  </span>
                </p>
              </div>
              <div className="p-4">
                <p className="flex items-start gap-3 font-semibold">
                  <Clock3 className="mt-0.5 shrink-0 text-wave-deep" size={20} />
                  <span>
                    <span className="block">{t("landing.hours")}</span>
                    <span className="mt-1 flex flex-col gap-1 text-sm font-normal text-wave-ink/65">
                      {hoursLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6">
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-wave-deep/20 bg-white px-5 py-3 font-semibold text-wave-ink transition hover:bg-wave-mint"
              >
                {t("landing.directions")}
                <Navigation size={18} />
              </a>
            </div>
          </div>

          <div className="min-h-[340px] overflow-hidden rounded-[2rem] border border-wave-deep/10 bg-wave-mint">
            <iframe
              title={`Map to ${salonName} in Flushing`}
              src={googleMapsEmbedUrl}
              className="h-full min-h-[340px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <GalleryCarousel
        photos={localizedGalleryPhotos}
        title={t("landing.galleryTitle")}
        previousLabel={t("landing.galleryPrevious")}
        nextLabel={t("landing.galleryNext")}
      />
    </div>
  );
}
