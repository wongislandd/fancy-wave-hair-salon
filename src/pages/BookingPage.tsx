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
import { getLocalizedServiceText, localeForLanguage } from "../lib/localization";
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
      navigate(`/booking-confirmed/${confirmation.managementToken}`);
    }
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{t("booking.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">{t("booking.title")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-wave-deep/10 bg-white p-5 shadow-sm">
          {steps.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === item.id ? "bg-wave-deep text-white" : "bg-wave-mint text-wave-deep"}`}>
                {index + 1}
              </span>
              <span>{t(item.labelKey)}</span>
            </div>
          ))}
        </aside>

        <div className="min-w-0 rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-7">
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
                      className={`focus-ring rounded-2xl border p-4 text-left transition ${serviceId === service.id ? "border-wave-deep bg-wave-mint" : "border-wave-deep/10 hover:border-wave-deep/40"}`}
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
                {stylists.map((stylist) => (
                  <StylistChoice
                    key={stylist.id}
                    selected={stylistId === stylist.id}
                    name={stylist.name}
                    bio={stylist.bio}
                    specialties={stylist.specialties}
                    onClick={() => {
                      setStylistId(stylist.id);
                      setSlot(null);
                    }}
                  />
                ))}
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
              <div className="mt-4 rounded-2xl border border-wave-deep/10 bg-wave-mint/50 p-4 text-sm">
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
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerName")} />
                </Field>
                <Field label={t("booking.email")} error={form.formState.errors.customerEmail?.message}>
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerEmail")} />
                </Field>
                <Field label={t("booking.phone")} error={form.formState.errors.customerPhone?.message}>
                  <input className="focus-ring w-full rounded-xl border border-wave-deep/15 px-3 py-3" {...form.register("customerPhone")} />
                </Field>
                <Field label={t("booking.notes")}>
                  <textarea className="focus-ring min-h-24 w-full rounded-xl border border-wave-deep/15 px-3 py-3" placeholder={t("booking.notesPlaceholder")} {...form.register("notes")} />
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
      className={`focus-ring rounded-2xl border p-4 text-left transition ${selected ? "border-wave-deep bg-wave-mint" : "border-wave-deep/10 hover:border-wave-deep/40"}`}
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
        <div className="rounded-2xl bg-wave-mint/70 px-4 py-3 text-sm">
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

      <div className="mt-6 rounded-3xl border border-wave-deep/10 bg-wave-cream/60 p-4">
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
                      className={`focus-ring rounded-2xl border bg-white p-4 text-left transition ${selectedSlot?.startsAt === availableSlot.startsAt && selectedSlot?.stylistId === availableSlot.stylistId ? "border-wave-deep ring-2 ring-wave-deep/20" : "border-wave-deep/10 hover:border-wave-deep/40"}`}
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

      {selectedSlot && (
        <div className="mt-5 rounded-2xl border border-wave-deep/10 bg-white p-4 text-sm shadow-sm">
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
    <div className="mt-8 flex justify-between gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-wave-ink/70 hover:bg-wave-mint">
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
      ) : <span />}
      <button
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : onNext}
        disabled={!canContinue}
        className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white transition hover:bg-wave-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label ?? t("common.continue")}
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
      {error && <span className="mt-1 block text-sm text-wave-deep">{error}</span>}
    </label>
  );
}
