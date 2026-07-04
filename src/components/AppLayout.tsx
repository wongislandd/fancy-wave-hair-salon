import { CalendarDays, Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen bg-wave-cream text-wave-ink">
      <header className="sticky top-0 z-30 border-b border-wave-deep/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-wide">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wave-deep text-white">
              <Scissors size={18} />
            </span>
            <span>Fancy Wave</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
              to="/book"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-4 py-2 text-white shadow-sm transition hover:bg-wave-ink"
            >
              <CalendarDays size={16} />
              Book
            </Link>
            <Link
              to={isAdmin ? "/" : "/admin/login"}
              className="focus-ring rounded-full px-3 py-2 text-wave-ink/70 transition hover:bg-wave-mint hover:text-wave-ink"
            >
              {isAdmin ? "Site" : "Staff"}
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
