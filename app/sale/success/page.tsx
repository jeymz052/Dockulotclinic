import Link from "next/link";
import type { Metadata } from "next";
import { FaCheck, FaCalendarCheck, FaArrowRight } from "react-icons/fa6";

export const metadata: Metadata = {
  title: "Payment Successful — 11.11 Sale",
  description: "Your 11.11 sale procedure has been reserved!",
};

export default async function SaleSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ procedure?: string }>;
}) {
  const params = await searchParams;
  const procedure = params.procedure || "your procedure";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060606] px-4 py-20">
      <div className="w-full max-w-lg text-center">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10">
          <FaCheck className="text-3xl text-green-400" />
        </div>

        <h1 className="text-3xl font-black text-white sm:text-4xl">
          Payment Successful! 🎉
        </h1>

        <p className="mt-4 text-lg font-semibold text-[#d8c58a]">
          11.11 Sale — 11% OFF
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-center gap-2 text-white/60">
            <FaCalendarCheck className="text-[#d8c58a]" />
            <span className="text-sm font-bold">Procedure Reserved</span>
          </div>
          <p className="mt-3 text-lg font-black text-white">
            {decodeURIComponent(procedure)}
          </p>
          <p className="mt-4 text-sm leading-6 text-white/50">
            Your procedure slot has been reserved at the sale price.
            You&apos;ll receive a confirmation email with your schedule details.
            The clinic team will reach out if there are any updates.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.15em] text-black transition hover:bg-neutral-100"
          >
            Back to Doc Kulot
            <FaArrowRight className="text-xs" />
          </Link>
          <Link
            href="/sale"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Buy more procedures
          </Link>
        </div>

        <p className="mt-8 text-xs text-white/30">
          For questions about your booking, message Doc Kulot or contact the clinic.
        </p>
      </div>
    </main>
  );
}
