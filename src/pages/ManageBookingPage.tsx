import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { CalendarX2, RotateCw } from "lucide-react";
import {
  cancelManagedBooking,
  getAvailableSlots,
  listPublicServices,
  loadBookingByToken,
  nextBookableDates,
  rescheduleManagedBooking
} from "../lib/data";
import {
  formatAppointmentRange,
  formatPrice,
  isCustomerManageableStatus
} from "../lib/booking";
import { StatusBadge } from "../components/StatusBadge";
import type { AvailableSlot, Service } from "../lib/types";

export function ManageBookingPage({ confirmed = false }: { confirmed?: boolean }) {
  const { token = "" } = useParams();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(nextBookableDates(1)[0]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
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
  const service = services.find((item) => item.id === booking?.serviceId) ?? synthesizeService(booking ?? null);

  const slotsQuery = useQuery({
    queryKey: ["managed-slots", booking?.serviceId, date],
    queryFn: () => getAvailableSlots(service!, date),
    enabled: Boolean(service && booking && isCustomerManageableStatus(booking.status))
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

  if (bookingQuery.isLoading) {
    return <PageShell title="Loading booking..." />;
  }

  if (!booking) {
    return (
      <PageShell title="Booking not found">
        <p className="text-wave-ink/70">This management link is invalid or expired.</p>
        <Link className="mt-5 inline-flex rounded-full bg-wave-deep px-5 py-3 font-semibold text-white" to="/book">
          Book a new appointment
        </Link>
      </PageShell>
    );
  }

  const manageable = isCustomerManageableStatus(booking.status);

  return (
    <PageShell title={confirmed ? "You're booked" : "Manage booking"}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-3xl border border-wave-deep/10 bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{booking.bookingReference}</p>
              <h2 className="mt-1 text-2xl font-bold">{booking.serviceName}</h2>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold">When</dt>
              <dd className="mt-1 text-wave-ink/70">{formatAppointmentRange(booking.startsAt, booking.endsAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Guest</dt>
              <dd className="mt-1 text-wave-ink/70">{booking.customerName} · {booking.customerEmail}</dd>
            </div>
            <div>
              <dt className="font-semibold">Service</dt>
              <dd className="mt-1 text-wave-ink/70">{booking.serviceDurationMinutes} min · {formatPrice(booking.servicePriceCents)}</dd>
            </div>
          </dl>
          {!manageable && (
            <p className="mt-5 rounded-2xl bg-wave-mint p-4 text-sm text-wave-ink/70">
              This appointment can no longer be changed from the customer link.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-wave-deep/10 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold">Self-service actions</h2>
          <div className="mt-5 grid gap-5">
            <div>
              <h3 className="font-semibold">Reschedule</h3>
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
                    className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-45 ${date === day ? "border-wave-deep bg-wave-deep text-white" : "border-wave-deep/10"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {slotsQuery.data?.map((availableSlot) => (
                  <button
                    key={availableSlot.startsAt}
                    type="button"
                    disabled={!manageable}
                    onClick={() => setSlot(availableSlot)}
                    className={`focus-ring rounded-xl border px-4 py-3 font-semibold disabled:opacity-45 ${slot?.startsAt === availableSlot.startsAt ? "border-wave-deep bg-wave-mint" : "border-wave-deep/10"}`}
                  >
                    {availableSlot.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!manageable || !slot || rescheduleMutation.isPending}
                onClick={() => rescheduleMutation.mutate()}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white disabled:opacity-45"
              >
                <RotateCw size={18} />
                {rescheduleMutation.isPending ? "Moving..." : "Move appointment"}
              </button>
            </div>

            <div className="border-t border-wave-deep/10 pt-5">
              <h3 className="font-semibold">Cancel</h3>
              <p className="mt-2 text-sm text-wave-ink/65">Cancelling keeps the record visible for staff but frees the slot.</p>
              <button
                type="button"
                disabled={!manageable || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 disabled:opacity-45"
              >
                <CalendarX2 size={18} />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel appointment"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function PageShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">Fancy Wave</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h1>
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
    name: booking.serviceName,
    description: "",
    durationMinutes: booking.serviceDurationMinutes,
    priceCents: booking.servicePriceCents,
    isActive: true,
    displayOrder: 0
  };
}
