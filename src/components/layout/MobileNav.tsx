"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { FaCalendarAlt, FaHome, FaInfoCircle, FaQuoteRight, FaStethoscope } from "react-icons/fa";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const mobileMenu = open ? (
    <>
      <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <aside className="fixed inset-y-0 right-0 z-[110] flex w-[min(18rem,82vw)] max-h-[100dvh] flex-col rounded-l-[1.5rem] border-l border-neutral-100 bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Image src="/images/dockulotslogonobg.png" alt="logo" width={120} height={40} className="h-8 w-auto object-contain" />
          </Link>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
          <ul className="space-y-2">
            <li>
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-800 hover:bg-neutral-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black"><FaHome /></span>
                Home
              </Link>
            </li>
            <li>
              <Link href="/#programs" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-800 hover:bg-neutral-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black"><FaStethoscope /></span>
                Programs
              </Link>
            </li>
            <li>
              <Link href="/#about" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-800 hover:bg-neutral-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black"><FaInfoCircle /></span>
                About
              </Link>
            </li>
            <li>
              <Link href="/#results" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-neutral-800 hover:bg-neutral-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black"><FaQuoteRight /></span>
                Results
              </Link>
            </li>
            <li>
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-2">
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-neutral-900">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-black"><FaStethoscope /></span>
                  More
                </div>
                <div className="ml-12 mt-1 space-y-1 pb-1">
                  <Link href="/#clinic" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    Services
                  </Link>
                  <Link href="/#blog" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    Blog
                  </Link>
                  <Link href="/#videos" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    Vlogs
                  </Link>
                  <Link href="/#live" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    Live Schedule
                  </Link>
                  <Link href="/#faq" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    FAQ
                  </Link>
                  <Link href="/#contact" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-white">
                    Contact
                  </Link>
                </div>
              </div>
            </li>
          </ul>

          <div className="mt-6 space-y-3 border-t border-neutral-100 pt-4">
            <Link
              href="/#booking"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-black px-3 py-2.5 text-center text-sm font-bold leading-none text-white hover:bg-neutral-800"
            >
              <FaCalendarAlt />
              Book appointment
            </Link>
            <Link href="/#contact" onClick={() => setOpen(false)} className="block w-full rounded-xl border border-black/10 px-4 py-3 text-center font-semibold text-black hover:bg-black/5">
              Contact
            </Link>

            <Link href="/login" onClick={() => setOpen(false)} className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center font-semibold text-neutral-800 hover:bg-neutral-50">
              Sign In
            </Link>
          </div>
        </nav>
      </aside>
    </>
  ) : null;

  return (
    <div className="lg:hidden">
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center justify-center rounded-md p-2 text-neutral-900 bg-white/90 backdrop-blur-sm shadow-sm"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {open ? (
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>

      {open ? createPortal(mobileMenu, document.body) : null}
    </div>
  );
}
