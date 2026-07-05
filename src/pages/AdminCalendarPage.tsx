import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminAddAppointmentDialog } from "../components/AdminAddAppointmentDialog";
import { AdminShell } from "../components/AdminShell";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { buildCalendarDayLayouts, getCalendarViewDays, moveCalendarAnchor } from "../lib/calendar";
import {
  DEFAULT_SALON_TIME_ZONE,
  dateKeyInTimeZone,
  formatDateInTimeZone,
  formatTimeInTimeZone
} from "../lib/booking";
import { listAdminAppointments } from "../lib/data";
import { useLanguage } from "../lib/use-language";
import {
  getAppointmentServiceName,
  type Language,
  localeForLanguage
} from "../lib/localization";
import type { CalendarEventLayout, CalendarViewMode } from "../lib/calendar";
import type { Appointment } from "../lib/types";

const viewOptions: Array<{ id: CalendarViewMode; labelKey: "admin.calendar.day" | "admin.calendar.threeDay" | "admin.calendar.week" }> = [
  { id: "day", labelKey: "admin.calendar.day" },
  { id: "threeDay", labelKey: "admin.calendar.threeDay" },
  { id: "week", labelKey: "admin.calendar.week" }
];

const startHour = 8;
const endHour = 20;
const hourHeight = 92;
const stylistColors = ["#111827", "#1f2937", "#374151", "#4b5563", "#6b7280"];

