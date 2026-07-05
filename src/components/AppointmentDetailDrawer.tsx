import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarX2, ChevronDown, Clock3, Mail, Phone, Save, StickyNote, UserRound, X } from "lucide-react";
import { customerHistoryForAppointment } from "../lib/admin";
import {
  DEFAULT_SALON_TIME_ZONE,
  formatAppointmentRange,
  formatDateInTimeZone,
  formatDateKeyInTimeZone,
  formatPriceRange,
  formatTimeInTimeZone
} from "../lib/booking";
import {
  cancelAppointmentAsStaff,
  getAvailableSlots,
  nextBookableDates,
  rescheduleAppointmentAsStaff,
  updateAppointmentInternalNotes
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import {
  getAppointmentServiceName,
  localeForLanguage
} from "../lib/localization";
import type { Appointment, Service, Stylist } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export function AppointmentDetailDrawer({
  appointment,
  appointments,
  onClose
}: {
  appointment: Appointment | null;
  appointments: Appointment[];
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const moveDates = useMemo(() => nextBookableDates(10), []);
  const [moveDate, setMoveDate] = useState(moveDates[0] ?? "");
  const [isMoveSectionOpen, setIsMoveSectionOpen] = useState(false);
  const [selectedMoveSlot, setSelectedMoveSlot] = useState<string | null>(null);

  useEffect(() => {
    setNotes(appointment?.internalNotes ?? "");
    setMoveDate(moveDates[0] ?? "");
    setIsMoveSectionOpen(false);
    setSelectedMoveSlot(null);
  }, [appointment, moveDates]);

  const history = useMemo(
    () => (appointment ? customerHistoryForAppointment(appointments, appointment) : []),
    [appointment, appointments]
  );
  const moveService = useMemo(
    () => (appointment ? serviceFromAppointment(appointment) : null),
    [appointment]
  );
  const moveStylist = useMemo(
    () => (appointment ? stylistFromAppointment(appointment) : null),
    [appointment]
  );
  const moveSlotsQuery = useQuery({
    queryKey: ["admin-move-slots", appointment?.id, moveDate],
    queryFn: () => getAvailableSlots(moveService!, moveDate, moveStylist!),
    enabled: Boolean(
      appointment &&
        appointment.status === "confirmed" &&
        isMoveSectionOpen &&
        moveService &&
        moveStylist &&
        moveDate
    )
  });
  const moveSlots = moveSlotsQuery.data ?? [];
  const selectedSlot = moveSlots.find((slot) => slot.startsAt === selectedMoveSlot);

  const notesMutation = useMutation({
    mutationFn: () => updateAppointmentInternalNotes(appointment!.id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-appointments"] })
  });

  const moveMutation = useMutation({
    mutationFn: () =>
      rescheduleAppointmentAsStaff(appointment!.id, selectedSlot!.startsAt),
    onSuccess: () => {
      setSelectedMoveSlot(null);
      setIsMoveSectionOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-move-slots", appointment!.id] });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAppointmentAsStaff(appointment!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-appointments"] })
  });

  if (!appointment) return null;

  const customerEmail = appointment.customerEmail.trim();
  const customerPhone = appointment.customerPhone.trim();
  const phoneDigits = customerPhone.replace(/\D/g, "");
  const hasNoteChanges = notes.trim() !== (appointment.internalNotes ?? "").trim();
  const movePanelId = `move-appointment-panel-${appointment.id}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-wave-ink/35 backdrop-blur-sm">
      <button
        type="button"
        className="hidden flex-1 cursor-default md:block"
        aria-label={t("drawer.close")}
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white">
        <header className="border-b border-wave-deep/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">
                {appointment.bookingReference}
              </p>
              <h2 className="mt-1 text-2xl font-black">{appointment.customerName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full border border-wave-deep/10 p-2"
              aria-label={t("drawer.close")}
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={appointment.status} />
            <span className="rounded-full bg-wave-mint px-3 py-1 text-xs font-semibold text-wave-deep">
              {appointment.stylistNameSnapshot}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-wave-deep">
              <UserRound size={16} />
              {t("drawer.contact")}
            </h3>
            <div className="mt-3 grid gap-2 text-sm">
              {customerEmail ? (
                <a
                  className="focus-ring flex items-center gap-2 rounded-2xl border border-wave-deep/10 px-3 py-3 font-semibold text-wave-ink"
                  href={`mailto:${customerEmail}`}
                >
                  <Mail size={16} />
                  {customerEmail}
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-wave-deep/10 px-3 py-3 font-semibold text-wave-ink/60">
                  <Mail size={16} />
                  Not provided
                </div>
              )}
              {phoneDigits ? (
                <a
                  className="focus-ring flex items-center gap-2 rounded-2xl border border-wave-deep/10 px-3 py-3 font-semibold text-wave-ink"
                  href={`tel:${phoneDigits}`}
                >
                  <Phone size={16} />
                  {customerPhone}
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-wave-deep/10 px-3 py-3 font-semibold text-wave-ink/60">
                  <Phone size={16} />
                  Not provided
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("drawer.reservation")}</h3>
            <dl className="mt-3 grid gap-3 text-sm">
              <DetailRow label={t("drawer.when")} value={formatAppointmentRange(appointment.startsAt, appointment.endsAt, undefined, locale)} />
              <DetailRow
                label={t("drawer.service")}
                value={`${getAppointmentServiceName(appointment, language)} / ${appointment.serviceDurationMinutesSnapshot} ${t("common.min")} / ${formatPriceRange({
                  priceCents: appointment.servicePriceCentsSnapshot,
                  priceMaxCents: appointment.servicePriceMaxCentsSnapshot,
                  priceIsStartingAt: appointment.servicePriceIsStartingAtSnapshot
                }, locale)}`}
              />
              <DetailRow label={t("drawer.stylist")} value={appointment.stylistNameSnapshot} />
              <DetailRow label={t("drawer.booked")} value={formatDateTime(appointment.createdAt, locale)} />
            </dl>
          </section>

          {appointment.status === "confirmed" && (
            <section className="mt-6 border-y border-wave-deep/10 py-2">
              <button
                type="button"
                aria-controls={movePanelId}
                aria-expanded={isMoveSectionOpen}
                onClick={() => setIsMoveSectionOpen((current) => !current)}
                className="focus-ring flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-wave-deep">
                  <CalendarClock size={16} />
                  {t("drawer.moveAppointment")}
                </span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-wave-deep transition-transform ${
                    isMoveSectionOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isMoveSectionOpen && (
                <div id={movePanelId} className="px-4 pb-4">
                  <p className="text-sm text-wave-ink/65">{t("drawer.moveCopy")}</p>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {moveDates.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setMoveDate(day);
                          setSelectedMoveSlot(null);
                        }}
                        className={`focus-ring min-w-[112px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                          moveDate === day
                            ? "border-wave-deep bg-wave-deep text-white"
                            : "border-wave-deep/10 bg-white"
                        }`}
                      >
                        <span className="block">{formatDateKeyInTimeZone(day, DEFAULT_SALON_TIME_ZONE, { weekday: "short" }, locale)}</span>
                        <span className={moveDate === day ? "text-white/75" : "text-wave-ink/55"}>
                          {formatDateKeyInTimeZone(day, DEFAULT_SALON_TIME_ZONE, { month: "short", day: "numeric" }, locale)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="ui-subtle-note mt-3">
                    {moveSlotsQuery.isFetching && (
                      <p className="text-sm text-wave-ink/65">{t("drawer.loadingTimes")}</p>
                    )}
                    {!moveSlotsQuery.isFetching && moveSlots.length === 0 && (
                      <p className="text-sm text-wave-ink/65">{t("drawer.noMoveTimes")}</p>
                    )}
                    {!moveSlotsQuery.isFetching && moveSlots.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {moveSlots.map((slot) => (
                          <button
                            key={slot.startsAt}
                            type="button"
                            onClick={() => setSelectedMoveSlot(slot.startsAt)}
                            className={`focus-ring rounded-2xl border p-3 text-left text-sm transition ${
                              selectedMoveSlot === slot.startsAt
                                ? "border-wave-deep ring-2 ring-wave-deep/20"
                                : "border-wave-deep/10 hover:border-wave-deep/40"
                            }`}
                          >
                            <span className="flex items-center gap-2 font-black">
                              <Clock3 size={15} />
                              {formatTimeInTimeZone(slot.startsAt, DEFAULT_SALON_TIME_ZONE, locale)}
                            </span>
                            <span className="mt-1 block text-wave-ink/60">{appointment.stylistNameSnapshot}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedSlot || moveMutation.isPending}
                    onClick={() => moveMutation.mutate()}
                    className="focus-ring mt-3 inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 font-semibold text-white disabled:opacity-45"
                  >
                    <CalendarClock size={16} />
                    {moveMutation.isPending ? t("drawer.moving") : t("drawer.moveAppointment")}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="mt-6">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-wave-deep">
              <StickyNote size={16} />
              {t("drawer.notes")}
            </h3>
            <div className="ui-subtle-note mt-3 text-sm">
              <p className="font-semibold text-wave-ink">{t("drawer.customerNote")}</p>
              <p className="mt-1">{appointment.notes || t("drawer.noCustomerNote")}</p>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold">{t("drawer.staffNotes")}</span>
              <textarea
                className="ui-field min-h-28"
                aria-label={t("drawer.staffNotes")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("drawer.staffNotesPlaceholder")}
              />
            </label>
            <button
              type="button"
              disabled={!hasNoteChanges || notesMutation.isPending}
              onClick={() => notesMutation.mutate()}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 font-semibold text-white disabled:opacity-45"
            >
              <Save size={16} />
              {notesMutation.isPending ? t("common.saving") : t("drawer.saveNotes")}
            </button>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("drawer.previous")}</h3>
            <div className="ui-divided-list mt-3">
              {history.map((item) => (
                <article key={item.id} className="ui-divided-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{getAppointmentServiceName(item, language)}</p>
                      <p className="mt-1 text-sm text-wave-ink/65">{formatAppointmentRange(item.startsAt, item.endsAt, undefined, locale)}</p>
                      <p className="mt-1 text-sm text-wave-ink/65">{t("drawer.withStylist", { name: item.stylistNameSnapshot })}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  {(item.notes || item.internalNotes) && (
                    <div className="mt-3 grid gap-2 text-sm text-wave-ink/70">
                      {item.notes && <p>{t("drawer.customer")}: {item.notes}</p>}
                      {item.internalNotes && <p>{t("drawer.staff")}: {item.internalNotes}</p>}
                    </div>
                  )}
                </article>
              ))}
              {history.length === 0 && (
                <p className="ui-subtle-note">
                  {t("drawer.noPrevious")}
                </p>
              )}
            </div>
          </section>
        </div>

        {appointment.status === "confirmed" && (
          <footer className="border-t border-wave-deep/10 p-5">
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="focus-ring inline-flex items-center gap-2 rounded-full border border-wave-deep/25 bg-wave-deep/10 px-4 py-2 font-semibold text-wave-deep disabled:opacity-45"
            >
              <CalendarX2 size={16} />
              {cancelMutation.isPending ? t("drawer.cancelling") : t("drawer.cancelAppointment")}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-wave-deep/10 py-3 last:border-b-0">
      <dt className="font-semibold">{label}</dt>
      <dd className="mt-1 text-wave-ink/70">{value}</dd>
    </div>
  );
}

function serviceFromAppointment(appointment: Appointment): Service {
  return {
    id: appointment.serviceId,
    name: appointment.serviceNameSnapshot,
    nameEn: appointment.serviceNameSnapshot,
    nameZh: appointment.serviceNameZhSnapshot ?? appointment.serviceNameSnapshot,
    description: "",
    descriptionEn: "",
    descriptionZh: "",
    durationMinutes: appointment.serviceDurationMinutesSnapshot,
    calendarBlockMinutes: getAppointmentCalendarBlockMinutes(appointment),
    priceCents: appointment.servicePriceCentsSnapshot,
    priceMaxCents: appointment.servicePriceMaxCentsSnapshot ?? null,
    priceIsStartingAt: Boolean(appointment.servicePriceIsStartingAtSnapshot),
    isActive: true,
    displayOrder: 0
  };
}

function getAppointmentCalendarBlockMinutes(appointment: Appointment): number {
  const blockMinutes = Math.round(
    (new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000
  );

  return blockMinutes > 0 ? blockMinutes : appointment.serviceDurationMinutesSnapshot;
}

function stylistFromAppointment(appointment: Appointment): Stylist {
  return {
    id: appointment.stylistId,
    name: appointment.stylistNameSnapshot,
    bio: "",
    specialties: [],
    serviceIds: [appointment.serviceId],
    isActive: true,
    displayOrder: 0
  };
}

function formatDateTime(value: string, locale: string): string {
  return formatDateInTimeZone(value, DEFAULT_SALON_TIME_ZONE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }, locale);
}
