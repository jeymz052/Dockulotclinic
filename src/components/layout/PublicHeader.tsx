import Image from "next/image";
import Link from "next/link";
import {
  FaHome,
  FaCalendarAlt,
  FaInfoCircle,
  FaMicrophone,
  FaPhone,
  FaQuestionCircle,
  FaQuoteRight,
  FaSignInAlt,
  FaStethoscope,
  FaUserPlus,
  FaVideo,
} from "react-icons/fa";
import MobileNav from "@/src/components/layout/MobileNav";
import PublicAnalyticsTracker from "@/src/components/marketing/PublicAnalyticsTracker";

export default function PublicHeader() {
  return (
    <>
      <PublicAnalyticsTracker />
      <header className="relative md:fixed md:inset-x-0 md:top-0 md:z-50 border-b border-yellow-200/50 bg-yellow-50/55 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
          <Link href="/" className="flex h-full items-center gap-3">
            <Image
              src="/images/dockulotslogonobg.png"
            alt="Clinic logo"
            width={220}
            height={88}
            className="h-12 w-auto max-h-full object-contain sm:h-14 sm:w-auto lg:h-[4.5rem]"
          />
        </Link>
        <nav className="hidden items-center gap-4 lg:flex">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700">
            <FaHome className="text-amber-400" />
            Home
          </Link>
          <Link href="/#about" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700">
            <FaInfoCircle className="text-amber-400" />
            About
          </Link>

          <div className="group relative h-full">
            <button
              type="button"
              className="inline-flex h-16 items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700"
            >
              <FaStethoscope className="text-amber-400" />
              Services
            </button>
            <div className="invisible absolute right-0 top-full w-48 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="rounded-lg border border-yellow-100 bg-white p-2 shadow-lg">
                <Link href="/#clinic" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-800 hover:bg-yellow-50">
                  <FaStethoscope className="text-amber-400" />
                  Clinic
                </Link>
                <Link href="/#online" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-800 hover:bg-yellow-50">
                  <FaPhone className="text-amber-400" />
                  Online
                </Link>
              </div>
            </div>
          </div>

          <Link href="/#blog" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700">
            <FaQuoteRight className="text-amber-400" />
            Blog
          </Link>

          <div className="group relative h-full">
            <button
              type="button"
              className="inline-flex h-16 items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700"
            >
              <FaVideo className="text-amber-400" />
              Videos
            </button>
            <div className="invisible absolute right-0 top-full w-52 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="rounded-lg border border-yellow-100 bg-white p-2 shadow-lg">
                <Link href="/#videos" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-800 hover:bg-yellow-50">
                  <FaVideo className="text-amber-400" />
                  Vlogs
                </Link>
                <Link href="/#live" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-800 hover:bg-yellow-50">
                  <FaMicrophone className="text-amber-400" />
                  Live Schedule
                </Link>
              </div>
            </div>
          </div>

          <Link href="/#faq" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-yellow-700">
            <FaQuestionCircle className="text-amber-400" />
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <MobileNav />
          <Link
            href="/#booking"
            className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300 bg-yellow-400 px-3 py-2 text-xs font-bold text-white transition hover:bg-yellow-300 sm:px-4 sm:py-2 sm:text-sm"
          >
            <FaCalendarAlt className="shrink-0" />
            <span className="whitespace-nowrap sm:hidden">Book</span>
            <span className="hidden whitespace-nowrap sm:inline">Book appointment</span>
          </Link>
          <Link
            href="/#contact"
            className="inline-flex items-center gap-2 rounded-full border border-yellow-300 bg-white/70 px-4 py-2 text-sm font-semibold text-yellow-700 hover:bg-white"
          >
            <FaPhone className="text-amber-400" />
            Contact
          </Link>
          <Link href="/login" className="hidden items-center gap-2 text-sm font-semibold text-slate-900 hover:text-yellow-700 sm:inline-flex">
            <FaSignInAlt className="text-amber-400" />
            Sign In
          </Link>
          <Link
            href="/register"
            className="ml-2 hidden items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-yellow-300 sm:inline-flex"
          >
            <FaUserPlus />
            Sign Up
          </Link>
        </div>
        </div>
      </header>
    </>
  );
}
