import { ArrowRight, CalendarCheck, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listPublicServices } from "../lib/data";
import { formatPrice } from "../lib/booking";

export function LandingPage() {
  const { data: services = [] } = useQuery({
    queryKey: ["public-services"],
    queryFn: listPublicServices
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-wave-mint px-3 py-1 text-sm font-semibold text-wave-deep">
              <Sparkles size={16} />
              Fresh cuts, color, and care
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal text-wave-ink sm:text-5xl lg:text-6xl">
              Modern salon booking for Fancy Wave.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-wave-ink/70">
              Choose a service, pick a time, and manage your reservation from
              the confirmation link. Clean for customers, useful for staff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/book"
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-wave-deep px-5 py-3 font-semibold text-white shadow-soft transition hover:bg-wave-ink"
              >
                Book an appointment
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/admin/login"
                className="focus-ring inline-flex items-center rounded-full border border-wave-deep/20 bg-white px-5 py-3 font-semibold text-wave-ink transition hover:bg-wave-mint"
              >
                Staff dashboard
              </Link>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] shadow-soft">
            <img
              src="/assets/salon-hero.png"
              alt="Clean modern hair salon interior"
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-5 left-5 right-5 grid gap-3 rounded-3xl bg-white/88 p-4 backdrop-blur sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <CalendarCheck className="text-wave-deep" />
                <span className="text-sm font-semibold">Guest booking</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-wave-deep" />
                <span className="text-sm font-semibold">Manage by link</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Popular services</h2>
            <p className="mt-2 text-wave-ink/65">Seeded services are editable from the staff side.</p>
          </div>
          <Link to="/book" className="hidden font-semibold text-wave-deep sm:inline">
            View booking flow
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-wave-deep/10 bg-white p-5 shadow-sm">
              <h3 className="font-bold">{service.name}</h3>
              <p className="mt-2 min-h-14 text-sm leading-6 text-wave-ink/65">{service.description}</p>
              <div className="mt-5 flex items-center justify-between text-sm font-semibold">
                <span>{service.durationMinutes} min</span>
                <span>{formatPrice(service.priceCents)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
