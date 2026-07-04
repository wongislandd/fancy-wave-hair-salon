import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { bookingDetailsSchema, formatPrice, type BookingDetails } from "../lib/booking";
import { bookAppointment, getAvailableSlots, listPublicServices, nextBookableDates } from "../lib/data";
import type { AvailableSlot } from "../lib/types";

type Step = "service" | "time" | "details";

export function BookingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(nextBookableDates(1)[0]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const dates = useMemo(() => nextBookableDates(8), []);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });

  const selectedService = services.find((service) => service.id === serviceId);

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ["available-slots", serviceId, date],
    queryFn: () => getAvailableSlots(selectedService!, date),
    enabled: Boolean(selectedService)
  });

  const form = useForm<BookingDetails>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      notes: ""
    }
  });

  const mutation = useMutation({
    mutationFn: (values: BookingDetails) =>
      bookAppointment({
        serviceId,
        startsAt: slot!.startsAt,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        notes: values.notes
      }),
    onSuccess: (confirmation) => {
      navigate(`/booking-confirmed/${confirmation.managementToken}`);
    }
  });

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">Book online</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Reserve your Fancy Wave appointment</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-wave-deep/10 bg-white p-5 shadow-sm">
          {["service", "time", "details"].map((item, index) => (
            <div key={item} className="flex items-center gap-3 py-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === item ? "bg-wave-deep text-white" : "bg-wave-mint text-wave-deep"}`}>
                {index + 1}
              </span>
              <span className="capitalize">{item}</span>
            </div>
          ))}
        </aside>

        <div className="rounded-3xl border border-wave-deep/10 bg-white p-5 shadow-soft sm:p-7">
          {step === "service" && (
            <div>
              <h2 className="text-xl font-bold">Choose a service</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {servicesLoading && <p>Loading services...</p>}
                {services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setServiceId(service.id)}
                    className={`focus-ring rounded-2xl border p-4 text-left transition ${serviceId === service.id ? "border-wave-deep bg-wave-mint" : "border-wave-deep/10 hover:border-wave-deep/40"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold">{service.name}</h3>
                      {serviceId === service.id && <CheckCircle2 className="text-wave-deep" size={20} />}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-wave-ink/65">{service.description}</p>
                    <p className="mt-3 text-sm font-semibold">{service.durationMinutes} min · {formatPrice(service.priceCents)}</p>
                  </button>
                ))}
              </div>
              <FooterNav canContinue={Boolean(serviceId)} onNext={() => setStep("time")} />
            </div>
          )}

          {step === "time" && selectedService && (
            <div>
              <h2 className="text-xl font-bold">Pick a time</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {dates.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setDate(day);
                      setSlot(null);
                    }}
                    className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold ${date === day ? "border-wave-deep bg-wave-deep text-white" : "border-wave-deep/10 bg-white"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {slotsLoading && <p>Checking times...</p>}
                {!slotsLoading && slots.length === 0 && <p>No available times for this date.</p>}
                {slots.map((availableSlot) => (
                  <button
                    key={availableSlot.startsAt}
                    type="button"
                    onClick={() => setSlot(availableSlot)}
                    className={`focus-ring rounded-xl border px-4 py-3 font-semibold ${slot?.startsAt === availableSlot.startsAt ? "border-wave-deep bg-wave-mint text-wave-deep" : "border-wave-deep/10 bg-white hover:border-wave-deep/40"}`}
                  >
                    {availableSlot.label}
                  </button>
                ))}
              </div>
              <FooterNav canContinue={Boolean(slot)} onBack={() => setStep("service")} onNext={() => setStep("details")} />
            </div>
          )}

          {step === "details" && selectedService && slot && (
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <h2 className="text-xl font-bold">Your details</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={form.formState.errors.customerName?.message}>
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerName")} />
                </Field>
                <Field label="Email" error={form.formState.errors.customerEmail?.message}>
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerEmail")} />
                </Field>
                <Field label="Phone" error={form.formState.errors.customerPhone?.message}>
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerPhone")} />
                </Field>
                <Field label="Notes">
                  <textarea className="focus-ring min-h-24 w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("notes")} />
                </Field>
              </div>
              {mutation.error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{mutation.error.message}</p>}
              <FooterNav canContinue={!mutation.isPending} onBack={() => setStep("time")} submit label={mutation.isPending ? "Booking..." : "Confirm booking"} />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function FooterNav({
  canContinue,
  onBack,
  onNext,
  submit = false,
  label = "Continue"
}: {
  canContinue: boolean;
  onBack?: () => void;
  onNext?: () => void;
  submit?: boolean;
  label?: string;
}) {
  return (
    <div className="mt-8 flex justify-between gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-wave-ink/70 hover:bg-wave-mint">
          <ArrowLeft size={18} />
          Back
        </button>
      ) : <span />}
      <button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        disabled={!canContinue}
        className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white transition hover:bg-wave-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-rose-700">{error}</span>}
    </label>
  );
}
