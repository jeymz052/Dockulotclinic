"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaDiamondTurnRight,
  FaLocationDot,
  FaMapLocationDot,
  FaMinus,
  FaPlus,
  FaArrowUpRightFromSquare,
} from "react-icons/fa6";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://maps.app.goo.gl/JjXcnX77MH68JdT89";
const GOOGLE_MAPS_EMBED_URL =
  "https://maps.google.com/maps?q=Family+First+Primary+Care+Outpatient+Clinic,+Zamboanga+City&hl=en&z=17&output=embed";

export default function FloatingLocationSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isSectionInView, setIsSectionInView] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      // Show floating location card as soon as the user starts scrolling down (> 60px)
      if (window.scrollY > 60) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only consider the section in view if it is prominently visible
        setIsSectionInView(entry.isIntersecting && entry.intersectionRatio >= 0.3);
      },
      { threshold: [0, 0.15, 0.3, 0.5, 0.8] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToLocation = () => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // The floating location card stays pinned on screen when scrolling,
  // and smoothly hides only when the user is looking directly at the large in-page section.
  const showFloatingLocation = mounted && hasScrolled && !isSectionInView;

  return (
    <>
      {/* ── Main Highlighted In-Page Section: "Where Are We Located" ── */}
      <section
        id="location"
        ref={sectionRef}
        aria-label="Where Are We Located"
        className="scroll-mt-24 mt-12 overflow-hidden rounded-3xl border-2 border-[#d8c58a] bg-gradient-to-b from-[#fdfbf7] via-white to-[#fbf8f1] shadow-[0_24px_70px_-20px_rgba(216,197,138,0.45)] ring-4 ring-[#d8c58a]/20 transition-all duration-300"
      >
        {/* Highlighted Banner / Header */}
        <div className="flex flex-col gap-4 border-b border-[#d8c58a]/30 bg-gradient-to-r from-[#fbf8f1] via-[#fffbf2] to-[#f8f3e5] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c58a]/40 bg-[#d8c58a]/15 px-3.5 py-1 text-xs font-black uppercase tracking-[0.24em] text-[#9a7e32]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d8c58a] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#a98c45]" />
              </span>
              Where Are We Located
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
              Family First Primary Care Outpatient Clinic
            </h3>
            <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <FaLocationDot className="text-[#a98c45] shrink-0" />
              Zamboanga City, Zamboanga del Sur, Philippines
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={GOOGLE_MAPS_DIRECTIONS_URL}
              target="_blank"
              rel="noreferrer"
              id="homepage-get-directions-link"
              className="inline-flex items-center gap-2 self-start rounded-full bg-black px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#a98c45] hover:shadow-xl sm:self-auto"
            >
              <FaDiamondTurnRight className="text-xs text-[#d8c58a]" />
              Get Directions →
            </a>
          </div>
        </div>

        {/* Embedded Interactive Map */}
        <div className="relative h-80 w-full sm:h-[460px]">
          <iframe
            id="homepage-clinic-location-map"
            title="Family First Primary Care Outpatient Clinic location on Google Maps"
            src={GOOGLE_MAPS_EMBED_URL}
            width="100%"
            height="100%"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full border-0"
            aria-label="Google Maps showing the location of Family First Primary Care Outpatient Clinic"
          />
        </div>
      </section>

      {/* ── Persistent Floating Location Section: Portaled to document.body ──
          Mounts directly to document.body to prevent parent CSS transform/overflow
          from breaking viewport-fixed positioning.
      */}
      {showFloatingLocation &&
        createPortal(
          <aside
            aria-label="Floating clinic location card"
            className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 z-[9999] w-auto sm:w-[360px] md:w-[400px] transition-all duration-300 drop-shadow-2xl"
          >
            <div className="overflow-hidden rounded-2xl border-2 border-[#d8c58a] bg-white text-slate-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] ring-4 ring-[#d8c58a]/30">
              {/* Header: Highlighted Golden Location Bar */}
              <div className="flex items-center justify-between border-b border-[#d8c58a]/30 bg-gradient-to-r from-[#fcf9f2] via-[#fffbf3] to-[#f8f3e5] px-4 py-3">
                <button
                  type="button"
                  onClick={scrollToLocation}
                  className="group flex items-center gap-2 text-left"
                  title="Click to jump to location section on the page"
                >
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d8c58a] opacity-80" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-[#a98c45]" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-[#9a7e32] group-hover:underline">
                    Where Are We Located
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsMinimized((prev) => !prev)}
                    className="rounded-lg p-1.5 text-slate-600 transition hover:bg-[#d8c58a]/20 hover:text-black"
                    aria-label={isMinimized ? "Expand location map" : "Minimize location map"}
                    title={isMinimized ? "Expand map" : "Minimize map"}
                  >
                    {isMinimized ? <FaPlus className="h-3 w-3" /> : <FaMinus className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Minimized View: Compact Floating Pill Bar */}
              {isMinimized ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-black">
                      Family First Primary Care Clinic
                    </p>
                    <p className="truncate text-[11px] text-slate-500">Zamboanga City</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsMinimized(false)}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-slate-200"
                    >
                      Open Map
                    </button>
                    <a
                      href={GOOGLE_MAPS_DIRECTIONS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#a98c45]"
                    >
                      <FaDiamondTurnRight className="text-[9px] text-[#d8c58a]" />
                      Directions
                    </a>
                  </div>
                </div>
              ) : (
                /* Expanded View: Full Floating Card With Map */
                <div className="bg-white">
                  {/* Clinic Info */}
                  <div className="px-4 pt-3 pb-2.5">
                    <p className="text-sm font-black text-black leading-tight">
                      Family First Primary Care Outpatient Clinic
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-600 flex items-center gap-1">
                      <FaLocationDot className="text-[#a98c45] shrink-0 text-[11px]" />
                      Zamboanga City, Zamboanga del Sur
                    </p>
                  </div>

                  {/* The Embedded Interactive Map in the Floating Card */}
                  <div className="relative h-44 sm:h-48 w-full border-y border-slate-200 bg-slate-100">
                    <iframe
                      title="Floating Google Maps preview of clinic"
                      src={GOOGLE_MAPS_EMBED_URL}
                      width="100%"
                      height="100%"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-full w-full border-0"
                    />
                  </div>

                  {/* Footer Controls: Jump to page section & Get Directions */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50/80">
                    <button
                      type="button"
                      onClick={scrollToLocation}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 transition hover:text-black"
                    >
                      <FaMapLocationDot className="text-xs text-[#a98c45]" />
                      View on page
                    </button>

                    <a
                      href={GOOGLE_MAPS_DIRECTIONS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1.5 text-xs font-bold text-white shadow transition hover:bg-[#a98c45]"
                    >
                      <FaDiamondTurnRight className="text-[10px] text-[#d8c58a]" />
                      Get Directions
                      <FaArrowUpRightFromSquare className="text-[9px] text-[#d8c58a]" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </aside>,
          document.body
        )}
    </>
  );
}
