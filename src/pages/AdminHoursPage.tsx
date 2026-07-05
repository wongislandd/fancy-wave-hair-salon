import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Clock, Moon, Sun } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import { listBusinessHours, updateBusinessHour } from "../lib/data";
import { useLanguage } from "../lib/use-language";
import type { BusinessHour } from "../lib/types";

export function AdminHoursPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const hoursQuery = useQuery({
    queryKey: ["business-hours"],
    queryFn: listBusinessHours
  });

  const hours = hoursQuery.data ?? [];
  const openDays = hours.filter((hour) => !hour.isClosed).length;

  const mutation = useMutation({
    mutationFn: ({ hour, patch }: { hour: BusinessHour; patch: Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed"> }) =>
      updateBusinessHour(hour, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-hours"] })
  });

  const updateHour = (
    hour: BusinessHour,
    patch: Partial<Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed">>
  ) => {
    mutation.mutate({
      hour,
      patch: {
        opensAt: patch.opensAt ?? hour.opensAt,
        closesAt: patch.closesAt ?? hour.closesAt,
        isClosed: patch.isClosed ?? hour.isClosed
      }
    });
  };

  return (
    <AdminShell title={t("admin.hours.title")}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.hours.openDays")} value={String(openDays)} icon={<Sun size={18} />} />
        <Metric label={t("admin.hours.closedDays")} value={String(7 - openDays)} icon={<Moon size={18} />} />
        <Metric label={t("admin.hours.slotEditor")} value={t("admin.hours.live")} icon={<Clock size={18} />} />
      </div>

      <section className="rounded-3xl border border-wave-deep/10 bg-white p-5 sm:p-6">
        <div className="grid gap-3">
          {hoursQuery.isLoading && <p>{t("admin.hours.loading")}</p>}
          {hours.map((hour) => (
            <article
              key={hour.id}
              className={`grid gap-3 rounded-2xl border p-4 lg:grid-cols-[150px_minmax(0,1fr)_160px] lg:items-start ${
                hour.isClosed ? "border-wave-deep/10 bg-wave-mint/55" : "border-wave-deep/15 bg-white"
              }`}
            >
              <div className="lg:pt-7">
                <h2 className="font-black">{t(dayNameKey(hour.dayOfWeek))}</h2>
                <p className="mt-1 text-sm text-wave-ink/60">{hour.isClosed ? t("common.closed") : `${hour.opensAt} - ${hour.closesAt}`}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("common.open")}</span>
                  <input
                    className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3 disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                    type="time"
                    value={hour.opensAt}
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(hour, { opensAt: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("common.close")}</span>
                  <input
                    className="focus-ring w-full rounded-2xl border border-wave-deep/15 px-3 py-3 disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                    type="time"
                    value={hour.closesAt}
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(hour, { closesAt: event.target.value })}
                  />
                </label>
              </div>

              <label className="flex min-h-[50px] items-center justify-between gap-3 rounded-2xl border border-wave-deep/10 px-4 py-3 font-semibold lg:mt-7 lg:justify-center">
                <span>{t("common.closed")}</span>
                <input
                  type="checkbox"
                  checked={hour.isClosed}
                  onChange={(event) => updateHour(hour, { isClosed: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>
            </article>
          ))}
        </div>
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
