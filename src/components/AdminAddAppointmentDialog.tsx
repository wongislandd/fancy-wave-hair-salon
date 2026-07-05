import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Clock3, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  DEFAULT_SALON_TIME_ZONE,
  formatDateInTimeZone,
  formatDateKeyInTimeZone,
  formatPriceRange,
  formatTimeInTimeZone
} from "../lib/booking";
import { staffAppointmentFormSchema, type StaffAppointmentFormValues } from "../lib/admin";
import {
  bookStaffAppointment,
  getAvailableSlots,
  listPublicServices,
  listPublicStylists,
  nextBookableDates
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedServiceText, localeForLanguage } from "../lib/localization";
import type { AvailableSlot, Service, Stylist } from "../lib/types";

export function AdminAddAppointmentDialog({ onClose }: { onClose: () => void }) {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const queryClient = useQueryClient();
  const dates = useMemo(() => nextBookableDates(10), []);
  const [serviceId, setServiceId] = useState("");
  const [stylistId, setStylistId] = useState("");
  const [date, setDate] = useState(dates[0] ?? "");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const form = useForm<StaffAppointmentFormValues>({
    resolver: zodResolver(staffAppointmentFormSchema),
    defaultValues: {
      serviceId: "",
      stylistId: "",
      startsAt: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      notes: "",
      internalNotes: ""
    }
  });

  const servicesQuery = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });

  const services = servicesQuery.data ?? [];
  const selectedService = services.find((service) => service.id === serviceId) ?? null;

  const stylistsQuery = useQuery({
    queryKey: ["public-stylists", serviceId],
    queryFn: () => listPublicStylists(serviceId),
    enabled: Boolean(serviceId)
  });

  const stylists = stylistsQuery.data ?? [];
  const selectedStylist = stylists.find((stylist) => stylist.id === stylistId) ?? null;
  const canChooseTime = Boolean(selectedService && selectedStylist);

  const slotsQuery = useQuery({
    queryKey: ["staff-available-slots", serviceId, stylistId, date],
    queryFn: () => getAvailableSlots(selectedService!, date, selectedStylist),
    enabled: Boolean(canChooseTime && date)
  });

  const slots = slotsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: (values: StaffAppointmentFormValues) =>
      bookStaffAppointment({
        serviceId: values.serviceId,
        stylistId: values.stylistId,
        startsAt: values.startsAt,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        notes: values.notes,
        internalNotes: values.internalNotes
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      onClose();
    }
  });

  function selectService(service: Service) {
    setServiceId(service.id);
    setStylistId("");
    setSelectedSlot(null);
    form.setValue("serviceId", service.id, { shouldValidate: true });
    form.setValue("stylistId", "", { shouldValidate: true });
    form.setValue("startsAt", "", { shouldValidate: true });
  }

  function selectStylist(stylist: Stylist) {
    setStylistId(stylist.id);
    setSelectedSlot(null);
    form.setValue("stylistId", stylist.id, { shouldValidate: true });
    form.setValue("startsAt", "", { shouldValidate: true });
  }

  function selectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    form.setValue("startsAt", slot.startsAt, { shouldValidate: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-wave-ink/35 backdrop-blur-sm">
      <button
        type="button"
        className="hidden flex-1 cursor-default md:block"
        aria-label={t("drawer.close")}
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white">
        <header className="border-b border-wave-deep/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{t("common.admin")}</p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
                <CalendarPlus size={24} />
                {t("admin.addAppointment.title")}
              </h2>
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
        </header>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="min-h-0 flex-1 overflow-y-auto p-5"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("booking.step.service")}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {servicesQuery.isLoading && <p className="text-sm text-wave-ink/65">{t("booking.loadingServices")}</p>}
                  {services.map((service) => {
                    const serviceText = getLocalizedServiceText(service, language);

                    return (
                      <ChoiceButton
                        key={service.id}
                        selected={service.id === serviceId}
                        onClick={() => selectService(service)}
                        title={serviceText.name}
                        meta={`${service.durationMinutes} ${t("common.min")} / ${formatPriceRange(service, locale)}`}
                      />
                    );
                  })}
                </div>
                <FieldError message={form.formState.errors.serviceId?.message} />
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("booking.step.stylist")}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {!serviceId && <p className="text-sm text-wave-ink/65">{t("admin.addAppointment.chooseServiceFirst")}</p>}
                  {stylistsQuery.isLoading && <p className="text-sm text-wave-ink/65">{t("booking.loadingStylists")}</p>}
                  {stylists.map((stylist) => (
                    <ChoiceButton
                      key={stylist.id}
                      selected={stylist.id === stylistId}
                      onClick={() => selectStylist(stylist)}
                      title={stylist.name}
                      meta={stylist.specialties.join(", ")}
                    />
                  ))}
                </div>
                <FieldError message={form.formState.errors.stylistId?.message} />
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("booking.step.time")}</h3>
                {!canChooseTime ? (
                  <div
                    className="mt-3 rounded-2xl border border-dashed border-wave-deep/15 bg-wave-cream/45 p-4 text-sm font-medium text-wave-ink/55"
                    aria-disabled="true"
                  >
                    {t("admin.addAppointment.chooseServiceStylist")}
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      {dates.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setDate(day);
                            setSelectedSlot(null);
                            form.setValue("startsAt", "", { shouldValidate: true });
                          }}
                          className={`focus-ring min-w-[112px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                            date === day
                              ? "border-wave-deep bg-wave-deep text-white"
                              : "border-wave-deep/10 bg-white"
                          }`}
                        >
                          <span className="block">{formatDayName(day, locale)}</span>
                          <span className={date === day ? "text-white/75" : "text-wave-ink/55"}>
                            {formatShortDate(day, locale)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 rounded-2xl border border-wave-deep/10 bg-wave-cream/60 p-4">
                      {slotsQuery.isFetching && <p className="text-sm text-wave-ink/65">{t("admin.addAppointment.checkingAvailability")}</p>}
                      {!slotsQuery.isFetching && slots.length === 0 ? (
                        <p className="text-sm text-wave-ink/65">{t("booking.noTimes")}</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {slots.map((slot) => (
                            <button
                              key={`${slot.stylistId}-${slot.startsAt}`}
                              type="button"
                              onClick={() => selectSlot(slot)}
                              className={`focus-ring rounded-2xl border bg-white p-4 text-left transition ${
                                selectedSlot?.startsAt === slot.startsAt
                                  ? "border-wave-deep ring-2 ring-wave-deep/20"
                                  : "border-wave-deep/10 hover:border-wave-deep/40"
                              }`}
                            >
                              <span className="flex items-center gap-2 text-lg font-black">
                                <Clock3 size={16} />
                                {formatSlotTime(slot.startsAt, locale)}
                              </span>
                              <span className="mt-1 block text-sm text-wave-ink/65">{slot.stylistName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <FieldError message={form.formState.errors.startsAt?.message} />
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-wave-deep/10 bg-wave-mint/45 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-wave-deep">{t("admin.addAppointment.guestDetails")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.addAppointment.guestName")} error={form.formState.errors.customerName?.message}>
                    <input
                      className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3"
                      {...form.register("customerName")}
                    />
                  </Field>
                  <Field label={t("booking.email")} error={form.formState.errors.customerEmail?.message}>
                    <input
                      className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3"
                      inputMode="email"
                      {...form.register("customerEmail")}
                    />
                  </Field>
                  <Field label={t("booking.phone")} error={form.formState.errors.customerPhone?.message}>
                    <input
                      className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3"
                      inputMode="tel"
                      {...form.register("customerPhone")}
                    />
                  </Field>
                  <Field label={t("drawer.staffNotes")} error={form.formState.errors.internalNotes?.message}>
                    <textarea
                      className="focus-ring min-h-24 w-full rounded-xl border border-wave-deep/15 px-3 py-3"
                      {...form.register("internalNotes")}
                    />
                  </Field>
                </div>
              </section>

              {selectedService && selectedStylist && selectedSlot && (
                <section className="rounded-2xl border border-wave-deep/10 p-4 text-sm">
                  <p className="font-bold">
                    {t("booking.summary", {
                      service: getLocalizedServiceText(selectedService, language).name,
                      stylist: selectedStylist.name
                    })}
                  </p>
                  <p className="mt-1 text-wave-ink/70">
                    {formatDateInTimeZone(selectedSlot.startsAt, DEFAULT_SALON_TIME_ZONE, {
                      weekday: "long",
                      month: "long",
                      day: "numeric"
                    }, locale)}{" "}
                    {formatSlotTime(selectedSlot.startsAt, locale)}
                  </p>
                </section>
              )}

              {mutation.error && (
                <p className="rounded-xl bg-wave-deep/10 p-3 text-sm text-wave-deep">{mutation.error.message}</p>
              )}
            </div>
          </div>

          <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t border-wave-deep/10 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full border border-wave-deep/10 px-4 py-2 font-semibold"
            >
              {t("manage.cancel")}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white transition hover:bg-wave-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarPlus size={18} />
              {mutation.isPending ? t("common.saving") : t("admin.addAppointment.save")}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  title,
  meta
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-2xl border p-4 text-left transition ${
        selected ? "border-wave-deep bg-wave-mint" : "border-wave-deep/10 bg-white hover:border-wave-deep/40"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block font-bold">{title}</span>
          <span className="mt-1 block text-sm text-wave-ink/65">{meta}</span>
        </span>
        {selected && <CheckCircle2 className="shrink-0 text-wave-deep" size={18} />}
      </span>
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-sm text-wave-deep">{message}</span>;
}

function formatDayName(date: string, locale: string): string {
  return formatDateKeyInTimeZone(date, DEFAULT_SALON_TIME_ZONE, { weekday: "short" }, locale);
}

function formatShortDate(date: string, locale: string): string {
  return formatDateKeyInTimeZone(date, DEFAULT_SALON_TIME_ZONE, { month: "short", day: "numeric" }, locale);
}

function formatSlotTime(date: string, locale: string): string {
  return formatTimeInTimeZone(date, DEFAULT_SALON_TIME_ZONE, locale);
}