export function AdminCalendarPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [activeView, setActiveView] = useState<CalendarViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);

  const appointmentsQuery = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: listAdminAppointments
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const selectedAppointment =
    appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  const days = useMemo(() => getCalendarViewDays(anchorDate, activeView), [activeView, anchorDate]);
  const stylistColorMap = useMemo(() => buildStylistColorMap(appointments), [appointments]);
  const timeColumnWidth = activeView === "week" ? "64px" : "76px";
  const calendarColumns = `${timeColumnWidth} repeat(${days.length}, minmax(0, 1fr))`;
  const timeLabels = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
    []
  );

  return (
    <AdminShell
      title={t("admin.calendar.title")}
      actions={
        <button
          type="button"
          onClick={() => setIsAddAppointmentOpen(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 font-semibold text-white"
        >
          <CalendarPlus size={18} />
          {t("admin.appointments.add")}
        </button>
      }
    >
      <section className="rounded-3xl border border-wave-deep/10 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="focus-ring rounded-full border border-wave-deep/10 p-2"
              onClick={() => setAnchorDate((current) => moveCalendarAnchor(current, activeView, -1))}
              aria-label={t("admin.calendar.previous")}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="focus-ring rounded-full border border-wave-deep/10 px-4 py-2 font-semibold"
              onClick={() => setAnchorDate(new Date())}
            >
              {t("common.today")}
            </button>
            <button
              type="button"
              className="focus-ring rounded-full border border-wave-deep/10 p-2"
              onClick={() => setAnchorDate((current) => moveCalendarAnchor(current, activeView, 1))}
              aria-label={t("admin.calendar.next")}
            >
              <ChevronRight size={18} />
            </button>
            <h2 className="ml-1 text-xl font-black">{formatCalendarTitle(days, DEFAULT_SALON_TIME_ZONE, locale)}</h2>
          </div>

          <div className="flex shrink-0 gap-2 rounded-full bg-wave-mint p-1">
            {viewOptions.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                  activeView === view.id ? "bg-wave-deep text-white" : "text-wave-ink/70"
                }`}
              >
                {t(view.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {appointmentsQuery.isLoading ? (
          <p className="rounded-2xl bg-wave-mint/70 p-4 text-sm text-wave-ink/70">{t("admin.calendar.loading")}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-wave-deep/10 bg-white">
            <div className="w-full">
              <div
                className="grid border-b border-wave-deep/10 bg-wave-mint/70"
                style={{ gridTemplateColumns: calendarColumns }}
              >
                <div className="truncate px-2 py-3 text-xs font-bold uppercase tracking-wide text-wave-deep sm:px-3">
                  {t("admin.calendar.time")}
                </div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="min-w-0 border-l border-wave-deep/10 px-2 py-3 sm:px-3">
                    <p className="truncate text-sm font-black">
                      {formatDateInTimeZone(day, DEFAULT_SALON_TIME_ZONE, { weekday: "short" }, locale)}
                    </p>
                    <p className="truncate text-xs text-wave-ink/65 sm:text-sm">
                      {formatDateInTimeZone(day, DEFAULT_SALON_TIME_ZONE, { month: "short", day: "numeric" }, locale)}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: calendarColumns,
                  height: `${(endHour - startHour) * hourHeight}px`
                }}
              >
                <div className="relative border-r border-wave-deep/10 bg-white">
                  {timeLabels.slice(0, -1).map((hour, index) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 truncate border-t border-wave-deep/10 px-2 pt-2 text-[11px] font-bold text-wave-ink/55 sm:px-3 sm:text-xs"
                      style={{ top: `${index * hourHeight}px` }}
                    >
                      {formatHour(hour, locale)}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <DayColumn
                    key={day.toISOString()}
                    day={day}
                    appointments={appointments}
                    stylistColorMap={stylistColorMap}
                    onSelectAppointment={setSelectedAppointmentId}
                    timeZone={DEFAULT_SALON_TIME_ZONE}
                    locale={locale}
                    language={language}
                    showEmptyState={activeView === "day"}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <AppointmentDetailDrawer
        appointment={selectedAppointment}
        appointments={appointments}
        onClose={() => setSelectedAppointmentId(null)}
      />
      {isAddAppointmentOpen && (
        <AdminAddAppointmentDialog onClose={() => setIsAddAppointmentOpen(false)} />
      )}
    </AdminShell>
  );
}

function DayColumn({
  day,
  appointments,
  stylistColorMap,
  onSelectAppointment,
  timeZone,
  locale,
  language,
  showEmptyState
}: {
  day: Date;
  appointments: Appointment[];
  stylistColorMap: Map<string, string>;
  onSelectAppointment: (id: string) => void;
  timeZone: string;
  locale: string;
  language: Language;
  showEmptyState: boolean;
}) {
  const { t } = useLanguage();
  const layouts = buildCalendarDayLayouts(appointments, day, startHour, endHour, timeZone);

  return (
    <div className="relative min-w-0 border-l border-wave-deep/10 bg-white">
      {Array.from({ length: endHour - startHour }, (_, index) => (
        <div
          key={index}
          className="absolute left-0 right-0 border-t border-wave-deep/10"
          style={{ top: `${index * hourHeight}px` }}
        />
      ))}
      {showEmptyState && layouts.length === 0 && (
        <div className="pointer-events-none absolute left-3 right-3 top-3 rounded-xl border border-dashed border-wave-deep/10 bg-wave-mint/60 p-3 text-center text-xs font-semibold text-wave-ink/60">
          {t("admin.calendar.noAppointments")}
        </div>
      )}
      {layouts.map((layout) => (
        <CalendarEvent
          key={layout.appointment.id}
          layout={layout}
          color={stylistColorMap.get(layout.appointment.stylistId) ?? stylistColors[0]}
          locale={locale}
          language={language}
          onClick={() => onSelectAppointment(layout.appointment.id)}
        />
      ))}
    </div>
  );
}

function CalendarEvent({
  layout,
  color,
  locale,
  language,
  onClick
}: {
  layout: CalendarEventLayout;
  color: string;
  locale: string;
  language: Language;
  onClick: () => void;
}) {
  const { appointment } = layout;
  const isCancelled = appointment.status === "cancelled";
  const laneWidth = 100 / layout.laneCount;

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring absolute overflow-hidden rounded-xl border border-white/15 p-2 text-left text-white transition hover:brightness-95"
      style={{
        top: `${layout.topPercent}%`,
        height: `calc(${layout.heightPercent}% - 4px)`,
        left: `calc(${layout.lane * laneWidth}% + 4px)`,
        width: `calc(${laneWidth}% - 8px)`,
        backgroundColor: isCancelled ? "#e5e7eb" : color,
        color: isCancelled ? "#374151" : "#ffffff",
        opacity: isCancelled ? 0.78 : 1
      }}
    >
      <span className="block truncate text-[11px] font-bold leading-tight sm:text-xs">
        {formatTimeRange(appointment, locale)}
      </span>
      <span className="mt-1 block truncate text-sm font-black leading-tight">{appointment.customerName}</span>
      <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-90 sm:text-xs">
        {getAppointmentServiceName(appointment, language)}
      </span>
      <span className="mt-0.5 block truncate text-[11px] leading-tight opacity-90 sm:text-xs">
        {appointment.stylistNameSnapshot}
      </span>
    </button>
  );
}

function buildStylistColorMap(appointments: Appointment[]): Map<string, string> {
  const stylistIds = Array.from(new Set(appointments.map((appointment) => appointment.stylistId)));
  return new Map(
    stylistIds.map((stylistId, index) => [stylistId, stylistColors[index % stylistColors.length]])
  );
}

function formatCalendarTitle(days: Date[], timeZone: string, locale: string): string {
  if (days.length === 1) {
    return formatDateInTimeZone(days[0], timeZone, {
      weekday: "long",
      month: "short",
      day: "numeric"
    }, locale);
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const firstKey = dateKeyInTimeZone(firstDay, timeZone);
  const lastKey = dateKeyInTimeZone(lastDay, timeZone);
  const [firstYear, firstMonth] = firstKey.split("-");
  const [lastYear, lastMonth] = lastKey.split("-");

  if (firstMonth === lastMonth && firstYear === lastYear) {
    return `${formatDateInTimeZone(firstDay, timeZone, {
      month: "short",
      day: "numeric"
    }, locale)} - ${formatDateInTimeZone(lastDay, timeZone, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }, locale)}`;
  }
  if (firstYear === lastYear) {
    return `${formatDateInTimeZone(firstDay, timeZone, {
      month: "short",
      day: "numeric"
    }, locale)} - ${formatDateInTimeZone(lastDay, timeZone, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }, locale)}`;
  }
  return `${formatDateInTimeZone(firstDay, timeZone, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }, locale)} - ${formatDateInTimeZone(lastDay, timeZone, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }, locale)}`;
}

function formatHour(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

function formatTimeRange(appointment: Appointment, locale: string): string {
  return `${formatTimeInTimeZone(appointment.startsAt, undefined, locale)} - ${formatTimeInTimeZone(appointment.endsAt, undefined, locale)}`;
}
