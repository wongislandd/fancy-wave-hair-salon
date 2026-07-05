import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarPlus, Search } from "lucide-react";
import { AdminAddAppointmentDialog } from "../components/AdminAddAppointmentDialog";
import { AdminShell } from "../components/AdminShell";
import { AppointmentDetailDrawer } from "../components/AppointmentDetailDrawer";
import { StatusBadge } from "../components/StatusBadge";
import { appointmentStatusLabel, groupAppointmentsByDay } from "../lib/admin";
import {
  dateKeyInTimeZone,
  formatAppointmentRange,
  formatDateKeyInTimeZone,
  formatPriceRange
} from "../lib/booking";
import { listAdminAppointments } from "../lib/data";
import { useLanguage } from "../lib/use-language";
import {
  getAppointmentServiceName,
  localeForLanguage
} from "../lib/localization";
import type { Appointment, AppointmentStatus } from "../lib/types";

type StatusFilter = AppointmentStatus | "all";

const statusFilters: StatusFilter[] = ["all", "confirmed", "completed", "cancelled"];

export function AdminAppointmentsPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isAddAppointmentOpen, setIsAddAppointmentOpen] = useState(false);

  const appointmentsQuery = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: listAdminAppointments
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const selectedAppointment =
    appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;

  const filteredAppointments = useMemo(
    () => filterAppointments(appointments, search, statusFilter),
    [appointments, search, statusFilter]
  );

  const groupedAppointments = useMemo(
    () => groupAppointmentsByDay(filteredAppointments),
    [filteredAppointments]
  );

  const todayKey = dateKeyInTimeZone(new Date());
  const todayCount = appointments.filter((appointment) =>
    dateKeyInTimeZone(appointment.startsAt) === todayKey
  ).length;
  const confirmedCount = appointments.filter((appointment) => appointment.status === "confirmed").length;
  const customerCount = new Set(appointments.map(customerIdentityKey)).size;

  return (
    <AdminShell
      title={t("admin.appointments.title")}
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
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.appointments.metricToday")} value={todayCount} />
        <Metric label={t("admin.appointments.metricConfirmed")} value={confirmedCount} />
        <Metric label={t("admin.appointments.metricGuests")} value={customerCount} />
      </div>

      <section className="rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wave-ink/45" size={18} />
            <input
              className="focus-ring w-full rounded-full border border-wave-deep/15 py-3 pl-10 pr-4"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.appointments.search")}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-full bg-wave-mint p-1">
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                  statusFilter === status ? "bg-wave-deep text-white" : "text-wave-ink/70"
                }`}
              >
                {status === "all" ? t("common.all") : appointmentStatusLabel(status, language)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-7">
          {appointmentsQuery.isLoading && <p>{t("admin.appointments.loading")}</p>}
          {!appointmentsQuery.isLoading && filteredAppointments.length === 0 && (
            <p className="rounded-2xl bg-wave-mint/70 p-4 text-sm text-wave-ink/70">
              {t("admin.appointments.empty")}
            </p>
          )}
          {Object.entries(groupedAppointments).map(([day, dayAppointments]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-wave-deep">
                {formatDateKeyInTimeZone(day, undefined, undefined, locale)}
              </h2>
              <div className="space-y-3">
                {dayAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointmentId(appointment.id)}
                    className="focus-ring block w-full rounded-2xl border border-wave-deep/10 p-4 text-left transition hover:border-wave-deep/35 hover:bg-wave-mint/40"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black">{appointment.customerName}</p>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <p className="mt-1 break-words text-sm text-wave-ink/65">
                          {formatContactLine(appointment, t("admin.appointments.noContact"))}
                        </p>
                      </div>
                      <div className="min-w-0 text-sm text-wave-ink/70">
                        <p className="font-semibold text-wave-ink">{getAppointmentServiceName(appointment, language)}</p>
                        <p className="mt-1">{appointment.stylistNameSnapshot}</p>
                        <p className="mt-1">{formatAppointmentRange(appointment.startsAt, appointment.endsAt, undefined, locale)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 lg:justify-end">
                        <span className="text-sm font-semibold text-wave-ink/60">
                          {formatPriceRange({
                            priceCents: appointment.servicePriceCentsSnapshot,
                            priceMaxCents: appointment.servicePriceMaxCentsSnapshot,
                            priceIsStartingAt: appointment.servicePriceIsStartingAtSnapshot
                          }, locale)}
                        </span>
                        <ArrowUpRight size={18} className="text-wave-deep" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-wave-deep/10 bg-white px-5 py-4 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function filterAppointments(
  appointments: Appointment[],
  search: string,
  statusFilter: StatusFilter
): Appointment[] {
  const normalizedSearch = search.trim().toLowerCase();

  return appointments.filter((appointment) => {
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    if (!matchesStatus) return false;
    if (!normalizedSearch) return true;

    return [
      appointment.bookingReference,
      appointment.customerName,
      appointment.customerEmail,
      appointment.customerPhone,
      appointment.serviceNameSnapshot,
      appointment.serviceNameZhSnapshot,
      appointment.stylistNameSnapshot
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
}

function formatContactLine(appointment: Appointment, fallback: string): string {
  const email = appointment.customerEmail.trim();
  const phone = appointment.customerPhone.trim();
  if (email && phone) return `${email} / ${phone}`;
  return email || phone || fallback;
}

function customerIdentityKey(appointment: Appointment): string {
  const email = appointment.customerEmail.trim().toLowerCase();
  const phone = appointment.customerPhone.trim();
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return `appointment:${appointment.id}`;
}
