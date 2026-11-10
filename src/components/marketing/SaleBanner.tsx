"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FaFire, FaXmark, FaBolt } from "react-icons/fa6";

const SALE_START = new Date("2026-11-11T00:00:00+08:00").getTime();
const SALE_END = new Date("2026-11-14T23:59:59+08:00").getTime();
const DISMISS_KEY = "dockulot-1111-sale-dismissed";
const REAPPEAR_MS = 60 * 60 * 1000; // 1 hour

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

export default function SaleBanner() {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [now, setNow] = useState(Date.now());

  const checkVisibility = useCallback(() => {
    const current = Date.now();
    const showStart = SALE_START - 24 * 60 * 60 * 1000;
    if (current < showStart || current > SALE_END) return false;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (current - dismissedAt < REAPPEAR_MS) return false;
    }
    return true;
  }, []);

  useEffect(() => {
    if (checkVisibility()) {
      const timeout = setTimeout(() => {
        setVisible(true);
        requestAnimationFrame(() => setAnimateIn(true));
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [checkVisibility]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const handleDismiss = () => {
    setAnimateIn(false);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }, 300);
  };

  if (!visible) return null;

  const isBefore = now < SALE_START;
  const isDuring = now >= SALE_START && now <= SALE_END;
  const target = isBefore ? SALE_START : SALE_END;
  const time = getTimeRemaining(target);

  return (
    <>
      <div
        className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
        onClick={handleDismiss}
      />
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-500 ${animateIn ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
      >
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d8c58a]/20 bg-gradient-to-b from-[#111] via-[#0a0a0a] to-[#050505] shadow-[0_0_80px_rgba(216,197,138,0.08)]">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <FaXmark className="h-4 w-4" />
          </button>

          <div className="absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#d8c58a]/10 blur-[80px]" />

          <div className="relative px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10">
            <div className="mb-3 flex items-center justify-center gap-2">
              <FaFire className="animate-pulse text-xl text-[#d8c58a]" />
              <FaFire className="animate-pulse text-2xl text-[#d8c58a]" />
              <FaFire className="animate-pulse text-xl text-[#d8c58a]" />
            </div>

            <h2 className="text-6xl font-black tracking-tighter sm:text-7xl">
              <span className="text-white">11</span>
              <span className="text-[#d8c58a]">.</span>
              <span className="text-white">11</span>
            </h2>

            <p className="mt-2 text-base font-black uppercase tracking-[0.18em] text-white">
              Doc Kulot Sale
            </p>

            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl border border-[#d8c58a]/25 bg-[#d8c58a]/10 px-5 py-2.5">
              <FaBolt className="text-lg text-[#d8c58a]" />
              <span className="text-2xl font-black text-[#d8c58a]">11% OFF</span>
            </div>

            <p className="mt-2 text-sm font-bold text-white/50">All Medical Procedures</p>

            {/* Countdown */}
            {time.total > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#d8c58a]/50">
                  {isBefore ? "Sale starts in" : "Ends in"}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[
                    { v: time.days, u: "d" },
                    { v: time.hours, u: "h" },
                    { v: time.minutes, u: "m" },
                    { v: time.seconds, u: "s" },
                  ].map((b) => (
                    <div key={b.u} className="flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-[#d8c58a]/15 bg-[#d8c58a]/5">
                      <span className="text-lg font-black text-white">{String(b.v).padStart(2, "0")}</span>
                      <span className="text-[7px] font-bold uppercase text-[#d8c58a]/50">{b.u}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-[11px] text-white/30">
              Buy Nov 11–14 · Schedule Mon–Fri until Nov 30
            </p>

            <Link
              href="/#sale"
              onClick={handleDismiss}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.15em] text-black transition hover:bg-[#d8c58a]"
            >
              <FaFire />
              {isDuring ? "Book Now" : "View Sale"}
            </Link>

            <button onClick={handleDismiss} className="mt-3 text-xs text-white/25 transition hover:text-white/40">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
