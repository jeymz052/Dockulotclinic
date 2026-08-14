import Link from "next/link";
import type { Metadata } from "next";
import { FaEnvelope, FaTiktok } from "react-icons/fa6";
import InquiryForm from "@/src/components/marketing/InquiryForm";
import { DOCKULOT_EMAIL, DOCKULOT_TIKTOK_URL } from "@/src/lib/public-links";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send an inquiry to the Doc Kulot team about appointments, clinic services, consultation concerns, collaborations, or general questions.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Contact / Inquiry</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Send an inquiry</h1>
          <p className="mt-4 leading-8 text-slate-600">
            Ask about appointments, services, consultations, vlog or content collaborations, or general questions. The
            Doc Kulot team can reply, close, and convert relevant inquiries into appointments.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              "Ask about appointment",
              "Ask about services",
              "Ask about consultation",
              "Ask about vlog/content collaboration",
              "Ask general questions",
            ].map((label) => (
              <span key={label} className="rounded-full border border-yellow-100 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                {label}
              </span>
            ))}
          </div>
          <Link href="/#booking" className="mt-8 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            Go to booking
          </Link>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${DOCKULOT_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-full border border-black bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-slate-50"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-700 text-white">
                <FaEnvelope className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {DOCKULOT_EMAIL}
            </a>
            <a
              href={DOCKULOT_TIKTOK_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-black bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-slate-50"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                <FaTiktok className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              Doc Kulot TikTok
            </a>
          </div>
        </section>
        <InquiryForm />
      </div>
    </main>
  );
}
