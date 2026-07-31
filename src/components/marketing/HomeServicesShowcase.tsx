"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FaCalendarCheck,
  FaCheck,
  FaChevronDown,
  FaXmark,
} from "react-icons/fa6";
import { clinicServices } from "@/src/lib/healthcare-content";
import type { LandingService } from "@/src/lib/db/types";

function getClinicService(title: string) {
  const service = clinicServices.find((item) => item.title === title);
  if (!service) {
    throw new Error(`Missing clinic service: ${title}`);
  }

  return service;
}

const SERVICE_DETAILS = [
  {
    id: "general-consultation",
    eyebrow: "Clinic",
    title: getClinicService("General Consultation").title,
    description: getClinicService("General Consultation").description,
    icon: getClinicService("General Consultation").icon,
    tone: "light" as const,
    cta: "Learn more",
    highlights: ["Assessment", "Follow-up", "Primary care"],
    fullDescription:
      "General consultation is ideal for common health concerns, follow-up visits, symptom review, and primary care guidance. It gives patients a clear starting point before moving into labs, treatment plans, or long-term monitoring.",
    details: [
      "Clinic-based assessment for common symptoms and concerns",
      "Follow-up visits for ongoing treatment or recovery",
      "Primary care support and next-step planning",
    ],
    bestFor:
      "Best for in-clinic assessment, first consults, and follow-up care planning.",
  },
  {
    id: "telemedicine-services",
    eyebrow: "Featured",
    title: getClinicService("Telemedicine Services").title,
    description: getClinicService("Telemedicine Services").description,
    icon: getClinicService("Telemedicine Services").icon,
    tone: "dark" as const,
    cta: "View details",
    highlights: [
      "Weight loss management",
      "PCOS management",
      "Chronic disease review",
      "Laboratory interpretation",
      "Prescription refill",
    ],
    fullDescription:
      "Telemedicine keeps the consultation experience on your schedule while still giving structure, guidance, and doctor review. It works best for follow-up care, chronic condition monitoring, women's health concerns, and medically guided weight support.",
    details: [
      "Weight loss management with structured follow-up",
      "PCOS support and hormonal symptom review",
      "Chronic disease monitoring and maintenance consults",
      "Laboratory results interpretation and next-step planning",
      "Prescription refill review for eligible cases",
    ],
    bestFor:
      "Best for remote follow-up, PCOS support, lab review, and medically guided weight management.",
  },
  {
    id: "womens-health",
    eyebrow: "Women's health",
    title: getClinicService("Women's Health and Aesthetic Care").title,
    description: getClinicService("Women's Health and Aesthetic Care").description,
    icon: getClinicService("Women's Health and Aesthetic Care").icon,
    tone: "light" as const,
    cta: "Learn more",
    highlights: ["PCOS", "Hormonal acne", "Weight loss support"],
    fullDescription:
      "This service brings together women's health concerns and aesthetic consults in one more focused care lane. It is designed for patients who need guidance on PCOS, acne patterns, hormonal concerns, body changes, and confidence-related skin or wellness concerns.",
    details: [
      "PCOS consultation and symptom support",
      "Acne and hormonal acne assessment",
      "Weight loss support connected to women's health goals",
      "Aesthetic medicine consultation and treatment planning",
    ],
    bestFor:
      "Best for PCOS, acne concerns, women's wellness, and aesthetic consult guidance.",
  },
  {
    id: "support-services",
    eyebrow: "Support",
    title: "Documentation and Refill Support",
    description:
      "Laboratory interpretation, prescription refill, medical certificate requests, flu vaccination, and wellness follow-up.",
    icon: FaCalendarCheck,
    tone: "dark" as const,
    cta: "View details",
    highlights: ["Lab review", "Refills", "Certificates"],
    fullDescription:
      "This group covers the supporting services patients often need after a consult or while staying on track with ongoing care. It keeps the process organized without forcing patients to leave the landing page just to understand what is available.",
    details: [
      getClinicService("Laboratory Results Interpretation").description,
      getClinicService("Prescription Refill").description,
      getClinicService("Medical Certificate Request").description,
      getClinicService("Flu Vaccination").description,
      getClinicService("Wellness Consultation").description,
    ],
    bestFor:
      "Best for support services after consultation, including review, refill, and documentation needs.",
  },
] as const;

function getEditableServiceCards(services?: LandingService[]) {
  if (!services?.length) {
    return SERVICE_DETAILS;
  }

  return services.map((service, index) => {
    const fallback = SERVICE_DETAILS[index] ?? SERVICE_DETAILS[0];
    const matched = clinicServices.find((item) => item.title === service.title);

    return {
      ...fallback,
      id: `${service.kind || "service"}-${index}`,
      eyebrow: service.kind || fallback.eyebrow,
      title: service.title || fallback.title,
      description: service.description || fallback.description,
      icon: matched?.icon ?? fallback.icon,
      tone: service.kind === "online" || index % 2 === 1 ? "dark" as const : "light" as const,
      highlights: service.bullets?.length
        ? service.bullets.map((bullet) => bullet.title || bullet.body).filter(Boolean)
        : fallback.highlights,
      fullDescription: service.description || fallback.fullDescription,
      details: service.bullets?.length
        ? service.bullets.map((bullet) => bullet.body || bullet.title).filter(Boolean)
        : fallback.details,
      bestFor: fallback.bestFor,
    };
  });
}

