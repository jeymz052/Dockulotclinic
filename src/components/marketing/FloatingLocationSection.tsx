"use client";

import { useEffect, useRef, useState } from "react";
import { FaDiamondTurnRight, FaLocationDot, FaMapLocationDot, FaXmark } from "react-icons/fa6";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://maps.app.goo.gl/JjXcnX77MH68JdT89";
const GOOGLE_MAPS_EMBED_URL =
  "https://maps.google.com/maps?q=Family+First+Primary+Care+Outpatient+Clinic,+Zamboanga+City&hl=en&z=17&output=embed";

export default function FloatingLocationSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isSectionInView, setIsSectionInView] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 280) {
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
        setIsSectionInView(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToLocation = () => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const showFloatingWidget = hasScrolled && !isSectionInView && !isDismissed;

  return (
    <>
      {/* ── Main Highlighted Location Section ── */}
      <div
        id="location"
        ref={sectionRef}
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
      </div>

      {/* ── Highlighted Floating Location Widget (Active When Scrolling) ── */}
      {showFloatingWidget && (
        <aside
          aria-label="Floating clinic location notification"
          className="fixed bottom-4 left-3 right-3 sm:right-auto sm:left-6 z-40 max-w-sm sm:max-w-md animate-fade-in-up"
        >
          <div className="overflow-hidden rounded-2xl border-2 border-[#d8c58a] bg-black/92 p-4 text-white shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-md ring-4 ring-[#d8c58a]/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d8c58a] opacity-80" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#d8c58a]" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d8c58a]">
                  Where Are We Located
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss floating location"
              >
                <FaXmark className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5">
              <p className="text-sm font-black text-white leading-tight">
                Family First Primary Care Outpatient Clinic
              </p>
              <p className="mt-1 text-xs text-white/70 flex items-center gap-1.5">
                <FaLocationDot className="text-[#d8c58a] shrink-0" />
                Zamboanga City, Zamboanga del Sur
              </p>
            </div>

            {/* Expandable mini map preview inside floating bar */}
            {isExpanded && (
              <div className="mt-3 h-48 w-full overflow-hidden rounded-xl border border-white/15">
                <iframe
                  title="Mini floating map preview"
                  src={GOOGLE_MAPS_EMBED_URL}
                  width="100%"
                  height="100%"
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              </div>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={scrollToLocation}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
              >
                <FaMapLocationDot className="text-xs text-[#d8c58a]" />
                View on page
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                {isExpanded ? "Hide map" : "Quick preview"}
              </button>
              <a
                href={GOOGLE_MAPS_DIRECTIONS_URL}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#d8c58a] px-3.5 py-1.5 text-xs font-black text-black transition hover:bg-white"
              >
                <FaDiamondTurnRight className="text-[10px]" />
                Directions →
              </a>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

