import Image from "next/image";
import Link from "next/link";
import {
  FaCalendarAlt,
  FaSignInAlt,
} from "react-icons/fa";
import MobileNav from "@/src/components/layout/MobileNav";
import PublicAnalyticsTracker from "@/src/components/marketing/PublicAnalyticsTracker";

export default function PublicHeader() {
  return (
    <>
      <PublicAnalyticsTracker />
      <header className="relative md:fixed md:inset-x-0 md:top-0 md:z-50 border-b border-neutral-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
          <Link href="/" className="flex h-full items-center gap-3">
            <Image
              src="/images/dockulotslogonobg.png"
              alt="Doc Kulot logo"
            width={220}
            height={88}
            className="h-12 w-auto max-h-full object-contain sm:h-14 sm:w-auto lg:h-[4.5rem]"
          />
          </Link>
        <nav className="hidden items-center gap-5 lg:flex">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-black transition hover:text-neutral-700">
            Home
          </Link>
          <Link href="/#programs" className="inline-flex items-center gap-2 text-sm font-semibold text-black transition hover:text-neutral-700">
            Programs
          </Link>
          <Link href="/#about" className="inline-flex items-center gap-2 text-sm font-semibold text-black transition hover:text-neutral-700">
            About
          </Link>
          <Link href="/#results" className="inline-flex items-center gap-2 text-sm font-semibold text-black transition hover:text-neutral-700">
            Results
          </Link>

          <div className="group relative h-full">
            <button
              type="button"
              className="inline-flex h-16 items-center gap-2 text-sm font-semibold text-black transition hover:text-neutral-700"
            >
              More
            </button>
            <div className="invisible absolute right-0 top-full w-52 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                <Link href="/#clinic" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  Services
                </Link>
                <Link href="/#blog" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  Blog
                </Link>
                <Link href="/#videos" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  Vlogs
                </Link>
                <Link href="/#live" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  Live Schedule
                </Link>
                <Link href="/#faq" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  FAQ
                </Link>
                <Link href="/#contact" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-black hover:bg-neutral-50">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNav />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-black bg-white px-3 py-2 text-[11px] font-bold text-black transition hover:bg-black hover:text-white sm:hidden"
          >
            <FaSignInAlt className="shrink-0 text-current" />
            <span className="whitespace-nowrap">Sign in</span>
          </Link>
          <Link
            href="/#booking"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-black px-3 py-2 text-xs font-bold text-white transition hover:bg-neutral-900 sm:px-4 sm:py-2 sm:text-sm"
          >
            <FaCalendarAlt className="shrink-0 text-neutral-300" />
            <span className="whitespace-nowrap sm:hidden">Book</span>
            <span className="hidden whitespace-nowrap sm:inline">Book appointment</span>
          </Link>
          <Link href="/login" className="hidden items-center gap-2 rounded-full border border-black bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-black hover:text-white sm:inline-flex sm:px-4 sm:py-2 sm:text-sm">
            <FaSignInAlt className="shrink-0 text-current" />
            Sign In
          </Link>
        </div>
        </div>
      </header>
    </>
  );
}
