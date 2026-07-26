"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { FaCalendarAlt, FaHome, FaInfoCircle, FaQuestionCircle, FaQuoteRight, FaStethoscope, FaVideo } from "react-icons/fa";

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
      <aside className="fixed inset-y-0 right-0 z-[110] flex w-[min(18rem,82vw)] max-h-[100dvh] flex-col rounded-l-[1.5rem] border-l border-slate-100 bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Image src="/images/dockulotslogonobg.png" alt="logo" width={120} height={40} className="h-8 w-auto object-contain" />
          </Link>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-700 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
          <ul className="space-y-2">
            <li>
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-800 hover:bg-slate-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaHome /></span>
                Home
              </Link>
            </li>
            <li>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaStethoscope /></span>
                  Services
                </div>
                <div className="ml-12 mt-1 space-y-1 pb-1">
                  <Link href="/#clinic" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white">
                    Clinic
                  </Link>
                  <Link href="/#online" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white">
                    Online
                  </Link>
                </div>
              </div>
            </li>
            <li>
              <Link href="/#about" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-800 hover:bg-slate-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaInfoCircle /></span>
                About
              </Link>
            </li>
            <li>
              <Link href="/#blog" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-800 hover:bg-slate-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaQuoteRight /></span>
                Blogs
              </Link>
            </li>
            <li>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-900">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaVideo /></span>
                  Videos
                </div>
                <div className="ml-12 mt-1 space-y-1 pb-1">
                  <Link href="/#videos" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white">
                    Vlogs
                  </Link>
                  <Link href="/#live" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-white">
                    Live Schedule
                  </Link>
                </div>
              </div>
            </li>
            <li>
              <Link href="/#faq" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-slate-800 hover:bg-slate-50">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-50 text-amber-400"><FaQuestionCircle /></span>
                FAQ
              </Link>
            </li>
          </ul>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
            <Link
              href="/#booking"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-yellow-400 px-3 py-2.5 text-center text-sm font-bold leading-none text-white hover:bg-yellow-300"
            >
              <FaCalendarAlt />
              Book appointment
            </Link>
            <Link href="/#contact" onClick={() => setOpen(false)} className="block w-full rounded-xl border border-yellow-200 px-4 py-3 text-center font-semibold text-yellow-700 hover:bg-yellow-50">
              Contact
            </Link>

            <Link href="/login" onClick={() => setOpen(false)} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-800 hover:bg-slate-50">
              Sign In
            </Link>

            <Link href="/register" onClick={() => setOpen(false)} className="block w-full rounded-xl bg-yellow-400 px-4 py-3 text-center font-bold text-white hover:bg-yellow-300">
              Sign Up
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
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-900 bg-white/90 backdrop-blur-sm shadow-sm"
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
