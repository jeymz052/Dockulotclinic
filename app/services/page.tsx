import Link from "next/link";
import type { Metadata } from "next";
import {
  FaArrowRight,
  FaCheck,
  FaHeartPulse,
  FaLaptopMedical,
  FaStethoscope,
} from "react-icons/fa6";
import { clinicServices } from "@/src/lib/healthcare-content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Browse Doc Kulot services including clinic consultation, telemedicine, women's health, aesthetic procedures, prescription refill, laboratory interpretation, and wellness care.",
  alternates: {
    canonical: "/services",
  },
};

const TELEMEDICINE_HIGHLIGHTS = [
  "Weight loss management",
  "PCOS management",
  "Chronic diseases: hypertension, diabetes, and arthritis",
  "Laboratory results interpretation",
  "Prescription refill",
] as const;

const SERVICE_GROUPS = [
  {
    key: "telemedicine",
    label: "Telemedicine",
    href: "#telemedicine",
    icon: FaLaptopMedical,
    description: "Remote care for patients who need follow-up, interpretation, guidance, and refill support.",
  },
  {
    key: "clinic",
    label: "Clinic Consults",
    href: "#clinic-services",
    icon: FaStethoscope,
    description: "In-person consultation services for general care, reviews, and clinic-based assessment.",
  },
  {
    key: "procedures",
    label: "Aesthetic Procedures",
    href: "#procedures",
    icon: FaHeartPulse,
    description: "Appointment-only treatments with careful screening and guided booking.",
  },
] as const;

