import type { AppointmentStatus } from "../lib/types";

const statusClasses: Record<AppointmentStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200"
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
