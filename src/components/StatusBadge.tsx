import type { AppointmentStatus } from "../lib/types";
import { useLanguage } from "../lib/use-language";

const statusClasses: Record<AppointmentStatus, string> = {
  confirmed: "bg-wave-mint text-wave-deep border-wave-deep/20",
  cancelled: "bg-wave-deep/10 text-wave-deep border-wave-deep/25",
  completed: "bg-wave-blush/30 text-wave-ink border-wave-blush/60"
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useLanguage();

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
