"use client";

import { useEffect, useState } from "react";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";

const BOOKING_HASH = "#booking";

function isBookingLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");

  if (!href) {
    return false;
  }

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/" && url.hash === BOOKING_HASH;
  } catch {
    return href === BOOKING_HASH || href === `/${BOOKING_HASH}`;
  }
}

export default function LandingBookingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openBooking = () => {
      setOpen(true);

      if (window.location.hash !== BOOKING_HASH) {
        window.history.pushState(null, "", BOOKING_HASH);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement) || !isBookingLink(anchor)) {
        return;
      }

      event.preventDefault();
      openBooking();
    };

    const handleHashChange = () => {
      setOpen(window.location.hash === BOOKING_HASH);
    };

    document.addEventListener("click", handleClick);
    window.addEventListener("hashchange", handleHashChange);

    if (window.location.hash === BOOKING_HASH) {
      queueMicrotask(() => setOpen(true));
    }

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeModal = () => {
    setOpen(false);

    if (window.location.hash === BOOKING_HASH) {
      window.history.replaceState(null, "", `${window.location.pathname || "/"}${window.location.search}`);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/72 px-3 py-4 backdrop-blur-sm sm:px-6">
      <button
        type="button"
        aria-label="Close booking form"
        className="absolute inset-0 cursor-default"
        onClick={closeModal}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-booking-title"
        className="booking-mono relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-black/10 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#a98c45]">Booking</p>
            <h2 id="landing-booking-title" className="mt-1 text-xl font-black tracking-tight text-black sm:text-2xl">
              Book an appointment
            </h2>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-2xl leading-none text-black transition hover:bg-black hover:text-white"
            aria-label="Close booking form"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto p-3 sm:p-5">
          <BookAppointmentPage />
        </div>
      </section>
    </div>
  );
}
