import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Info, Plus, Save, Trash2 } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { serviceFormSchema, type ServiceFormValues } from "../lib/admin";
import { formatPriceRange } from "../lib/booking";
import {
  deleteService,
  listAdminServices,
  listAdminStylists,
  saveService,
  updateServiceOrder
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedServiceText, localeForLanguage } from "../lib/localization";

type ServiceFormState = {
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  durationMinutes: number;
  calendarBlockMinutes: number;
  priceDollars: string;
  priceMaxDollars: string;
  priceIsStartingAt: boolean;
  isActive: boolean;
};

const blankServiceForm: ServiceFormState = {
  nameEn: "",
  nameZh: "",
  descriptionEn: "",
  descriptionZh: "",
  durationMinutes: 60,
  calendarBlockMinutes: 60,
  priceDollars: "65",
  priceMaxDollars: "",
  priceIsStartingAt: false,
  isActive: true
};

const inputClass = "ui-field";
const textareaClass = `${inputClass} min-h-28`;
const affixedInputClass = "ui-affixed-input";

export function AdminServicesPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<ServiceFormState>(blankServiceForm);
  const [formError, setFormError] = useState("");

  const servicesQuery = useQuery({
    queryKey: ["admin-services"],
    queryFn: listAdminServices
  });

  const stylistsQuery = useQuery({
    queryKey: ["admin-stylists"],
    queryFn: listAdminStylists
  });

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const stylists = useMemo(() => stylistsQuery.data ?? [], [stylistsQuery.data]);
  const selectedService = services.find((service) => service.id === selectedId);

  useEffect(() => {
    if (!selectedService) {
      setForm(blankServiceForm);
      return;
    }

    setForm({
      nameEn: selectedService.nameEn ?? selectedService.name,
      nameZh: selectedService.nameZh ?? "",
      descriptionEn: selectedService.descriptionEn ?? selectedService.description,
      descriptionZh: selectedService.descriptionZh ?? "",
      durationMinutes: selectedService.durationMinutes,
      calendarBlockMinutes: selectedService.calendarBlockMinutes ?? selectedService.durationMinutes,
      priceDollars: String(selectedService.priceCents / 100),
      priceMaxDollars: selectedService.priceMaxCents
        ? String(selectedService.priceMaxCents / 100)
        : "",
      priceIsStartingAt: Boolean(selectedService.priceIsStartingAt),
      isActive: selectedService.isActive
    });
  }, [selectedService]);

  const stylistsByService = useMemo(
    () =>
      new Map(
        services.map((service) => [
          service.id,
          stylists.filter((stylist) => stylist.serviceIds.includes(service.id))
        ])
      ),
    [services, stylists]
  );

  const refreshServiceData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
      queryClient.invalidateQueries({ queryKey: ["public-services"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-stylists"] }),
      queryClient.invalidateQueries({ queryKey: ["public-stylists"] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: ({ values, id }: { values: ServiceFormValues; id?: string }) => saveService(values, id),
    onSuccess: async () => {
      await refreshServiceData();
      setFormError("");
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) => deleteService(serviceId),
    onSuccess: async () => {
      setSelectedId("");
      setForm(blankServiceForm);
      setFormError("");
      await refreshServiceData();
    }
  });
  const reorderMutation = useMutation({
    mutationFn: updateServiceOrder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
        queryClient.invalidateQueries({ queryKey: ["public-services"] })
      ]);
    }
  });
  const saveError = saveMutation.error
    ? saveMutation.error instanceof Error
      ? saveMutation.error.message
      : "Service could not be saved."
    : "";
  const reorderError = reorderMutation.error
    ? reorderMutation.error instanceof Error
      ? reorderMutation.error.message
      : "Service order could not be saved."
    : "";
  const deleteError = deleteMutation.error
    ? deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : "Service could not be deleted."
    : "";

  const handleSave = () => {
    const parsed = serviceFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the service fields.");
      return;
    }

    setFormError("");
    saveMutation.mutate({ values: parsed.data, id: selectedId || undefined });
  };

  const handleDelete = () => {
    if (!selectedService) return;

    const serviceName = getLocalizedServiceText(selectedService, language).name;
    const confirmed = window.confirm(
      t("admin.services.deleteConfirm", { name: serviceName })
    );
    if (!confirmed) return;

    setFormError("");
    deleteMutation.mutate(selectedService.id);
  };

  const moveService = (serviceId: string, direction: -1 | 1) => {
    const currentIndex = services.findIndex((service) => service.id === serviceId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= services.length) return;

    const nextIds = services.map((service) => service.id);
    const [movedId] = nextIds.splice(currentIndex, 1);
    nextIds.splice(nextIndex, 0, movedId);
    reorderMutation.mutate(nextIds);
  };

  return (
    <AdminShell title={t("admin.services.title")}>
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="ui-surface-compact">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">{t("admin.services.listTitle")}</h2>
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setSelectedId("");
                setForm(blankServiceForm);
                setFormError("");
              }}
              aria-label={t("admin.services.newService")}
            >
              <Plus size={17} />
              <span>{t("admin.services.newService")}</span>
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-wave-deep/10">
            {servicesQuery.isLoading && <p className="p-4">{t("admin.services.loading")}</p>}
            {services.map((service, index) => {
              const serviceText = getLocalizedServiceText(service, language);

              return (
                <article
                  key={service.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] border-t border-wave-deep/10 transition first:border-t-0 ${
                    selectedId === service.id
                      ? "bg-wave-mint/60"
                      : "bg-white hover:bg-wave-mint/35"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(service.id);
                      setFormError("");
                    }}
                    className={`focus-ring min-w-0 border-l-4 px-3 py-4 text-left ${
                      selectedId === service.id ? "border-wave-deep" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{serviceText.name}</p>
                        <p className="mt-1 text-sm text-wave-ink/60">
                          {service.durationMinutes} {t("common.min")} / {formatPriceRange(service, locale)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-wave-ink/65">
                        <span
                          className={`ui-status-dot ${
                            service.isActive ? "bg-emerald-500" : "bg-wave-ink/35"
                          }`}
                          aria-hidden="true"
                        />
                        {service.isActive ? t("common.active") : t("common.hidden")}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-col items-center justify-center gap-1 px-2 py-3">
                    <button
                      type="button"
                      aria-label={t("admin.services.moveUp")}
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => moveService(service.id, -1)}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-wave-ink/60 hover:bg-white disabled:opacity-35"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={t("admin.services.moveDown")}
                      disabled={index === services.length - 1 || reorderMutation.isPending}
                      onClick={() => moveService(service.id, 1)}
                      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-wave-ink/60 hover:bg-white disabled:opacity-35"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
            {reorderError && (
              <p className="rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
                {reorderError}
              </p>
            )}
          </div>
        </section>

        <section className="ui-surface">
          <div className="border-b border-wave-deep/10 pb-5">
            <div>
              <h2 className="text-xl font-black">{selectedService ? t("admin.services.edit") : t("admin.services.new")}</h2>
              <p className="mt-1 text-sm text-wave-ink/60">
                {selectedService
                  ? getLocalizedServiceText(selectedService, language).name
                  : t("admin.services.createCopy")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:divide-x lg:divide-wave-deep/10">
              <section>
                <h3 className="text-sm font-black text-wave-ink/65">{t("admin.services.english")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.services.nameEn")}>
                    <input
                      className={inputClass}
                      value={form.nameEn}
                      onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
                      placeholder="Signature Haircut"
                    />
                  </Field>
                  <Field label={t("admin.services.descriptionEn")}>
                    <textarea
                      className={textareaClass}
                      value={form.descriptionEn}
                      onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })}
                      placeholder="Wash, consultation, precision cut, and finish"
                    />
                  </Field>
                </div>
              </section>

              <section className="lg:pl-6">
                <h3 className="text-sm font-black text-wave-ink/65">{t("admin.services.chinese")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.services.nameZh")}>
                    <input
                      className={inputClass}
                      value={form.nameZh}
                      onChange={(event) => setForm({ ...form, nameZh: event.target.value })}
                      placeholder="招牌剪发"
                    />
                  </Field>
                  <Field label={t("admin.services.descriptionZh")}>
                    <textarea
                      className={textareaClass}
                      value={form.descriptionZh}
                      onChange={(event) => setForm({ ...form, descriptionZh: event.target.value })}
                      placeholder="洗发、咨询、精剪和造型"
                    />
                  </Field>
                </div>
              </section>
            </div>
            <section className="ui-section-divider">
              <h3 className="text-sm font-black text-wave-ink/65">{t("admin.services.scheduling")}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label={t("admin.services.customerDuration")}
                  info={t("admin.services.customerDurationInfo")}
                >
                  <div className="ui-affixed-field">
                    <input
                      className={affixedInputClass}
                      type="number"
                      min={15}
                      step={15}
                      value={form.durationMinutes}
                      aria-label={t("admin.services.customerDuration")}
                      onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
                    />
                    <span className="ui-affix border-l border-wave-deep/10">{t("common.min")}</span>
                  </div>
                </Field>
                <Field
                  label={t("admin.services.calendarBlock")}
                  info={t("admin.services.calendarBlockInfo")}
                >
                  <div className="ui-affixed-field">
                    <input
                      className={affixedInputClass}
                      type="number"
                      min={15}
                      step={15}
                      value={form.calendarBlockMinutes}
                      aria-label={t("admin.services.calendarBlock")}
                      onChange={(event) => setForm({ ...form, calendarBlockMinutes: Number(event.target.value) })}
                    />
                    <span className="ui-affix border-l border-wave-deep/10">{t("common.min")}</span>
                  </div>
                </Field>
              </div>
            </section>
            <section className="ui-section-divider">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{t("admin.services.price")}</span>
                  <div className="ui-segmented">
                    <button
                      type="button"
                      aria-pressed={!form.priceIsStartingAt}
                      onClick={() => setForm({ ...form, priceIsStartingAt: false })}
                      className={priceModeButtonClass(!form.priceIsStartingAt)}
                    >
                      {t("admin.services.priceRange")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.priceIsStartingAt}
                      onClick={() => setForm({ ...form, priceIsStartingAt: true, priceMaxDollars: "" })}
                      className={priceModeButtonClass(form.priceIsStartingAt)}
                    >
                      <Plus size={14} />
                      {t("admin.services.priceStartingAt")}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-wave-ink/60">{t("admin.services.priceBase")}</span>
                    <div className="ui-affixed-field">
                      <span className="ui-affix border-r border-wave-deep/10">$</span>
                      <input
                        className={affixedInputClass}
                        type="number"
                        min={0}
                        step={1}
                        value={form.priceDollars}
                        onChange={(event) => setForm({ ...form, priceDollars: event.target.value })}
                        aria-label={t("admin.services.priceBase")}
                      />
                    </div>
                  </div>
                  <div className={form.priceIsStartingAt ? "opacity-55" : ""}>
                    <span className="mb-2 block text-xs font-semibold text-wave-ink/60">{t("admin.services.priceMax")}</span>
                    <div className="ui-affixed-field">
                      <span className="ui-affix border-r border-wave-deep/10">$</span>
                      <input
                        className={`${affixedInputClass} disabled:bg-wave-mint/50 disabled:text-wave-ink/45`}
                        type="number"
                        min={0}
                        step={1}
                        value={form.priceMaxDollars}
                        disabled={form.priceIsStartingAt}
                        onChange={(event) => setForm({ ...form, priceMaxDollars: event.target.value })}
                        aria-label={t("admin.services.priceMax")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <label className="ui-section-divider flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block font-semibold">{t("admin.services.activePublicly")}</span>
                <span className="text-sm text-wave-ink/60">{t("admin.services.visibleBooking")}</span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="peer sr-only"
              />
              <span className="ui-switch" />
            </label>
          </div>

          {(formError || saveError || deleteError) && (
            <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
              {formError || saveError || deleteError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || deleteMutation.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white disabled:opacity-45"
            >
              <Save size={18} />
              {saveMutation.isPending ? t("common.saving") : t("admin.services.save")}
            </button>
            {selectedService && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || saveMutation.isPending}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-45"
              >
                <Trash2 size={18} />
                {deleteMutation.isPending ? t("admin.services.deleting") : t("admin.services.delete")}
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="ui-surface mt-6">
        <h2 className="text-xl font-black">{t("admin.services.coverage")}</h2>
        <div className="ui-divided-list mt-4">
          {services.map((service) => {
            const serviceText = getLocalizedServiceText(service, language);

            return (
              <article key={service.id} className="ui-divided-row grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <h3 className="font-bold">{serviceText.name}</h3>
                    <p className="mt-1 text-sm text-wave-ink/60">
                      {service.durationMinutes} {t("common.min")} / {formatPriceRange(service, locale)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                  {(stylistsByService.get(service.id) ?? []).map((stylist) => (
                    <span key={stylist.id} className="rounded-full bg-wave-mint px-3 py-1 text-sm font-semibold text-wave-deep">
                      {stylist.name}
                    </span>
                  ))}
                  {(stylistsByService.get(service.id) ?? []).length === 0 && (
                    <span className="text-sm text-wave-ink/60">{t("admin.services.noAssignments")}</span>
                  )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-wave-deep md:pt-1">
                  {t("admin.services.stylistCount", { count: stylistsByService.get(service.id)?.length ?? 0 })}
                </span>
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}

function Field({
  label,
  info,
  children
}: {
  label: string;
  info?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <span>{label}</span>
        {info && <InfoTooltip text={info} />}
      </span>
      {children}
    </label>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex" title={text} aria-hidden="true">
      <Info size={15} className="text-wave-ink/45" />
      <span
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl bg-wave-deep px-3 py-2 text-xs font-semibold leading-5 text-white opacity-0 shadow-xl transition before:content-[attr(data-tooltip)] group-hover:opacity-100"
        data-tooltip={text}
      />
    </span>
  );
}

function priceModeButtonClass(isActive: boolean) {
  return `focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1 transition ${
    isActive ? "bg-wave-deep text-white shadow-sm" : "text-wave-ink/65 hover:bg-white"
  }`;
}
