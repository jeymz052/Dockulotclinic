import Link from "next/link";
import type { Metadata } from "next";
import { onlineConsultationSteps } from "@/src/lib/healthcare-content";

export const metadata: Metadata = {
  title: "Online Consultation",
  description:
    "Learn how Doc Kulot telemedicine works for online consultation, uploads, payment, meeting links, diagnosis, prescriptions, and follow-up care.",
  alternates: {
    canonical: "/online-services",
  },
};

export default function OnlineServicesPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Online Services</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Online consultation workflow</h1>
        <p className="mt-4 leading-8 text-slate-600">
          Patients can book telemedicine care, upload concerns or files, pay the 800 peso fee for the first consult plus one follow-up, receive a meeting link,
          and later access released diagnosis and prescription records through the patient portal.
        </p>
        <div className="mt-10 grid gap-4">
          {onlineConsultationSteps.map((step, index) => (
            <div key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="pt-2 text-sm font-semibold text-slate-800">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-3xl border border-yellow-100 bg-yellow-50/70 p-6 text-sm leading-7 text-yellow-900">
          Telemedicine services cover weight loss management, PCOS management, chronic disease review, lab results
          interpretation, and prescription refill support.
        </div>
        <Link href="/#booking" className="mt-10 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
          Book online consultation
        </Link>
      </div>
    </main>
  );
}
