import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, Images, ListChecks, Scissors, UsersRound } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { isStaffSignedIn } from "../lib/data";
import { useLanguage } from "../lib/use-language";

const navItems = [
  { to: "/admin", labelKey: "admin.nav.appointments", icon: ListChecks, end: true },
  { to: "/admin/calendar", labelKey: "admin.nav.calendar", icon: CalendarDays },
  { to: "/admin/services", labelKey: "admin.nav.services", icon: Scissors },
  { to: "/admin/stylists", labelKey: "admin.nav.stylists", icon: UsersRound },
  { to: "/admin/hours", labelKey: "admin.nav.hours", icon: Clock },
  { to: "/admin/gallery", labelKey: "admin.nav.gallery", icon: Images }
] as const;

export function AdminShell({
  title,
  eyebrow,
  actions,
  children
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    isStaffSignedIn().then((signedIn) => {
      if (!signedIn) navigate("/admin/login");
      setCheckedSession(true);
    });
  }, [navigate]);

  if (!checkedSession) {
    return <section className="mx-auto max-w-7xl px-4 py-10">{t("admin.checkingSession")}</section>;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wide text-wave-deep">
              {eyebrow === "Admin" ? t("common.admin") : eyebrow}
            </p>
          )}
          <h1 className={`${eyebrow ? "mt-2 " : ""}text-3xl font-black sm:text-4xl`}>{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      </div>

      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-full border border-wave-deep/10 bg-white p-1 shadow-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : undefined}
              className={({ isActive }) =>
                `focus-ring inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-wave-deep text-white"
                    : "text-wave-ink/70 hover:bg-wave-mint hover:text-wave-ink"
                }`
              }
            >
              <Icon size={16} />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      {children}
    </section>
  );
}
