import type { Appointment, GalleryPhoto, ManageableBooking, Service } from "./types";

export type Language = "en" | "zh";

export const defaultLanguage: Language = "en";

export function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

export function localeForLanguage(language: Language): string {
  return language === "zh" ? "zh-CN" : "en-US";
}

export function getLocalizedServiceText(
  service: Service,
  language: Language
): { name: string; description: string } {
  const englishName = "nameEn" in service ? clean(service.nameEn) : clean(service.name);
  const chineseName = clean(service.nameZh);
  const englishDescription = "descriptionEn" in service
    ? clean(service.descriptionEn)
    : clean(service.description);
  const chineseDescription = clean(service.descriptionZh);

  return {
    name: pickLocalized(englishName, chineseName, language),
    description: pickLocalized(englishDescription, chineseDescription, language)
  };
}

export function getLocalizedGalleryPhotoText(
  photo: GalleryPhoto,
  language: Language
): { altText: string } {
  const legacyAltText = clean(photo.altText);
  const englishAltText = "altTextEn" in photo
    ? clean(photo.altTextEn) || legacyAltText
    : legacyAltText;
  const chineseAltText = clean(photo.altTextZh);

  return {
    altText: pickLocalized(englishAltText, chineseAltText, language)
  };
}

export function getAppointmentServiceName(
  appointment: Appointment,
  language: Language
): string {
  return pickLocalized(
    appointment.serviceNameSnapshot,
    appointment.serviceNameZhSnapshot,
    language
  );
}

export function getManageableBookingServiceName(
  booking: ManageableBooking,
  language: Language,
  currentService?: Service
): string {
  if (currentService) {
    return getLocalizedServiceText(currentService, language).name;
  }

  return pickLocalized(booking.serviceName, booking.serviceNameZh, language);
}

function pickLocalized(
  englishValue: string | null | undefined,
  chineseValue: string | null | undefined,
  language: Language
): string {
  const english = clean(englishValue);
  const chinese = clean(chineseValue);

  if (language === "zh") return chinese || english;
  return english || chinese;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
