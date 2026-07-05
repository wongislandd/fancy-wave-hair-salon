import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_SALON_TIME_ZONE,
  bookingDetailsSchema,
  formatDateInTimeZone,
  formatDateKeyInTimeZone,
  formatPriceRange,
  formatTimeInTimeZone,
  hourInTimeZone,
  type BookingDetails
} from "../lib/booking";
import {
  bookAppointment,
  getAvailableSlots,
  listPublicServices,
  listPublicStylists,
  nextBookableDates
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedServiceText, getLocalizedStylistText, localeForLanguage } from "../lib/localization";
import type { AvailableSlot, Service, Stylist } from "../lib/types";

type Step = "service" | "stylist" | "time" | "details";

const steps: Array<{ id: Step; labelKey: "booking.step.service" | "booking.step.stylist" | "booking.step.time" | "booking.step.details" }> = [
  { id: "service", labelKey: "booking.step.service" },
  { id: "stylist", labelKey: "booking.step.stylist" },
  { id: "time", labelKey: "booking.step.time" },
  { id: "details", labelKey: "booking.step.details" }
];

export function BookingPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [stylistId, setStylistId] = useState("any");
  const [date, setDate] = useState(nextBookableDates(1)[0]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const dates = useMemo(() => nextBookableDates(8), []);
  const currentStepIndex = steps.findIndex((item) => item.id === step);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedServiceText = selectedService
    ? getLocalizedServiceText(selectedService, language)
    : null;

  const { data: stylists = [], isLoading: stylistsLoading } = useQuery({
    queryKey: ["public-stylists", serviceId],
    queryFn: () => listPublicStylists(serviceId),
    enabled: Boolean(serviceId)
  });

  const selectedStylist = stylists.find((stylist) => stylist.id === stylistId) ?? null;

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ["available-slots", serviceId, stylistId, date],
    queryFn: () => getAvailableSlots(selectedService!, date, selectedStylist),
    enabled: Boolean(selectedService && stylistId)
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
        stylistId: slot!.stylistId,
        startsAt: slot!.startsAt,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        notes: values.notes
      }),
    onSuccess: (confirmation) => {
      navigate(`/booking-confirmed/${confirmation.managementToken}`, {
        state: { bookingJustCompleted: true }
      });
    }
  });

  return (
    <section className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-5 sm:mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{t("booking.eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-black sm:text-4xl">{t("booking.title")}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <aside className="ui-surface-compact shadow-sm lg:sticky lg:top-24 lg:self-start">
          <div className="grid grid-cols-4 gap-2 lg:block">
            {steps.map((item, index) => {
              const isCurrent = step === item.id;
              const isComplete = index < currentStepIndex;

              return (
                <div
                  key={item.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold leading-tight lg:flex-row lg:gap-3 lg:px-0 lg:py-3 lg:text-left lg:text-base ${isCurrent ? "bg-wave-mint/70 text-wave-ink lg:bg-transparent" : "text-wave-ink/65"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCurrent ? "bg-wave-deep text-white" : isComplete ? "bg-wave-deep/10 text-wave-deep" : "bg-wave-mint text-wave-deep"}`}>
                    {isComplete ? <CheckCircle2 size={16} /> : index + 1}
                  </span>
                  <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="ui-surface min-w-0 pb-28 sm:p-7">
          {step === "service" && (
            <div>
              <h2 className="text-xl font-bold">{t("booking.chooseService")}</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {servicesLoading && <p>{t("booking.loadingServices")}</p>}
                {services.map((service) => {
                  const serviceText = getLocalizedServiceText(service, language);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setServiceId(service.id);
                        setStylistId("any");
                        setSlot(null);
                      }}
                      className={`focus-ring rounded-2xl border p-4 text-left transition ${serviceId === service.id ? "border-wave-deep bg-wave-mint/70" : "border-wave-deep/10 bg-white hover:bg-wave-mint/35"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold">{serviceText.name}</h3>
                        {serviceId === service.id && <CheckCircle2 className="text-wave-deep" size={20} />}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-wave-ink/65">{serviceText.description}</p>
                      <p className="mt-3 text-sm font-semibold">
                        {service.durationMinutes} {t("common.min")} / {formatPriceRange(service, locale)}
                      </p>
                    </button>
                  );
                })}
              </div>
              <FooterNav canContinue={Boolean(serviceId)} onNext={() => setStep("stylist")} />
            </div>
          )}

          {step === "stylist" && selectedService && (
            <div>
              <h2 className="text-xl font-bold">{t("booking.chooseStylist")}</h2>
              <p className="mt-2 text-sm text-wave-ink/65">{t("booking.chooseStylistCopy")}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <StylistChoice
                  selected={stylistId === "any"}
                  name={t("booking.anyStylist")}
                  bio={t("booking.anyStylistBio")}
                  specialties={[t("booking.fastestOpening"), selectedServiceText?.name ?? selectedService.name]}
                  onClick={() => {
                    setStylistId("any");
                    setSlot(null);
                  }}
                />
                {stylistsLoading && <p>{t("booking.loadingStylists")}</p>}
                {stylists.map((stylist) => {
                  const stylistText = getLocalizedStylistText(stylist, language);

                  return (
                    <StylistChoice
                      key={stylist.id}
                      selected={stylistId === stylist.id}
                      name={stylist.name}
                      bio={stylistText.bio}
                      specialties={stylistText.specialties}
                      onClick={() => {
                        setStylistId(stylist.id);
                        setSlot(null);
                      }}
                    />
                  );
                })}
              </div>
              <FooterNav canContinue={Boolean(stylistId)} onBack={() => setStep("service")} onNext={() => setStep("time")} />
            </div>
          )}

          {step === "time" && selectedService && (
            <TimeSelector
              date={date}
              dates={dates}
              onDateChange={(nextDate) => {
                setDate(nextDate);
                setSlot(null);
              }}
              selectedService={selectedService}
              selectedStylist={selectedStylist}
              slots={slots}
              selectedSlot={slot}
              slotsLoading={slotsLoading}
              onSelectSlot={setSlot}
              onBack={() => setStep("stylist")}
              onNext={() => setStep("details")}
            />
          )}

          {step === "details" && selectedService && slot && (
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <h2 className="text-xl font-bold">{t("booking.yourDetails")}</h2>
              <div className="ui-subtle-note mt-4 text-sm">
                <p className="font-semibold">
                  {t("booking.summary", {
                    service: selectedServiceText?.name ?? selectedService.name,
                    stylist: slot.stylistName
                  })}
                </p>
                <p className="mt-1 text-wave-ink/65">
                  {t("booking.summaryDate", {
                    date: formatSlotDate(slot.startsAt, locale),
                    time: formatSlotTime(slot.startsAt, locale)
                  })}
                </p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label={t("booking.name")} error={form.formState.errors.customerName?.message}>
                  <input className="ui-field" {...form.register("customerName")} />
                </Field>
                <Field label={t("booking.email")} error={form.formState.errors.customerEmail?.message}>
                  <input className="ui-field" {...form.register("customerEmail")} />
                </Field>
                <Field label={t("booking.phone")} error={form.formState.errors.customerPhone?.message}>
                  <input className="ui-field" {...form.register("customerPhone")} />
                </Field>
                <Field label={t("booking.notes")}>
                  <textarea className="ui-field min-h-24" placeholder={t("booking.notesPlaceholder")} {...form.register("notes")} />
                </Field>
              </div>
              {mutation.error && <p className="mt-4 rounded-xl bg-wave-deep/10 p-3 text-sm text-wave-deep">{mutation.error.message}</p>}
              <FooterNav canContinue={!mutation.isPending} onBack={() => setStep("time")} submit label={mutation.isPending ? t("booking.booking") : t("booking.confirm")} />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function StylistChoice({
  selected,
  name,
  bio,
  specialties,
  onClick
}: {
  selected: boolean;
  name: string;
  bio: string;
  specialties: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-2xl border p-4 text-left transition ${selected ? "border-wave-deep bg-wave-mint/70" : "border-wave-deep/10 bg-white hover:bg-wave-mint/35"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-wave-deep">
            <UserRound size={20} />
          </span>
          <h3 className="font-bold">{name}</h3>
        </div>
        {selected && <CheckCircle2 className="shrink-0 text-wave-deep" size={20} />}
      </div>
      <p className="mt-3 text-sm leading-6 text-wave-ink/65">{bio}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {specialties.map((specialty) => (
          <span key={specialty} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-wave-deep">
            {specialty}
          </span>
        ))}
      </div>
    </button>
  );
}

function TimeSelector({
  date,
  dates,
  onDateChange,
  selectedService,
  selectedStylist,
  slots,
  selectedSlot,
  slotsLoading,
  onSelectSlot,
  onBack,
  onNext
}: {
  date: string;
  dates: string[];
  onDateChange: (date: string) => void;
  selectedService: Service;
  selectedStylist: Stylist | null;
  slots: AvailableSlot[];
  selectedSlot: AvailableSlot | null;
  slotsLoading: boolean;
  onSelectSlot: (slot: AvailableSlot) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const groupedSlots = groupSlotsByDayPart(slots);
  const selectedServiceText = getLocalizedServiceText(selectedService, language);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t("booking.pickTime")}</h2>
          <p className="mt-2 text-sm text-wave-ink/65">
            {selectedStylist
              ? t("booking.showingWithStylist", { name: selectedStylist.name })
              : t("booking.showingEligible")}
          </p>
        </div>
        <div className="ui-subtle-note text-sm">
          <p className="font-semibold">{selectedServiceText.name}</p>
          <p className="text-wave-ink/65">{selectedService.durationMinutes} {t("common.minutes")}</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {dates.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onDateChange(day)}
            className={`focus-ring min-w-[118px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${date === day ? "border-wave-deep bg-wave-deep text-white" : "border-wave-deep/10 bg-white"}`}
          >
            <span className="block">{formatDayName(day, locale)}</span>
            <span className={date === day ? "text-white/75" : "text-wave-ink/55"}>{formatShortDate(day, locale)}</span>
          </button>
        ))}
      </div>

      <div className="ui-section-divider mt-6">
        <div className="max-h-[44dvh] overflow-y-auto pr-1 [scrollbar-gutter:stable] sm:max-h-none sm:overflow-visible sm:pr-0">
          {slotsLoading && <p>{t("booking.checkingCalendars")}</p>}
          {!slotsLoading && slots.length === 0 && <p>{t("booking.noTimes")}</p>}
          {!slotsLoading && slots.length > 0 && (
            <div className="grid gap-5">
              {Object.entries(groupedSlots).map(([label, dayPartSlots]) => (
                <section key={label}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-wave-deep">
                    <Clock3 size={16} />
                    {t(dayPartLabelKey(label))}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {dayPartSlots.map((availableSlot) => (
                      <button
                        key={`${availableSlot.stylistId}-${availableSlot.startsAt}`}
                        type="button"
                        onClick={() => onSelectSlot(availableSlot)}
                        className={`focus-ring rounded-2xl border bg-white p-4 text-left transition ${selectedSlot?.startsAt === availableSlot.startsAt && selectedSlot?.stylistId === availableSlot.stylistId ? "border-wave-deep ring-2 ring-wave-deep/20" : "border-wave-deep/10 hover:bg-wave-mint/35"}`}
                      >
                        <span className="text-lg font-black">{formatSlotTime(availableSlot.startsAt, locale)}</span>
                        <span className="mt-1 block text-sm text-wave-ink/65">{availableSlot.stylistName}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="ui-subtle-note mt-5 text-sm">
          <p className="font-bold">{t("booking.selectedAppointment")}</p>
          <p className="mt-1 text-wave-ink/70">
            {t("booking.selectedAppointmentCopy", {
              date: formatSlotDate(selectedSlot.startsAt, locale),
              time: formatSlotTime(selectedSlot.startsAt, locale),
              stylist: selectedSlot.stylistName
            })}
          </p>
        </div>
      )}

      <FooterNav canContinue={Boolean(selectedSlot)} onBack={onBack} onNext={onNext} />
    </div>
  );
}

function groupSlotsByDayPart(slots: AvailableSlot[]): Record<string, AvailableSlot[]> {
  return slots.reduce<Record<string, AvailableSlot[]>>((groups, slot) => {
    const hour = hourInTimeZone(slot.startsAt, DEFAULT_SALON_TIME_ZONE);
    const key = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    groups[key] = groups[key] ?? [];
    groups[key].push(slot);
    return groups;
  }, {});
}

function dayPartLabelKey(label: string): "booking.morning" | "booking.afternoon" | "booking.evening" {
  if (label === "Morning") return "booking.morning";
  if (label === "Afternoon") return "booking.afternoon";
  return "booking.evening";
}

function formatDayName(date: string, locale: string): string {
  return formatDateKeyInTimeZone(date, DEFAULT_SALON_TIME_ZONE, { weekday: "short" }, locale);
}

function formatShortDate(date: string, locale: string): string {
  return formatDateKeyInTimeZone(date, DEFAULT_SALON_TIME_ZONE, { month: "short", day: "numeric" }, locale);
}

function formatSlotDate(date: string, locale: string): string {
  return formatDateInTimeZone(date, DEFAULT_SALON_TIME_ZONE, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }, locale);
}

function formatSlotTime(date: string, locale: string): string {
  return formatTimeInTimeZone(date, DEFAULT_SALON_TIME_ZONE, locale);
}

function FooterNav({
  canContinue,
  onBack,
  onNext,
  submit = false,
  label
}: {
  canContinue: boolean;
  onBack?: () => void;
  onNext?: () => void;
  submit?: boolean;
  label?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-wave-deep/10 bg-white/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_30px_rgb(43_23_20_/_0.12)] backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 ${onBack ? "justify-between" : "justify-end"} sm:mx-0 sm:max-w-none`}>
        {onBack ? (
          <button type="button" onClick={onBack} className="focus-ring inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-wave-deep/10 bg-white px-4 font-semibold text-wave-ink/70 shadow-sm hover:bg-wave-mint sm:h-auto sm:border-0 sm:bg-transparent sm:py-2 sm:shadow-none">
            <ArrowLeft size={18} />
            {t("common.back")}
          </button>
        ) : null}
        <button
          type={submit ? "submit" : "button"}
          onClick={submit ? undefined : onNext}
          disabled={!canContinue}
          className={`focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full bg-wave-deep px-5 font-semibold text-white shadow-sm transition hover:bg-wave-ink disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:py-3 ${onBack ? "min-w-0 flex-1 sm:flex-none" : "w-full sm:w-auto"}`}
        >
          {label ?? t("common.continue")}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-wave-deep">{error}</span>}
    </label>
  );
}
