"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaBolt, FaFire, FaClock, FaTag, FaCalendarCheck, FaArrowRight } from "react-icons/fa6";

const SALE_START = new Date("2026-11-11T00:00:00+08:00").getTime();
const SALE_END = new Date("2026-11-14T23:59:59+08:00").getTime();

type SaleProc = {
  id: string;
  category: string;
  name: string;
  subtitle: string | null;
  price: number;
  serviceTitle: string;
  isNew?: boolean;
};

const SALE_PROCEDURES: SaleProc[] = [
  { id: "glowrx", category: "GlowRx", name: "GlowRx Program", subtitle: "5-week program", price: 9999, serviceTitle: "GlowRx Program" },
  { id: "botox-whole", category: "Botox", name: "Whole Face (incl. Jawtox)", subtitle: null, price: 20999, serviceTitle: "Botox - Whole Face (incl Jawtox)" },
  { id: "botox-jaw", category: "Botox", name: "Jawtox", subtitle: null, price: 10999, serviceTitle: "Botox - Jawtox" },
  { id: "botox-forehead", category: "Botox", name: "Forehead", subtitle: null, price: 6999, serviceTitle: "Botox - Forehead" },
  { id: "botox-alar", category: "Botox", name: "Alartox", subtitle: null, price: 6499, serviceTitle: "Botox - Alartox" },
  { id: "botox-nefertiti", category: "Botox", name: "Nefertiti Botox", subtitle: null, price: 11999, serviceTitle: "Botox - Nefertiti" },
  { id: "botox-barbie", category: "Botox", name: "Barbie Arm Botox", subtitle: null, price: 14999, serviceTitle: "Botox - Barbie Arm" },
  { id: "botox-trap", category: "Botox", name: "Traptox", subtitle: null, price: 14999, serviceTitle: "Botox - Traptox" },
  { id: "botox-mesolift", category: "Botox", name: "Mesolift", subtitle: null, price: 9999, serviceTitle: "Botox - Mesolift" },
  { id: "meso-chin", category: "Mesolipo", name: "Chin", subtitle: null, price: 3999, serviceTitle: "Mesolipo - Chin" },
  { id: "meso-face", category: "Mesolipo", name: "Face", subtitle: null, price: 3999, serviceTitle: "Mesolipo - Face" },
  { id: "meso-arms", category: "Mesolipo", name: "Arms", subtitle: null, price: 5499, serviceTitle: "Mesolipo - Arms" },
  { id: "fillers-lips", category: "Fillers", name: "Lips", subtitle: null, price: 14499, serviceTitle: "Fillers - Lips" },
  { id: "fillers-chin", category: "Fillers", name: "Chin", subtitle: null, price: 8999, serviceTitle: "Fillers - Chin" },
  { id: "pinkglow", category: "Microneedle + Exosomes + Botox", name: "PinkGlow", subtitle: "Best for brightening dull skin", price: 7499, serviceTitle: "PinkGlow", isNew: true },
  { id: "redglow", category: "Microneedle + Exosomes + Botox", name: "RedGlow", subtitle: "For acne treatment", price: 7999, serviceTitle: "RedGlow", isNew: true },
  { id: "crystalglow", category: "Microneedle + Exosomes + Botox", name: "CrystalGlow", subtitle: "Best for hydrating skin", price: 7499, serviceTitle: "CrystalGlow", isNew: true },
];

function formatPeso(v: number) {
  return `₱${v.toLocaleString("en-PH")}`;
}

function getTimeRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function CountdownTimer({ target, label }: { target: number; label: string }) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ total: 1, days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setMounted(true);
    setTime(getTimeRemaining(target));
    const t = setInterval(() => setTime(getTimeRemaining(target)), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (mounted && time.total <= 0) return null;

  const blocks = [
    { value: mounted ? time.days : 0, unit: "Days" },
    { value: mounted ? time.hours : 0, unit: "Hrs" },
    { value: mounted ? time.minutes : 0, unit: "Min" },
    { value: mounted ? time.seconds : 0, unit: "Sec" },
  ];

  return (
    <div className="text-center">
      <p className="mb-4 text-[11px] font-black uppercase tracking-[0.35em] text-[#d8c58a]/70">{label}</p>
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 xs:gap-2 sm:gap-3">
        {blocks.map((b, i) => (
          <div key={b.unit} className="flex items-center gap-1.5 xs:gap-2 sm:gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 xs:h-14 xs:w-14 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem] items-center justify-center rounded-xl xs:rounded-2xl border border-[#d8c58a]/20 bg-[#d8c58a]/5">
                <span suppressHydrationWarning className="text-xl font-black text-white sm:text-2xl md:text-3xl">
                  {String(b.value).padStart(2, "0")}
                </span>
              </div>
              <span className="mt-1 text-[8px] xs:text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">{b.unit}</span>
            </div>
            {i < blocks.length - 1 && <span className="mb-4 text-base xs:text-lg sm:text-xl font-black text-[#d8c58a]/30">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SaleSection() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isBefore = now < SALE_START;
  const isDuring = now >= SALE_START && now <= SALE_END;
  const isAfter = now > SALE_END;

  // Hide entirely after sale
  if (isAfter) return null;

  const categories = ["All", ...Array.from(new Set(SALE_PROCEDURES.map((p) => p.category)))];
  const filtered = filter === "All" ? SALE_PROCEDURES : SALE_PROCEDURES.filter((p) => p.category === filter);

  return (
    <section id="sale" className="relative overflow-hidden bg-[#0b0b0b] py-16 md:py-24">
      {/* Subtle glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#d8c58a]/5 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[400px] translate-x-1/3 translate-y-1/3 rounded-full bg-[#d8c58a]/3 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* ── Header ── */}
        <div className="text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8c58a]/25 bg-[#d8c58a]/8 px-5 py-2">
            <FaFire className="animate-pulse text-[#d8c58a]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#d8c58a]">
              {isBefore ? "Coming Soon" : "Limited Time Only"}
            </span>
            <FaFire className="animate-pulse text-[#d8c58a]" />
          </div>

          {/* 11.11 */}
          <h2 className="text-5xl font-black tracking-tighter xs:text-6xl sm:text-8xl lg:text-9xl">
            <span className="text-white">11</span>
            <span className="mx-1 text-[#d8c58a] sm:mx-2">.</span>
            <span className="text-white">11</span>
          </h2>

          <h3 className="mt-2 text-xl font-black uppercase tracking-[0.18em] text-white/90 sm:text-2xl lg:text-3xl">
            Doc Kulot Sale
          </h3>

          <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-2xl border border-[#d8c58a]/30 bg-[#d8c58a]/10 px-6 py-3 sm:px-8 sm:py-4">
            <FaTag className="text-lg text-[#d8c58a] sm:text-xl" />
            <span className="text-xl font-black text-[#d8c58a] sm:text-2xl">11% OFF</span>
            <span className="text-xs font-bold text-[#d8c58a]/70 sm:text-sm">ALL PROCEDURES</span>
          </div>

          {/* Countdown */}
          <div className="mt-8">
            {isBefore && <CountdownTimer target={SALE_START} label="Sale starts in" />}
            {isDuring && <CountdownTimer target={SALE_END} label="Sale ends in" />}
          </div>

          {/* Info pills */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2">
              <FaClock className="text-[10px] text-[#d8c58a]/60" />
              <span className="text-[11px] font-bold text-white/50">Buy Nov 11–14, 2026 only</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-2">
              <FaCalendarCheck className="text-[10px] text-[#d8c58a]/60" />
              <span className="text-[11px] font-bold text-white/50">Schedule Mon–Fri until Nov 30</span>
            </div>
          </div>
        </div>

        {/* ── Category filter ── */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                filter === cat
                  ? "bg-[#d8c58a] text-black"
                  : "border border-white/10 text-white/50 hover:border-[#d8c58a]/30 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Procedure cards ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((proc) => {
            const salePrice = Math.round(proc.price * 0.89);
            const savings = proc.price - salePrice;
            return (
              <div
                key={proc.id}
                className="group relative rounded-[1.75rem] border border-white/8 bg-white/[0.025] p-6 transition hover:border-[#d8c58a]/20 hover:bg-white/[0.04]"
              >
                {proc.isNew && (
                  <div className="absolute right-5 top-5 rounded-full bg-[#d8c58a] px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-black">
                    NEW
                  </div>
                )}
                <span className="rounded-full border border-[#d8c58a]/20 bg-[#d8c58a]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d8c58a]">
                  {proc.category}
                </span>
                <h4 className="mt-3 text-lg font-black tracking-tight text-white">{proc.name}</h4>
                {proc.subtitle && <p className="mt-1 text-xs text-white/45">{proc.subtitle}</p>}

                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-sm text-white/35 line-through">{formatPeso(proc.price)}</span>
                  <span className="text-2xl font-black text-white">{formatPeso(salePrice)}</span>
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#d8c58a]/10 px-2.5 py-0.5">
                  <FaTag className="text-[8px] text-[#d8c58a]" />
                  <span className="text-[11px] font-bold text-[#d8c58a]">Save {formatPeso(savings)}</span>
                </div>

                {/* Book Now button */}
                <a
                  href={isDuring ? `/#booking?service=${encodeURIComponent(proc.serviceTitle)}&path=Procedure` : "#"}
                  data-booking-service={proc.serviceTitle}
                  data-booking-visit-path="Procedure"
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.14em] transition ${
                    isDuring
                      ? "cursor-pointer bg-white text-black shadow-lg hover:bg-[#d8c58a] hover:text-black hover:shadow-xl"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-white/25"
                  }`}
                  onClick={(e) => {
                    if (!isDuring) {
                      e.preventDefault();
                      return;
                    }
                    if (typeof window !== "undefined") {
                      (window as any).__preselectedBookingService = proc.serviceTitle;
                      (window as any).__preselectedBookingVisitPath = "Procedure";
                      window.dispatchEvent(
                        new CustomEvent("select-booking-service", {
                          detail: { service: proc.serviceTitle, visitPath: "Procedure" },
                        }),
                      );
                    }
                  }}
                >
                  <FaBolt className="text-xs" />
                  {isDuring ? "Book Now" : isBefore ? "Available Nov 11" : "Sale Ended"}
                </a>
              </div>
            );
          })}
        </div>

        {/* ── Bottom info ── */}
        <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center">
          <p className="text-xs leading-6 text-white/35">
            Purchase during Nov 11–14 buying period only · Procedures schedulable Mon–Fri, 9 AM – 3 PM until Nov 30, 2026 · 1-hour per slot · Payment via GCash / QR Ph
          </p>
        </div>
      </div>
    </section>
  );
}
