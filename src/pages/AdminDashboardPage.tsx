import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarX2, Clock, LogOut, Plus, Save } from "lucide-react";
import {
  cancelAppointmentAsStaff,
  isStaffSignedIn,
  listAdminAppointments,
  listAdminServices,
  listBusinessHours,
  saveService,
  signOutStaff,
  updateBusinessHour
} from "../lib/data";
import { appointmentStatusLabel, groupAppointmentsByDay, serviceFormSchema } from "../lib/admin";
import { formatAppointmentRange, formatPrice } from "../lib/booking";
import { StatusBadge } from "../components/StatusBadge";
import type { BusinessHour, Service } from "../lib/types";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    isStaffSignedIn().then((signedIn) => {
      if (!signedIn) navigate("/admin/login");
      setCheckedSession(true);
    });
  }, [navigate]);

  const appointmentsQuery = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: listAdminAppointments,
    enabled: checkedSession
  });
  const servicesQuery = useQuery({
    queryKey: ["admin-services"],
    queryFn: listAdminServices,
    enabled: checkedSession
  });
  const hoursQuery = useQuery({
    queryKey: ["business-hours"],
    queryFn: listBusinessHours,
    enabled: checkedSession
  });

  const groupedAppointments = useMemo(
    () => groupAppointmentsByDay(appointmentsQuery.data ?? []),
    [appointmentsQuery.data]
  );

  const cancelMutation = useMutation({
    mutationFn: cancelAppointmentAsStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-appointments"] })
  });

  const signOutMutation = useMutation({
    mutationFn: signOutStaff,
    onSuccess: () => navigate("/")
  });

  if (!checkedSession) {
    return <section className="mx-auto max-w-7xl px-4 py-10">Checking staff session...</section>;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">Admin</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Salon operations</h1>
        </div>
        <button className="focus-ring inline-flex items-center gap-2 rounded-full border border-wave-deep/10 bg-white px-4 py-2 font-semibold" onClick={() => signOutMutation.mutate()}>
          <LogOut size={18} />
          Sign out
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-wave-deep/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold">Agenda</h2>
          <div className="mt-5 space-y-6">
            {Object.entries(groupedAppointments).map(([day, appointments]) => (
              <div key={day}>
                <h3 className="mb-3 font-semibold text-wave-deep">{day}</h3>
                <div className="space-y-3">
                  {appointments.map((appointment) => (
                    <article key={appointment.id} className="rounded-2xl border border-wave-deep/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{appointment.customerName}</p>
                          <p className="mt-1 text-sm text-wave-ink/65">{appointment.serviceNameSnapshot} · {formatAppointmentRange(appointment.startsAt, appointment.endsAt)}</p>
                          <p className="mt-1 text-xs font-semibold text-wave-ink/45">{appointment.bookingReference}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={appointment.status} />
                          {appointment.status === "confirmed" && (
                            <button
                              type="button"
                              onClick={() => cancelMutation.mutate(appointment.id)}
                              className="focus-ring rounded-full border border-rose-200 p-2 text-rose-700"
                              title="Cancel appointment"
                            >
                              <CalendarX2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {appointmentsQuery.data?.length === 0 && <p>No appointments yet.</p>}
          </div>
        </section>

        <div className="space-y-6">
          <ServiceEditor services={servicesQuery.data ?? []} />
          <BusinessHoursEditor hours={hoursQuery.data ?? []} />
        </div>
      </div>
    </section>
  );
}

function ServiceEditor({ services }: { services: Service[] }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = services.find((service) => service.id === selectedId);
  const [form, setForm] = useState({
    name: selected?.name ?? "",
    description: selected?.description ?? "",
    durationMinutes: selected?.durationMinutes ?? 60,
    priceDollars: selected ? selected.priceCents / 100 : 65,
    isActive: selected?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      name: selected?.name ?? "",
      description: selected?.description ?? "",
      durationMinutes: selected?.durationMinutes ?? 60,
      priceDollars: selected ? selected.priceCents / 100 : 65,
      isActive: selected?.isActive ?? true
    });
  }, [selected]);

  const mutation = useMutation({
    mutationFn: () => saveService(serviceFormSchema.parse(form), selectedId || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services"] })
  });

  return (
    <section className="rounded-3xl border border-wave-deep/10 bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Services</h2>
        <button className="focus-ring rounded-full bg-wave-mint p-2 text-wave-deep" onClick={() => setSelectedId("")} title="New service">
          <Plus size={18} />
        </button>
      </div>
      <select className="focus-ring mb-4 w-full rounded-xl border border-wave-deep/15 px-3 py-3" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">New service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>{service.name} · {appointmentStatusLabel(service.isActive ? "confirmed" : "cancelled")}</option>
        ))}
      </select>
      <div className="grid gap-3">
        <input className="focus-ring rounded-xl border border-wave-deep/15 px-3 py-3" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <textarea className="focus-ring min-h-20 rounded-xl border border-wave-deep/15 px-3 py-3" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input className="focus-ring rounded-xl border border-wave-deep/15 px-3 py-3" type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} />
          <input className="focus-ring rounded-xl border border-wave-deep/15 px-3 py-3" type="number" value={form.priceDollars} onChange={(event) => setForm({ ...form, priceDollars: Number(event.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          Active publicly
        </label>
      </div>
      <button onClick={() => mutation.mutate()} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white">
        <Save size={18} />
        Save service
      </button>
      <div className="mt-5 space-y-2 text-sm text-wave-ink/70">
        {services.slice(0, 4).map((service) => (
          <div key={service.id} className="flex justify-between rounded-xl bg-wave-mint/60 px-3 py-2">
            <span>{service.name}</span>
            <span>{formatPrice(service.priceCents)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BusinessHoursEditor({ hours }: { hours: BusinessHour[] }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ hour, patch }: { hour: BusinessHour; patch: Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed"> }) =>
      updateBusinessHour(hour, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-hours"] })
  });

  return (
    <section className="rounded-3xl border border-wave-deep/10 bg-white p-6 shadow-soft">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Clock size={20} /> Hours</h2>
      <div className="space-y-3">
        {hours.map((hour) => (
          <div key={hour.id} className="grid grid-cols-[42px_1fr_1fr_74px] items-center gap-2 text-sm">
            <span className="font-semibold">{dayNames[hour.dayOfWeek]}</span>
            <input className="focus-ring rounded-lg border border-wave-deep/15 px-2 py-2" value={hour.opensAt} onChange={(event) => mutation.mutate({ hour, patch: { ...hour, opensAt: event.target.value } })} />
            <input className="focus-ring rounded-lg border border-wave-deep/15 px-2 py-2" value={hour.closesAt} onChange={(event) => mutation.mutate({ hour, patch: { ...hour, closesAt: event.target.value } })} />
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={hour.isClosed} onChange={(event) => mutation.mutate({ hour, patch: { ...hour, isClosed: event.target.checked } })} />
              Closed
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
