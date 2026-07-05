import { useMutation } from "@tanstack/react-query";
import { CalendarDays, LogOut, Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOutStaff } from "../lib/data";
import { useLanguage } from "../lib/use-language";
import type { Language } from "../lib/localization";
import { salonName } from "../lib/salon";

const languageOptions: Array<{ id: Language; label: string }> = [
  { id: "zh", label: "中文" },
  { id: "en", label: "EN" }
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const nextLanguage = language === "zh" ? "en" : "zh";
  const signOutMutation = useMutation({
    mutationFn: signOutStaff,
    onSuccess: () => navigate("/")
  });

  return (
    <div
      className={
        isAdminRoute
          ? "admin-theme min-h-screen bg-neutral-50 text-neutral-950"
          : "min-h-screen bg-wave-cream text-wave-ink"
      }
    >
      <header className="sticky top-0 z-30 border-b border-wave-deep/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-1.5 font-bold tracking-wide">
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wave-deep text-wave-blush">
                <Scissors size={18} />
              </span>
              <span className="max-w-28 text-[13px] leading-tight sm:max-w-none sm:text-base">
                {salonName}
              </span>
            </Link>
          </div>
          <nav className="ml-3 flex shrink-0 items-center gap-2 text-sm font-medium">
            <button
              type="button"
              role="switch"
              aria-checked={language === "en"}
              aria-label={t("app.language")}
              onClick={() => setLanguage(nextLanguage)}
              className="focus-ring relative grid h-9 w-[5.75rem] grid-cols-2 items-center overflow-hidden rounded-full border border-wave-deep/10 bg-wave-mint p-1 text-xs font-bold shadow-sm transition-colors"
            >
              <span
                aria-hidden="true"
                className={`absolute left-1 top-1 h-7 w-[calc(50%-0.25rem)] rounded-full bg-wave-deep shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none ${
                  language === "en" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              {languageOptions.map((option) => (
                <span
                  key={option.id}
                  className={`relative z-10 flex h-7 items-center justify-center rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                    language === option.id ? "text-white" : "text-wave-ink/70"
                  }`}
                >
                  {option.label}
                </span>
              ))}
            </button>
            {isAdminRoute ? (
              <button
                type="button"
                disabled={signOutMutation.isPending}
                onClick={() => signOutMutation.mutate()}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-wave-ink disabled:opacity-50 sm:px-4 sm:text-sm"
              >
                <LogOut size={16} />
                <span>{t("common.signOut")}</span>
              </button>
            ) : (
              <Link
                to="/book"
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-wave-ink sm:px-4 sm:text-sm"
              >
                <CalendarDays size={16} />
                <span className="hidden sm:inline">{t("app.bookAppointment")}</span>
                <span className="sm:hidden">{language === "zh" ? "预约" : "Book"}</span>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
