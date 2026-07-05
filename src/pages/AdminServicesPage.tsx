import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Scissors } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { serviceFormSchema, type ServiceFormValues } from "../lib/admin";
import { formatPrice } from "../lib/booking";
import { listAdminServices, listAdminStylists, saveService } from "../lib/data";
import { useLanguage } from "../lib/use-language";
import { getLocalizedServiceText, localeForLanguage } from "../lib/localization";

type ServiceFormState = {
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  durationMinutes: number;
  priceDollars: number;
  isActive: boolean;
};

const blankServiceForm: ServiceFormState = {
  nameEn: "",
  nameZh: "",
  descriptionEn: "",
  descriptionZh: "",
  durationMinutes: 60,
  priceDollars: 65,
  isActive: true
};

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
      priceDollars: selectedService.priceCents / 100,
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

  const saveMutation = useMutation({
    mutationFn: ({ values, id }: { values: ServiceFormValues; id?: string }) => saveService(values, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
        queryClient.invalidateQueries({ queryKey: ["public-services"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stylists"] }),
        queryClient.invalidateQueries({ queryKey: ["public-stylists"] })
      ]);
      setFormError("");
    }
  });

  const handleSave = () => {
    const parsed = serviceFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the service fields.");
      return;
    }

    saveMutation.mutate({ values: parsed.data, id: selectedId || undefined });
  };

  return (
    <AdminShell title={t("admin.services.title")}>
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-wave-deep/10 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">{t("admin.services.listTitle")}</h2>
            <button
              type="button"
              className="focus-ring rounded-full bg-wave-mint p-2 text-wave-deep"
              onClick={() => {
                setSelectedId("");
                setForm(blankServiceForm);
                setFormError("");
              }}
              aria-label={t("admin.services.newService")}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {servicesQuery.isLoading && <p>{t("admin.services.loading")}</p>}
            {services.map((service) => {
              const serviceText = getLocalizedServiceText(service, language);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(service.id);
                    setFormError("");
                  }}
                  className={`focus-ring block w-full rounded-2xl border p-4 text-left transition ${
                    selectedId === service.id
                      ? "border-wave-deep bg-wave-mint"
                      : "border-wave-deep/10 hover:border-wave-deep/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{serviceText.name}</p>
                      <p className="mt-1 text-sm text-wave-ink/60">
                        {service.durationMinutes} {t("common.min")} / {formatPrice(service.priceCents, locale)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      service.isActive ? "bg-wave-mint text-wave-deep" : "bg-wave-mint text-wave-ink/65"
                    }`}>
                      {service.isActive ? t("common.active") : t("common.hidden")}
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
              <Scissors size={21} />
            </span>
            <div>
              <h2 className="text-xl font-black">{selectedService ? t("admin.services.edit") : t("admin.services.new")}</h2>
              <p className="mt-1 text-sm text-wave-ink/60">
                {selectedService
                  ? getLocalizedServiceText(selectedService, language).name
                  : t("admin.services.createCopy")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.services.english")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.services.nameEn")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.nameEn}
                      onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
                      placeholder="Signature Haircut"
                    />
                  </Field>
                  <Field label={t("admin.services.descriptionEn")}>
                    <textarea
                      className="focus-ring min-h-28 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.descriptionEn}
                      onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })}
                      placeholder="Wash, consultation, precision cut, and finish"
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-wave-deep/10 p-4">
                <h3 className="font-black">{t("admin.services.chinese")}</h3>
                <div className="mt-4 grid gap-4">
                  <Field label={t("admin.services.nameZh")}>
                    <input
                      className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.nameZh}
                      onChange={(event) => setForm({ ...form, nameZh: event.target.value })}
                      placeholder="招牌剪发"
                    />
                  </Field>
                  <Field label={t("admin.services.descriptionZh")}>
                    <textarea
                      className="focus-ring min-h-28 w-full rounded-2xl border border-wave-deep/15 px-3 py-3"
                      value={form.descriptionZh}
                      onChange={(event) => setForm({ ...form, descriptionZh: event.target.value })}
                      placeholder="洗发、咨询、精剪和造型"
                    />
                  </Field>
                </div>
              </section>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.services.duration")}>
                <div className="flex rounded-2xl border border-wave-deep/15">
                  <input
                    className="focus-ring min-w-0 flex-1 rounded-l-2xl px-3 py-3"
                    type="number"
                    min={15}
                    step={15}
                    value={form.durationMinutes}
                    onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
                  />
                  <span className="flex items-center rounded-r-2xl bg-wave-mint px-3 text-sm font-semibold text-wave-deep">{t("common.min")}</span>
                </div>
              </Field>
              <Field label={t("admin.services.price")}>
                <div className="flex rounded-2xl border border-wave-deep/15">
                  <span className="flex items-center rounded-l-2xl bg-wave-mint px-3 text-sm font-semibold text-wave-deep">$</span>
                  <input
                    className="focus-ring min-w-0 flex-1 rounded-r-2xl px-3 py-3"
                    type="number"
                    min={0}
                    step={1}
                    value={form.priceDollars}
                    onChange={(event) => setForm({ ...form, priceDollars: Number(event.target.value) })}
                  />
                </div>
              </Field>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-wave-deep/10 px-4 py-3">
                <span>
                <span className="block font-semibold">{t("admin.services.activePublicly")}</span>
                <span className="text-sm text-wave-ink/60">{t("admin.services.visibleBooking")}</span>
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

          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white disabled:opacity-45"
          >
            <Save size={18} />
            {saveMutation.isPending ? t("common.saving") : t("admin.services.save")}
          </button>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-black">{t("admin.services.coverage")}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {services.map((service) => {
            const serviceText = getLocalizedServiceText(service, language);

            return (
              <article key={service.id} className="rounded-2xl border border-wave-deep/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{serviceText.name}</h3>
                    <p className="mt-1 text-sm text-wave-ink/60">
                      {service.durationMinutes} {t("common.min")} / {formatPrice(service.priceCents, locale)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-wave-deep">
                    {t("admin.services.stylistCount", { count: stylistsByService.get(service.id)?.length ?? 0 })}
                  </span>
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
              </article>
            );
          })}
        </div>
      </section>
    </AdminShell>
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
