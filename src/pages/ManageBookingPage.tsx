import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { Link, useLocation, useParams } from "react-router-dom";
import { CalendarPlus, CalendarX2, ChevronDown, RotateCw } from "lucide-react";
import {
  cancelManagedBooking,
  getAvailableSlots,
  listPublicServices,
  loadBookingByToken,
  nextBookableDates,
  rescheduleManagedBooking
} from "../lib/data";
import {
  buildManageBookingPath,
  calculateAppointmentEnd,
  formatAppointmentRange,
  formatDateKeyInTimeZone,
  formatPriceRange,
  formatTimeInTimeZone,
  isCustomerManageableStatus
} from "../lib/booking";
import { buildAppointmentCalendarLinks } from "../lib/calendar";
import { StatusBadge } from "../components/StatusBadge";
import { useLanguage } from "../lib/use-language";
import {
  getManageableBookingServiceName,
  localeForLanguage
} from "../lib/localization";
import type { AvailableSlot, Service, Stylist } from "../lib/types";
import { salonName } from "../lib/salon";

const bookingConfettiStoragePrefix = "fancy-wave-booking-confetti";
const bookingConfettiColors = ["#f97373", "#facc15", "#5eead4", "#60a5fa", "#f472b6"];

export function ManageBookingPage({ confirmed = false }: { confirmed?: boolean }) {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const { token = "" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(nextBookableDates(1)[0]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const confettiPlayedRef = useRef(false);
  const dates = useMemo(() => nextBookableDates(8), []);

  const bookingQuery = useQuery({
    queryKey: ["managed-booking", token],
    queryFn: () => loadBookingByToken(token),
    enabled: Boolean(token)
  });

  const { data: services = [] } = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });

  const booking = bookingQuery.data;
  const currentService = services.find((item) => item.id === booking?.serviceId);
  const service = currentService ?? synthesizeService(booking ?? null);
  const stylist = synthesizeStylist(booking ?? null);
  const serviceName = booking
    ? getManageableBookingServiceName(booking, language, service)
    : "";
  const customerEndsAt = booking
    ? calculateAppointmentEnd(booking.startsAt, booking.serviceDurationMinutes).toISOString()
    : "";
  const manageUrl = useMemo(() => {
    const path = buildManageBookingPath(token);
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, [token]);
  const calendarLinks = useMemo(() => {
    if (!booking || !serviceName) return null;

    return buildAppointmentCalendarLinks({
      bookingReference: booking.bookingReference,
      serviceName,
      stylistName: booking.stylistName,
      startsAt: booking.startsAt,
      endsAt: customerEndsAt,
      manageUrl
    });
  }, [booking, customerEndsAt, manageUrl, serviceName]);

  const slotsQuery = useQuery({
    queryKey: ["managed-slots", booking?.serviceId, booking?.stylistId, date],
    queryFn: () => getAvailableSlots(service!, date, stylist),
    enabled: Boolean(service && stylist && booking && isCustomerManageableStatus(booking.status))
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => rescheduleManagedBooking(token, slot!.startsAt),
    onSuccess: () => {
      setSlot(null);
      queryClient.invalidateQueries({ queryKey: ["managed-booking", token] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelManagedBooking(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-booking", token] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    }
  });

  const handleCancelAppointment = () => {
    if (!window.confirm(t("manage.cancelConfirm"))) return;
    cancelMutation.mutate();
  };

  useEffect(() => {
    if (confettiPlayedRef.current) return;

    if (!booking || !shouldCelebrateBookingConfirmation(confirmed, token, location.state)) {
      return;
    }

    const storageKey = `${bookingConfettiStoragePrefix}:${token}`;
    if (hasSessionStorageFlag(storageKey)) {
      return;
    }

    confettiPlayedRef.current = true;
    setSessionStorageFlag(storageKey);
    launchBookingConfetti();
  }, [booking, confirmed, location.state, token]);

  if (bookingQuery.isLoading) {
    return <PageShell title={t("manage.loading")} />;
  }

  if (!booking) {
    return (
      <PageShell title={t("manage.notFound")}>
        <p className="font-medium text-wave-ink/80">{t("manage.invalid")}</p>
        <Link className="mt-5 inline-flex rounded-full bg-wave-deep px-5 py-3 font-semibold text-white" to="/book">
          {t("manage.bookNew")}
        </Link>
      </PageShell>
    );
  }

  const manageable = isCustomerManageableStatus(booking.status) && booking.canManageOnline;

  return (
    <PageShell
      title={confirmed ? t("manage.booked") : t("manage.title")}
      subtitle={confirmed ? t("manage.confirmationEmailHint") : undefined}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="ui-surface">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{booking.bookingReference}</p>
              <h2 className="mt-1 text-2xl font-bold">{serviceName}</h2>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <dl className="ui-divided-list text-sm font-medium">
            <div className="ui-divided-row">
              <dt className="font-semibold">{t("manage.when")}</dt>
              <dd className="mt-1 text-wave-ink/80">{formatAppointmentRange(booking.startsAt, customerEndsAt, undefined, locale)}</dd>
            </div>
            <div className="ui-divided-row">
              <dt className="font-semibold">{t("manage.guest")}</dt>
              <dd className="mt-1 text-wave-ink/80">{booking.customerName} / {booking.customerEmail}</dd>
              <dd className="mt-1 text-wave-ink/70">{booking.customerPhone}</dd>
            </div>
            <div className="ui-divided-row">
              <dt className="font-semibold">{t("manage.service")}</dt>
              <dd className="mt-1 text-wave-ink/80">
                {booking.serviceDurationMinutes} {t("common.min")} / {formatPriceRange({
                  priceCents: booking.servicePriceCents,
                  priceMaxCents: booking.servicePriceMaxCents,
                  priceIsStartingAt: booking.servicePriceIsStartingAt
                }, locale)}
              </dd>
            </div>
            <div className="ui-divided-row">
              <dt className="font-semibold">{t("manage.stylist")}</dt>
              <dd className="mt-1 text-wave-ink/80">{booking.stylistName}</dd>
            </div>
            {booking.notes && (
              <div className="ui-divided-row">
                <dt className="font-semibold">{t("manage.yourNote")}</dt>
                <dd className="mt-1 text-wave-ink/85">{booking.notes}</dd>
              </div>
            )}
          </dl>
          {booking.status === "confirmed" && calendarLinks && (
            <div className="relative mt-6 inline-block">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={calendarMenuOpen}
                onClick={() => setCalendarMenuOpen((isOpen) => !isOpen)}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 text-sm font-semibold text-white"
              >
                <CalendarPlus size={18} />
                {t("manage.addToCalendar")}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${calendarMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {calendarMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 z-10 mt-2 min-w-56 overflow-hidden rounded-2xl border border-wave-deep/10 bg-white py-2 text-sm font-semibold shadow-xl"
                >
                  <a
                    role="menuitem"
                    href={calendarLinks.googleUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setCalendarMenuOpen(false)}
                    className="focus-ring block px-4 py-3 text-wave-ink/85 hover:bg-wave-mint/70"
                  >
                    {t("manage.googleCalendar")}
                  </a>
                  <a
                    role="menuitem"
                    href={calendarLinks.icsDataUri}
                    download={calendarLinks.fileName}
                    type="text/calendar"
                    onClick={() => setCalendarMenuOpen(false)}
                    className="focus-ring block px-4 py-3 text-wave-ink/85 hover:bg-wave-mint/70"
                  >
                    {t("manage.appleCalendar")}
                  </a>
                </div>
              )}
            </div>
          )}
          {!manageable && (
            <p className="ui-subtle-note mt-5 font-medium">
              {t("manage.locked")}
            </p>
          )}
        </section>

        <section className="ui-surface">
          <h2 className="text-xl font-bold">{t("manage.changeTitle")}</h2>
          <div className="mt-5 grid gap-5">
            <div>
              <h3 className="font-semibold">{t("manage.reschedule")}</h3>
              <p className="mt-2 text-sm font-medium text-wave-ink/75">{t("manage.openingsWith", { name: booking.stylistName })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dates.map((day) => (
                  <button
                    key={day}
                    type="button"
                    disabled={!manageable}
                    onClick={() => {
                      setDate(day);
                      setSlot(null);
                    }}
                    className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${date === day ? "border-wave-deep bg-wave-deep text-white" : "border-wave-deep/10"}`}
                  >
                    {formatDateKeyInTimeZone(day, undefined, { month: "short", day: "numeric" }, locale)}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {slotsQuery.data?.map((availableSlot) => (
                  <button
                    key={`${availableSlot.stylistId}-${availableSlot.startsAt}`}
                    type="button"
                    disabled={!manageable}
                    onClick={() => setSlot(availableSlot)}
                    className={`focus-ring rounded-xl border px-4 py-3 font-semibold disabled:opacity-60 ${slot?.startsAt === availableSlot.startsAt ? "border-wave-deep bg-wave-mint/70" : "border-wave-deep/10 hover:bg-wave-mint/35"}`}
                  >
                    {formatTimeInTimeZone(availableSlot.startsAt, undefined, locale)}
                  </button>
                ))}
              </div>
              {!slotsQuery.isFetching && slotsQuery.data?.length === 0 && (
                <p className="ui-subtle-note mt-4 font-medium">
                  {t("manage.noOpenings")}
                </p>
              )}
              <button
                type="button"
                disabled={!manageable || !slot || rescheduleMutation.isPending}
                onClick={() => rescheduleMutation.mutate()}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white disabled:opacity-60"
              >
                <RotateCw size={18} />
                {rescheduleMutation.isPending ? t("manage.moving") : t("manage.move")}
              </button>
            </div>

            <div className="border-t border-wave-deep/10 pt-5">
              <h3 className="font-semibold">{t("manage.cancel")}</h3>
              <p className="mt-2 text-sm font-medium text-wave-ink/75">{t("manage.cancelCopy")}</p>
              <button
                type="button"
                disabled={!manageable || cancelMutation.isPending}
                onClick={handleCancelAppointment}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full border border-wave-deep/25 bg-wave-deep/10 px-5 py-3 font-semibold text-wave-deep disabled:opacity-60"
              >
                <CalendarX2 size={18} />
                {cancelMutation.isPending ? t("manage.cancelling") : t("manage.cancelAppointment")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function shouldCelebrateBookingConfirmation(
  confirmed: boolean,
  token: string,
  locationState: unknown
): boolean {
  return confirmed && Boolean(token) && isBookingJustCompletedState(locationState);
}

function isBookingJustCompletedState(state: unknown): state is { bookingJustCompleted: true } {
  return Boolean(
    state &&
    typeof state === "object" &&
    (state as { bookingJustCompleted?: unknown }).bookingJustCompleted === true
  );
}

function hasSessionStorageFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "shown";
  } catch {
    return false;
  }
}

function setSessionStorageFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, "shown");
  } catch {
    // The animation can still play if storage is unavailable.
  }
}

function launchBookingConfetti(): void {
  const defaults = {
    colors: bookingConfettiColors,
    disableForReducedMotion: true,
    zIndex: 100
  };

  confetti({
    ...defaults,
    particleCount: 90,
    spread: 72,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.28 }
  });

  confetti({
    ...defaults,
    angle: 60,
    particleCount: 35,
    spread: 55,
    startVelocity: 42,
    origin: { x: 0, y: 0.55 }
  });

  confetti({
    ...defaults,
    angle: 120,
    particleCount: 35,
    spread: 55,
    startVelocity: 42,
    origin: { x: 1, y: 0.55 }
  });
}

function PageShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{salonName}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base font-medium text-wave-ink/80">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function synthesizeService(
  booking: Awaited<ReturnType<typeof loadBookingByToken>>
): Service | undefined {
  if (!booking) return undefined;
  return {
    id: booking.serviceId,
    nameEn: booking.serviceName,
    nameZh: booking.serviceNameZh ?? booking.serviceName,
    descriptionEn: "",
    descriptionZh: "",
    name: booking.serviceName,
    description: "",
    durationMinutes: booking.serviceDurationMinutes,
    calendarBlockMinutes: getBookingCalendarBlockMinutes(booking),
    priceCents: booking.servicePriceCents,
    priceMaxCents: booking.servicePriceMaxCents ?? null,
    priceIsStartingAt: Boolean(booking.servicePriceIsStartingAt),
    isActive: true,
    displayOrder: 0
  };
}

function getBookingCalendarBlockMinutes(
  booking: NonNullable<Awaited<ReturnType<typeof loadBookingByToken>>>
): number {
  const blockMinutes = Math.round(
    (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000
  );

  return blockMinutes > 0 ? blockMinutes : booking.serviceDurationMinutes;
}

function synthesizeStylist(
  booking: Awaited<ReturnType<typeof loadBookingByToken>>
): Stylist | null {
  if (!booking) return null;
  return {
    id: booking.stylistId,
    name: booking.stylistName,
    bio: "",
    specialties: [],
    serviceIds: [booking.serviceId],
    isActive: true,
    displayOrder: 0
  };
}