export default function HomeServicesShowcase({
  eyebrow = "Services",
  title = "My Services",
  subtitle = "Review available services before booking.",
  services,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  services?: LandingService[];
}) {
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const serviceCards = useMemo(() => getEditableServiceCards(services), [services]);

  const activeService = useMemo(
    () => serviceCards.find((service) => service.id === activeServiceId) ?? null,
    [activeServiceId, serviceCards],
  );

  return (
    <section
      id="clinic"
      className="relative isolate overflow-hidden border-y border-black/5 bg-[linear-gradient(180deg,#fbf8f1_0%,#ffffff_48%,#f7f3ea_100%)] py-16 md:py-24"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c58a]/70 to-transparent" />
      <div className="absolute left-1/2 top-0 h-32 w-[42rem] -translate-x-1/2 rounded-full bg-[#d8c58a]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-black shadow-sm">
            {eyebrow}
          </div>
          <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            {subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {serviceCards.map((card) => {
            const Icon = card.icon;
            const isDark = card.tone === "dark";
            const isActive = activeService?.id === card.id;

            return (
              <article
                key={card.id}
                className={`flex h-full flex-col rounded-[2rem] border p-6 transition-all duration-300 ${
                  isDark
                    ? "border-black/80 bg-[linear-gradient(180deg,#101010_0%,#1b1b1b_100%)] text-white shadow-[0_24px_70px_-44px_rgba(0,0,0,0.65)]"
                    : "border-black/10 bg-white text-slate-950 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.28)]"
                } ${isActive ? "ring-2 ring-[#d8c58a]/55" : "hover:-translate-y-1"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isDark ? "border-[#d8c58a]/20 bg-[#d8c58a]/10 text-[#d8c58a]" : "border-black/10 bg-[#f8f4eb] text-[#d8c58a]"
                    }`}
                  >
                    <Icon className="text-xl" />
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                      isDark
                        ? "border-[#d8c58a]/20 bg-[#d8c58a]/10 text-[#d8c58a]"
                        : "border-black/10 bg-[#f7f4ee] text-black/70"
                    }`}
                  >
                    {card.eyebrow}
                  </span>
                </div>

                <h3 className={`mt-5 text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
                  {card.title}
                </h3>
                <p className={`mt-4 text-sm leading-7 ${isDark ? "text-white/75" : "text-slate-600"}`}>
                  {card.description}
                </p>

                <div className="mt-5 space-y-2">
                  {card.highlights.map((item) =>
                    isDark ? (
                      <div key={item} className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d8c58a]/10 text-[#d8c58a]">
                          <FaCheck className="h-3 w-3" />
                        </span>
                        {item}
                      </div>
                    ) : (
                      <span
                        key={item}
                        className="inline-flex w-full items-center rounded-full border border-black/10 bg-[#f7f4ee] px-4 py-2 text-sm text-slate-700"
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>

                <div className="mt-auto pt-6">
                  <button
                    type="button"
                    onClick={() => setActiveServiceId((current) => current === card.id ? null : card.id)}
                    aria-expanded={isActive}
                    aria-controls="service-details-panel"
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.16em] transition ${
                      isDark ? "bg-white text-black hover:bg-[#f0f0f0]" : "bg-black text-white hover:bg-black/85"
                    }`}
                  >
                    {card.cta}
                    <FaChevronDown className={`text-xs transition-transform ${isActive ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {activeService ? (
          <div
            id="service-details-panel"
            className="mt-10 overflow-hidden rounded-[2.4rem] border border-black/10 bg-[linear-gradient(180deg,#111111_0%,#171717_100%)] text-white shadow-[0_30px_90px_-48px_rgba(0,0,0,0.78)]"
          >
            <div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d8c58a]">
                      {activeService.eyebrow}
                    </p>
                    <h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                      {activeService.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveServiceId(null)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                    aria-label="Close service details"
                  >
                    <FaXmark />
                  </button>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
                  {activeService.fullDescription}
                </p>

                <div className="mt-6 space-y-3">
                  {activeService.details.map((detail) => (
                    <div
                      key={detail}
                      className="flex items-start gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white/85"
                    >
                      <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d8c58a]/10 text-[#d8c58a]">
                        <FaCheck className="h-3 w-3" />
                      </span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 sm:p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d8c58a]">
                  Best next step
                </p>
                <h4 className="mt-3 text-xl font-black tracking-tight">
                  Stay here and continue to booking
                </h4>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  The full details now stay open right on the landing page, so patients can compare services first and book only when ready.
                </p>

                <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/65">
                  {activeService.bestFor}
                </div>

                <div className="mt-5 space-y-3">
                  <Link
                    href="/#booking"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-[#f0f0f0]"
                  >
                    <FaCalendarCheck />
                    Book appointment
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveServiceId(null)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
                  >
                    Close details
                    <FaXmark className="text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
