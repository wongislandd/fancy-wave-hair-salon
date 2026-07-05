import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { CalendarPlus, Moon, Pencil, Sun, Trash2, X } from "lucide-react";
import { AdminShell } from "../components/AdminShell";
import {
  deleteBusinessHourException,
  listBusinessHourExceptions,
  listBusinessHours,
  saveBusinessHourException,
  type BusinessHourExceptionSaveValues,
  updateBusinessHour
} from "../lib/data";
import { useLanguage } from "../lib/use-language";
import type { BusinessHour, BusinessHourException } from "../lib/types";

export function AdminHoursPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState<BusinessHourExceptionSaveValues>(
    newExceptionForm
  );

  const hoursQuery = useQuery({
    queryKey: ["business-hours"],
    queryFn: listBusinessHours
  });
  const exceptionsQuery = useQuery({
    queryKey: ["business-hour-exceptions"],
    queryFn: listBusinessHourExceptions
  });

  const hours = hoursQuery.data ?? [];
  const specialHours = exceptionsQuery.data ?? [];
  const openDays = hours.filter((hour) => !hour.isClosed).length;

  const refreshScheduleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["business-hours"] });
    queryClient.invalidateQueries({ queryKey: ["business-hour-exceptions"] });
    queryClient.invalidateQueries({ queryKey: ["available-slots"] });
    queryClient.invalidateQueries({ queryKey: ["staff-available-slots"] });
    queryClient.invalidateQueries({ queryKey: ["admin-move-slots"] });
    queryClient.invalidateQueries({ queryKey: ["managed-slots"] });
  };

  const mutation = useMutation({
    mutationFn: ({ hour, patch }: { hour: BusinessHour; patch: Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed"> }) =>
      updateBusinessHour(hour, patch),
    onSuccess: refreshScheduleQueries
  });

  const saveExceptionMutation = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: BusinessHourExceptionSaveValues }) =>
      saveBusinessHourException(values, id),
    onSuccess: () => {
      resetExceptionForm();
      refreshScheduleQueries();
    }
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: deleteBusinessHourException,
    onSuccess: refreshScheduleQueries
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

  function resetExceptionForm() {
    setEditingExceptionId(null);
    setExceptionForm(newExceptionForm());
  }

  function editException(exception: BusinessHourException) {
    setEditingExceptionId(exception.id);
    setExceptionForm({
      startsOn: exception.startsOn,
      endsOn: exception.endsOn,
      opensAt: exception.opensAt,
      closesAt: exception.closesAt,
      isClosed: exception.isClosed,
      note: exception.note ?? ""
    });
  }

  function submitException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exceptionForm.endsOn < exceptionForm.startsOn) return;
    if (!exceptionForm.isClosed && exceptionForm.opensAt >= exceptionForm.closesAt) return;

    saveExceptionMutation.mutate({
      id: editingExceptionId ?? undefined,
      values: exceptionForm
    });
  }

  function deleteException(exception: BusinessHourException) {
    if (!window.confirm(t("admin.hours.deleteSpecialConfirm", { range: formatExceptionRange(exception) }))) {
      return;
    }

    deleteExceptionMutation.mutate(exception.id);
  }

  const exceptionError = saveExceptionMutation.error ?? deleteExceptionMutation.error;
  const hasInvalidRange = exceptionForm.endsOn < exceptionForm.startsOn;
  const hasInvalidHours = !exceptionForm.isClosed && exceptionForm.opensAt >= exceptionForm.closesAt;

  return (
    <AdminShell title={t("admin.hours.title")}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric label={t("admin.hours.openDays")} value={String(openDays)} icon={<Sun size={18} />} />
        <Metric label={t("admin.hours.closedDays")} value={String(7 - openDays)} icon={<Moon size={18} />} />
        <Metric label={t("admin.hours.specialHours")} value={String(specialHours.length)} icon={<CalendarPlus size={18} />} />
      </div>

      <section className="ui-surface">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{t("admin.hours.weeklyTitle")}</h2>
        </div>
        <div className="ui-divided-list">
          {hoursQuery.isLoading && <p>{t("admin.hours.loading")}</p>}
          {hours.map((hour) => (
            <article
              key={hour.id}
              className={`ui-divided-row grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)_160px] lg:items-start ${
                hour.isClosed ? "opacity-70" : ""
              }`}
            >
              <div className="lg:pt-7">
                <h3 className="font-black">{t(dayNameKey(hour.dayOfWeek))}</h3>
                <p className="mt-1 text-sm text-wave-ink/60">{hour.isClosed ? t("common.closed") : `${hour.opensAt} - ${hour.closesAt}`}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("common.open")}</span>
                  <input
                    className="ui-field disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                    type="time"
                    value={hour.opensAt}
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(hour, { opensAt: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("common.close")}</span>
                  <input
                    className="ui-field disabled:bg-wave-mint/70 disabled:text-wave-ink/45"
                    type="time"
                    value={hour.closesAt}
                    disabled={hour.isClosed}
                    onChange={(event) => updateHour(hour, { closesAt: event.target.value })}
                  />
                </label>
              </div>

              <label className="flex min-h-[50px] items-center justify-between gap-3 rounded-2xl bg-wave-mint/45 px-4 py-3 font-semibold lg:mt-7 lg:justify-center">
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

      <section className="ui-surface mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">{t("admin.hours.specialTitle")}</h2>
          {editingExceptionId && (
            <button
              type="button"
              onClick={resetExceptionForm}
              className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-wave-deep/10 text-wave-ink/70 hover:bg-wave-mint"
              aria-label={t("admin.hours.cancelEditSpecial")}
              title={t("admin.hours.cancelEditSpecial")}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={submitException} className="grid gap-3 border-t border-wave-deep/10 pt-5 lg:grid-cols-[1fr_1fr_1fr_1fr_150px] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">{t("admin.hours.startsOn")}</span>
            <input
              className="ui-field"
              type="date"
              value={exceptionForm.startsOn}
              onChange={(event) => {
                const startsOn = event.target.value;
                setExceptionForm((current) => ({
                  ...current,
                  startsOn,
                  endsOn: current.endsOn >= startsOn ? current.endsOn : startsOn
                }));
              }}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">{t("admin.hours.endsOn")}</span>
            <input
              className="ui-field"
              type="date"
              min={exceptionForm.startsOn}
              value={exceptionForm.endsOn}
              onChange={(event) => setExceptionForm((current) => ({ ...current, endsOn: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">{t("common.open")}</span>
            <input
              className="ui-field disabled:bg-wave-mint/50 disabled:text-wave-ink/45"
              type="time"
              disabled={exceptionForm.isClosed}
              value={exceptionForm.opensAt}
              onChange={(event) => setExceptionForm((current) => ({ ...current, opensAt: event.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">{t("common.close")}</span>
            <input
              className="ui-field disabled:bg-wave-mint/50 disabled:text-wave-ink/45"
              type="time"
              disabled={exceptionForm.isClosed}
              value={exceptionForm.closesAt}
              onChange={(event) => setExceptionForm((current) => ({ ...current, closesAt: event.target.value }))}
            />
          </label>
          <label className="flex min-h-[50px] items-center justify-between gap-3 rounded-2xl bg-wave-mint/45 px-4 py-3 font-semibold">
            <span>{t("common.closed")}</span>
            <input
              type="checkbox"
              checked={exceptionForm.isClosed}
              onChange={(event) => setExceptionForm((current) => ({ ...current, isClosed: event.target.checked }))}
              className="h-5 w-5"
            />
          </label>
          <label className="block lg:col-span-4">
            <span className="mb-2 block text-sm font-semibold">{t("admin.hours.note")}</span>
            <input
              className="ui-field"
              value={exceptionForm.note ?? ""}
              placeholder={t("admin.hours.notePlaceholder")}
              onChange={(event) => setExceptionForm((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={saveExceptionMutation.isPending || hasInvalidRange || hasInvalidHours}
            className="focus-ring min-h-[50px] rounded-2xl bg-wave-deep px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {saveExceptionMutation.isPending
              ? t("common.saving")
              : editingExceptionId
                ? t("admin.hours.updateSpecial")
                : t("admin.hours.saveSpecial")}
          </button>
        </form>

        {hasInvalidRange && <p className="mt-3 text-sm font-semibold text-red-700">{t("admin.hours.invalidRange")}</p>}
        {hasInvalidHours && <p className="mt-3 text-sm font-semibold text-red-700">{t("admin.hours.invalidHours")}</p>}
        {exceptionError instanceof Error && <p className="mt-3 text-sm font-semibold text-red-700">{exceptionError.message}</p>}

        <div className="ui-divided-list mt-5">
          {exceptionsQuery.isLoading && <p>{t("admin.hours.loadingSpecial")}</p>}
          {!exceptionsQuery.isLoading && specialHours.length === 0 && (
            <p className="py-5 text-sm font-semibold text-wave-ink/65">
              {t("admin.hours.emptySpecial")}
            </p>
          )}
          {specialHours.map((exception) => (
            <article
              key={exception.id}
              className={`ui-divided-row grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_96px] sm:items-center ${
                exception.isClosed ? "opacity-70" : ""
              }`}
            >
              <div>
                <h3 className="font-black">{formatExceptionRange(exception)}</h3>
                <p className="mt-1 text-sm text-wave-ink/60">
                  {exception.note?.trim() || t("admin.hours.noNote")}
                </p>
              </div>
              <p className="font-semibold">{formatExceptionHours(exception, t("common.closed"))}</p>
              <div className="flex justify-start gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => editException(exception)}
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-wave-deep/10 text-wave-ink/70 hover:bg-wave-mint"
                  aria-label={t("admin.hours.editSpecial")}
                  title={t("admin.hours.editSpecial")}
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteException(exception)}
                  disabled={deleteExceptionMutation.isPending}
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-wave-deep/10 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  aria-label={t("admin.hours.deleteSpecial")}
                  title={t("admin.hours.deleteSpecial")}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="ui-surface-compact flex items-center justify-between gap-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">{label}</p>
        <p className="mt-2 text-2xl font-black">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wave-mint text-wave-deep">
        {icon}
      </span>
    </div>
  );
}

function newExceptionForm(): BusinessHourExceptionSaveValues {
  const today = todayInputDate();

  return {
    startsOn: today,
    endsOn: today,
    opensAt: "09:00",
    closesAt: "17:00",
    isClosed: true,
    note: ""
  };
}

function todayInputDate(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatExceptionRange(exception: BusinessHourException): string {
  return exception.startsOn === exception.endsOn
    ? exception.startsOn
    : `${exception.startsOn} - ${exception.endsOn}`;
}

function formatExceptionHours(exception: BusinessHourException, closedLabel: string): string {
  return exception.isClosed ? closedLabel : `${exception.opensAt} - ${exception.closesAt}`;
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
