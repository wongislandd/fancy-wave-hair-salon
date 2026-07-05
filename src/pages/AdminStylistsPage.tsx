import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Save, Scissors, Trash2, UserRound, UsersRound } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { stylistFormSchema, type StylistFormValues } from "../lib/admin";
import { formatPriceRange } from "../lib/booking";
import {
  deleteStylist,
  listAdminServices,
  listAdminStylists,
  listStylistHours,
  saveStylist,
  updateStylistHour
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedServiceText, getLocalizedStylistText, localeForLanguage } from "../lib/localization";
import type { StylistHour } from "../lib/types";

type StylistFormState = {
  name: string;
  bioEn: string;
  bioZh: string;
  specialtiesEn: string;
  specialtiesZh: string;
  serviceIds: string[];
  isActive: boolean;
};

type StylistHourPatch = Pick<
  StylistHour,
  "opensAt" | "closesAt" | "isClosed" | "usesSalonHours"
>;

const blankStylistForm: StylistFormState = {
  name: "",
  bioEn: "",
  bioZh: "",
  specialtiesEn: "",
  specialtiesZh: "",
  serviceIds: [],
  isActive: true
};

export function AdminStylistsPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<StylistFormState>(blankStylistForm);
  const [formError, setFormError] = useState("");

  const stylistsQuery = useQuery({
    queryKey: ["admin-stylists"],
    queryFn: listAdminStylists
  });

  const servicesQuery = useQuery({
    queryKey: ["admin-services"],
    queryFn: listAdminServices
  });

  const hoursQuery = useQuery({
    queryKey: ["stylist-hours", selectedId],
    queryFn: () => listStylistHours(selectedId),
    enabled: Boolean(selectedId)
  });

  const stylists = useMemo(() => stylistsQuery.data ?? [], [stylistsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const selectedStylist = stylists.find((stylist) => stylist.id === selectedId);
  const activeStylists = stylists.filter((stylist) => stylist.isActive).length;

  useEffect(() => {
    if (!selectedStylist) {
      setForm(blankStylistForm);
      return;
    }

    setForm({
      name: selectedStylist.name,
      bioEn: selectedStylist.bioEn ?? selectedStylist.bio,
      bioZh: selectedStylist.bioZh ?? "",
      specialtiesEn: (selectedStylist.specialtiesEn ?? selectedStylist.specialties).join(", "),
      specialtiesZh: (selectedStylist.specialtiesZh ?? []).join(", "),
      serviceIds: selectedStylist.serviceIds,
      isActive: selectedStylist.isActive
    });
  }, [selectedStylist]);

  const saveMutation = useMutation({
    mutationFn: ({ values, id }: { values: StylistFormValues; id?: string }) =>
      saveStylist(values, id),
    onSuccess: async (savedStylist) => {
      setSelectedId(savedStylist.id);
      setFormError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-stylists"] }),
        queryClient.invalidateQueries({ queryKey: ["public-stylists"] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] })
      ]);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (stylistId: string) => deleteStylist(stylistId),
    onSuccess: async () => {
      setSelectedId("");
      setForm(blankStylistForm);
      setFormError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-stylists"] }),
        queryClient.invalidateQueries({ queryKey: ["public-stylists"] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] }),
        queryClient.invalidateQueries({ queryKey: ["stylist-hours"] })
      ]);
    }
  });

  const hoursMutation = useMutation({
    mutationFn: ({ hour, patch }: { hour: StylistHour; patch: StylistHourPatch }) =>
      updateStylistHour(hour, patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stylist-hours", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] })
      ]);
    }
  });

  const handleSave = () => {
    const parsed = stylistFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the stylist fields.");
      return;
    }

    saveMutation.mutate({ values: parsed.data, id: selectedId || undefined });
  };

  const handleDelete = () => {
    if (!selectedStylist) return;

    const confirmed = window.confirm(
      t("admin.stylists.deleteConfirm", { name: selectedStylist.name })
    );
    if (!confirmed) return;

    setFormError("");
    deleteMutation.mutate(selectedStylist.id);
  };

  const toggleService = (serviceId: string) => {
    const serviceIds = form.serviceIds.includes(serviceId)
      ? form.serviceIds.filter((id) => id !== serviceId)
      : [...form.serviceIds, serviceId];
    setForm({ ...form, serviceIds });
  };

  const updateHour = (hour: StylistHour, patch: Partial<StylistHourPatch>) => {
    hoursMutation.mutate({
      hour,
      patch: {
        opensAt: patch.opensAt ?? hour.opensAt,
        closesAt: patch.closesAt ?? hour.closesAt,
        isClosed: patch.isClosed ?? hour.isClosed,
        usesSalonHours: patch.usesSalonHours ?? hour.usesSalonHours
      }
    });
  };

  return (
    <AdminShell title={t("admin.stylists.title")}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.stylists.registered")} value={String(stylists.length)} icon={<UsersRound size={18} />} />
        <Metric label={t("admin.stylists.active")} value={String(activeStylists)} icon={<UserRound size={18} />} />
        <Metric label={t("admin.stylists.services")} value={String(services.length)} icon={<Scissors size={18} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-wave-deep/10 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{t("admin.stylists.listTitle")}</h2>
              <p className="mt-1 text-sm text-wave-ink/60">{t("admin.stylists.manageProfiles")}</p>
            </div>
            <button
              type="button"
              className="focus-ring rounded-full bg-wave-mint p-2 text-wave-deep"
              onClick={() => {
                setSelectedId("");
                setForm(blankStylistForm);
                setFormError("");
              }}
              aria-label={t("admin.stylists.newStylist")}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {stylistsQuery.isLoading && <p>{t("admin.stylists.loading")}</p>}
            {stylists.map((stylist) => {
              const stylistText = getLocalizedStylistText(stylist, language);
              const specialties = stylistText.specialties.join(", ");

              return (
                <button
                  key={stylist.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(stylist.id);
                    setFormError("");
                  }}
                  className={`focus-ring block w-full rounded-2xl border p-4 text-left transition ${
                    selectedId === stylist.id
                      ? "border-wave-deep bg-wave-mint"
                      : "border-wave-deep/10 hover:border-wave-deep/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{stylist.name}</p>
                      <p className="mt-1 text-sm text-wave-ink/60">
                        {t("admin.stylists.serviceCount", { count: stylist.serviceIds.length })}
                        {specialties ? ` / ${specialties}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        stylist.isActive
                          ? "bg-wave-mint text-wave-deep"
                          : "bg-wave-mint text-wave-ink/65"
                      }`}
                    >
                      {stylist.isActive ? t("common.active") : t("common.hidden")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wave-mint text-wave-deep">
              <UserRound size={21} />
            </span>
            <div>
              <h2 className="text-xl font-black">
                {selectedStylist ? t("admin.stylists.edit") : t("admin.stylists.new")}
              </h2>
              <p className="mt-1 text-sm text-wave-ink/60">
                {selectedStylist
                  ? t("admin.stylists.editCopy")
                  : t("admin.stylists.newCopy")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <Field label={t("admin.stylists.name")}>
              <input
                className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nina Park"
              />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.stylists.english")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.stylists.bioEn")}>
                    <textarea
                      className="focus-ring min-h-28 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.bioEn}
                      onChange={(event) => setForm({ ...form, bioEn: event.target.value })}
                      placeholder="Precision cuts, soft layers, and lived-in styling."
                    />
                  </Field>
                  <Field label={t("admin.stylists.specialtiesEn")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.specialtiesEn}
                      onChange={(event) => setForm({ ...form, specialtiesEn: event.target.value })}
                      placeholder="Cuts, Layers, Blowouts"
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.stylists.chinese")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.stylists.bioZh")}>
                    <textarea
                      className="focus-ring min-h-28 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.bioZh}
                      onChange={(event) => setForm({ ...form, bioZh: event.target.value })}
                      placeholder={"\u7cbe\u51c6\u526a\u53d1\u3001\u67d4\u548c\u5c42\u6b21\u548c\u81ea\u7136\u9020\u578b"}
                    />
                  </Field>
                  <Field label={t("admin.stylists.specialtiesZh")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.specialtiesZh}
                      onChange={(event) => setForm({ ...form, specialtiesZh: event.target.value })}
                      placeholder={"\u526a\u53d1, \u5c42\u6b21, \u5439\u98ce\u9020\u578b"}
                    />
                  </Field>
                </div>
              </section>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{t("admin.stylists.servicesOffered")}</span>
                <span className="text-sm text-wave-ink/55">{t("admin.stylists.selected", { count: form.serviceIds.length })}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {servicesQuery.isLoading && <p>{t("admin.services.loading")}</p>}
                {services.map((service) => {
                  const serviceText = getLocalizedServiceText(service, language);

                  return (
                    <label
                      key={service.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                        form.serviceIds.includes(service.id)
                          ? "border-wave-deep bg-wave-mint"
                          : "border-wave-deep/10 hover:border-wave-deep/35"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.serviceIds.includes(service.id)}
                        onChange={() => toggleService(service.id)}
                        className="mt-1 h-5 w-5"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{serviceText.name}</span>
                        <span className="block text-sm text-wave-ink/60">
                          {service.durationMinutes} {t("common.min")} / {formatPriceRange(service, locale)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-wave-deep/10 px-4 py-3">
              <span>
                <span className="block font-semibold">{t("admin.stylists.activePublicly")}</span>
                <span className="text-sm text-wave-ink/60">{t("admin.stylists.visibleBooking")}</span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                className="h-5 w-5"
              />
            </label>
          </div>

          {formError && <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">{formError}</p>}
          {saveMutation.error && (
            <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
              {saveMutation.error.message}
            </p>
          )}
          {deleteMutation.error && (
            <p className="mt-4 rounded-2xl bg-wave-deep/10 p-3 text-sm text-wave-deep">
              {deleteMutation.error.message}
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
              {saveMutation.isPending ? t("common.saving") : t("admin.stylists.save")}
            </button>
            {selectedStylist && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || saveMutation.isPending}
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-45"
              >
                <Trash2 size={18} />
                {deleteMutation.isPending ? t("admin.stylists.deleting") : t("admin.stylists.delete")}
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{t("admin.stylists.hoursTitle")}</h2>
            <p className="mt-1 text-sm text-wave-ink/60">
              {selectedStylist
                ? t("admin.stylists.hoursFor", { name: selectedStylist.name })
                : t("admin.stylists.hoursEmpty")}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-wave-mint text-wave-deep">
            <Clock size={19} />
          </span>
        </div>

        {!selectedId && (
          <p className="mt-5 rounded-2xl bg-wave-mint/60 p-4 text-sm text-wave-ink/70">
            {t("admin.stylists.chooseFirst")}
          </p>
        )}

        {selectedId && (
          <div className="mt-5 grid gap-3">
            {hoursQuery.isLoading && <p>{t("admin.stylists.loadingHours")}</p>}
            {(hoursQuery.data ?? []).map((hour) => (
              <article
                key={hour.dayOfWeek}
                className={`grid gap-3 rounded-2xl border p-4 lg:grid-cols-[150px_210px_minmax(0,1fr)_150px] lg:items-start ${
                  hour.isClosed ? "border-wave-deep/10 bg-wave-mint/55" : "border-wave-deep/15 bg-white"
                }`}
              >
                <div className="lg:pt-7">
                  <h3 className="font-black">{t(dayNameKey(hour.dayOfWeek))}</h3>
                  <p className="mt-1 text-sm text-wave-ink/60">
                    {hour.usesSalonHours ? t("admin.stylists.usingSalonHours") : t("admin.stylists.customHours")}
                  </p>
                </div>

                <label className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-wave-deep/10 px-4 py-3 font-semibold lg:mt-7">
                  <span className="whitespace-nowrap">{t("admin.stylists.useSalonHours")}</span>
                  <input
                    type="checkbox"
                    checked={hour.usesSalonHours}
                    onChange={(event) => updateHour(hour, { usesSalonHours: event.target.checked })}
                    className="h-5 w-5 shrink-0"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.open")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3 disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                      type="time"
                      value={hour.opensAt}
                      disabled={hour.usesSalonHours || hour.isClosed}
                      onChange={(event) => updateHour(hour, { opensAt: event.target.value })}
                    />
                  </Field>
                  <Field label={t("common.close")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3 disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                      type="time"
                      value={hour.closesAt}
                      disabled={hour.usesSalonHours || hour.isClosed}
                      onChange={(event) => updateHour(hour, { closesAt: event.target.value })}
                    />
                  </Field>
                </div>

                <label
                  className={`flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-wave-deep/10 px-4 py-3 font-semibold lg:mt-7 ${
                    hour.usesSalonHours ? "opacity-55" : ""
                  }`}
                >
                  <span>{t("common.closed")}</span>
                  <input
                    type="checkbox"
                    checked={hour.isClosed}
                    disabled={hour.usesSalonHours}
                    onChange={(event) => updateHour(hour, { isClosed: event.target.checked })}
                    className="h-5 w-5 shrink-0"
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-wave-deep/10 bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-wave-mint text-wave-deep">
        {icon}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function dayNameKey(dayOfWeek: number):
  | "days.0"
  | "days.1"
  | "days.2"
  | "days.3"
  | "days.4"
  | "days.5"
  | "days.6" {
  return `days.${dayOfWeek}` as
    | "days.0"
    | "days.1"
    | "days.2"
    | "days.3"
    | "days.4"
    | "days.5"
    | "days.6";
}
