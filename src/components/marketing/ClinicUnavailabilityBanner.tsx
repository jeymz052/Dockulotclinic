"use client";

import { useEffect, useState } from "react";

type ClinicClosure = {
  start: string;
  end: string;
  note: string | null;
  clinicOnly: boolean;
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const startMonth = monthNames[startDate.getUTCMonth()];
  const endMonth = monthNames[endDate.getUTCMonth()];
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();

  if (start === end) return `${startMonth} ${startDay}`;
  if (startMonth === endMonth) return `${startMonth} ${startDay}–${endDay}`;
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

/**
 * Dismissible announcement banner that shows whenever there are upcoming
 * clinic visit closures. It fetches from the public endpoint (no auth needed)
 * and uses sessionStorage to remember dismissals per closure range.
 */
export default function ClinicUnavailabilityBanner({ className = "" }: { className?: string } = {}) {
  const [closures, setClosures] = useState<ClinicClosure[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/announcements/clinic-closure", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { closures?: ClinicClosure[] };
        if (!active) return;
        const upcoming = (payload.closures ?? []).filter((c) => {
          // Only show if the closure ends today or later
          return c.end >= new Date().toISOString().slice(0, 10);
        });
        if (upcoming.length === 0) return;

        // Check per-closure dismissal in sessionStorage
        const dismissKey = `clinic-closure-dismissed:${upcoming.map((c) => `${c.start}-${c.end}`).join(",")}`;
        if (typeof window !== "undefined" && sessionStorage.getItem(dismissKey)) {
          return;
        }

        setClosures(upcoming);
      } catch {
        // fail silently — the banner is purely informational
      }
    })();
    return () => { active = false; };
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined" && closures.length > 0) {
      const dismissKey = `clinic-closure-dismissed:${closures.map((c) => `${c.start}-${c.end}`).join(",")}`;
      sessionStorage.setItem(dismissKey, "1");
    }
    setDismissed(true);
  }

  if (dismissed || closures.length === 0) return null;

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-5 py-4 shadow-sm"
    >
      {/* Decorative glow accent */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.15),transparent_60%)]" />

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg leading-none" aria-hidden="true">
          📢
        </span>

        <div className="flex-1 min-w-0">
          {closures.map((closure) => {
            const dateLabel = formatDateRange(closure.start, closure.end);
            return (
              <div key={`${closure.start}-${closure.end}`}>
                <p className="text-sm font-bold text-amber-900">
                  {closure.clinicOnly
                    ? `Clinic visits unavailable — ${dateLabel}`
                    : `Clinic closed — ${dateLabel}`}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-800">
                  {closure.clinicOnly ? (
                    <>
                      Doc Kulot's clinic visit slots are not available on{" "}
                      <strong>{dateLabel}</strong>.{" "}
                      <span className="font-semibold text-emerald-700">
                        Virtual consult is still open
                      </span>{" "}
                      — you can book a video call normally.
                    </>
                  ) : (
                    <>
                      The clinic will be closed on{" "}
                      <strong>{dateLabel}</strong>.{" "}
                      {closure.note ? closure.note + " " : ""}
                      Please check back for available dates.
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss clinic closure notice"
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-600 transition hover:bg-amber-100 hover:text-amber-900"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
    </div>
  );

  return className ? <div className={className}>{content}</div> : content;
}