export default function ServicesPage() {
  const telemedicineServices = clinicServices.filter((service) => service.modes?.includes("Online") && !service.modes?.includes("Clinic"));
  const clinicServicesOnly = clinicServices.filter((service) => service.modes?.includes("Clinic") && !service.appointmentOnly);
  const procedureServices = clinicServices.filter((service) => service.appointmentOnly);
  const featuredTelemedicine = telemedicineServices.find((service) => service.title === "Telemedicine Services") ?? telemedicineServices[0];
  const telemedicineCards = telemedicineServices.filter((service) => service.title !== featuredTelemedicine?.title);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f6f4ef_100%)] text-slate-950">
      <section className="relative isolate overflow-hidden border-b border-black/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,197,138,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.05),transparent_30%)]" />
        <div className="absolute left-[-7rem] top-[-5rem] h-60 w-60 rounded-full bg-black/5 blur-3xl" />
        <div className="absolute right-[-7rem] top-16 h-72 w-72 rounded-full bg-[#d8c58a]/25 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.34em] text-black/60">Doc Kulot Services</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl mx-auto">
              Our Services
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9 mx-auto">
              A cleaner service board for telemedicine, clinic consultations, and appointment-only procedures.
              The layout is designed to feel calm, premium, and easier to scan before booking.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {SERVICE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <a
                    key={group.key}
                    href={group.href}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f9f8f5] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-black transition hover:border-black hover:bg-white"
                  >
                    <Icon className="text-sm text-[#d8c58a]" />
                    {group.label}
                  </a>
                );
              })}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Online care" value={`${telemedicineServices.length}`} />
              <MiniStat label="Clinic services" value={`${clinicServicesOnly.length}`} />
              <MiniStat label="Procedures" value={`${procedureServices.length}`} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Service map"
            title="A simpler way to browse what Doc Kulot offers"
            description="Three focused paths: telemedicine, clinic consultations, and procedures. Each block keeps the information readable while staying visually consistent."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {SERVICE_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <a
                  key={group.key}
                  href={group.href}
                  className="group rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-black/20"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-[#f8f6f0] text-[#d8c58a]">
                      <Icon className="text-xl" />
                    </div>
                    <FaArrowRight className="text-sm text-black/30 transition group-hover:translate-x-1 group-hover:text-black" />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{group.label}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{group.description}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section id="telemedicine" className="bg-white py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Telemedicine"
            title="Online services and consult support"
            description="These are the services patients can use through telemedicine visits."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredTelemedicine ? (
              <FeaturedServiceCard service={featuredTelemedicine} />
            ) : null}
            {telemedicineCards.map((service) => (
              <ServiceCard key={service.title} service={service} tone="light" />
            ))}
          </div>
        </div>
      </section>

      <section id="clinic-services" className="bg-[linear-gradient(180deg,#f7f4ee_0%,#ffffff_100%)] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Clinic"
            title="In-person consultations"
            description="General and clinic-based care for patients who need face-to-face assessment, review, or documentation."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {clinicServicesOnly.map((service) => (
              <ServiceCard key={service.title} service={service} tone="light" />
            ))}
          </div>
        </div>
      </section>

      <section id="procedures" className="bg-[#0b0b0b] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Procedures"
            title="Appointment-only aesthetic treatments"
            description="These services are screened and scheduled separately. The design keeps them clearly distinct from general consultation services."
            inverted
            eyebrowClassName="text-sm font-semibold uppercase tracking-[0.25em] text-[#d8c58a]"
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {procedureServices.map((service) => (
              <ServiceCard key={service.title} service={service} tone="dark" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-[2.5rem] border border-black/10 bg-[linear-gradient(135deg,#111111_0%,#1c1c1c_100%)] p-6 text-white shadow-[0_30px_100px_-64px_rgba(0,0,0,0.75)] sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d8c58a]">Ready to book</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Choose the service path that fits your visit
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
                  Start with telemedicine, clinic care, or an appointment-only procedure, then move into booking with
                  the service details already laid out clearly.
                </p>
              </div>

              <Link
                href="/#booking"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-[#d8c58a] hover:text-black"
              >
                Book a service
                <FaArrowRight className="text-xs" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ServiceCard({
  service,
  tone,
}: {
  service: (typeof clinicServices)[number];
  tone: "light" | "dark";
}) {
  const Icon = service.icon;
  const isDark = tone === "dark";

  return (
    <article
      className={`rounded-[1.75rem] border p-6 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.45)] ${
        isDark ? "border-white/10 bg-white/5 text-white" : "border-black/10 bg-white text-slate-950"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            isDark ? "border-white/10 bg-white/10 text-[#d8c58a]" : "border-black/10 bg-[#f8f6f0] text-[#d8c58a]"
          }`}
        >
          <Icon className="text-xl" />
        </div>
        {service.appointmentOnly ? (
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
              isDark ? "border border-[#d8c58a]/25 bg-[#d8c58a]/10 text-[#d8c58a]" : "border border-black/10 bg-[#f8f6f0] text-black"
            }`}
          >
            Appointment only
          </span>
        ) : null}
      </div>

      <h3 className={`mt-5 text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
        {service.title}
      </h3>
      <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/75" : "text-slate-600"}`}>{service.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {service.modes?.map((mode) => (
          <span
            key={mode}
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              isDark ? "border border-white/10 bg-white/5 text-white/80" : "border border-black/10 bg-white text-black/70"
            }`}
          >
            {mode}
          </span>
        ))}
      </div>
    </article>
  );
}

function FeaturedServiceCard({ service }: { service: (typeof clinicServices)[number] }) {
  const Icon = service.icon;

  return (
    <article className="rounded-[2rem] border border-black/10 bg-[linear-gradient(180deg,#111111_0%,#050505_100%)] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,0.75)] md:col-span-2 xl:col-span-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8c58a]/20 bg-[#d8c58a]/10 text-[#d8c58a]">
          <Icon className="text-2xl" />
        </div>
        <span className="rounded-full border border-[#d8c58a]/20 bg-[#d8c58a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8c58a]">
          Featured
        </span>
      </div>

      <h3 className="mt-6 text-2xl font-black tracking-tight">{service.title}</h3>
      <p className="mt-3 text-sm leading-7 text-white/75">
        Weight loss management, PCOS management, chronic disease review, lab interpretation, and prescription refill
        support are the core telemedicine touchpoints.
      </p>

      <div className="mt-5 space-y-3">
        {TELEMEDICINE_HIGHLIGHTS.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 p-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#d8c58a]/20 bg-[#d8c58a]/10 text-[#d8c58a]">
              <FaCheck className="h-3 w-3" />
            </span>
            <p className="text-sm leading-6 text-white/85">{item}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-black/10 bg-[#f8f6f0] px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/45">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  inverted = false,
  eyebrowClassName = "text-sm font-semibold uppercase tracking-[0.25em] text-black",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  inverted?: boolean;
  eyebrowClassName?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className={eyebrowClassName}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${inverted ? "text-white" : "text-slate-950"}`}>
        {title}
      </h2>
      {description ? <p className={`mt-4 leading-7 ${inverted ? "text-white/70" : "text-slate-600"}`}>{description}</p> : null}
    </div>
  );
}
