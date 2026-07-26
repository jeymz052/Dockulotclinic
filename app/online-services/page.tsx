import Link from "next/link";
import { onlineConsultationSteps } from "@/src/lib/healthcare-content";

export default function OnlineServicesPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Online Services</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Online consultation workflow</h1>
        <p className="mt-4 leading-8 text-slate-600">
          Patients can book virtual care, upload concerns or files, receive a meeting link, and later access released
          diagnosis and prescription records through the patient portal.
        </p>
        <div className="mt-10 grid gap-4">
          {onlineConsultationSteps.map((step, index) => (
            <div key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="pt-2 text-sm font-semibold text-slate-800">{step}</p>
            </div>
          ))}
        </div>
        <Link href="/#booking" className="mt-10 inline-flex rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-white">
          Book online consultation
        </Link>
      </div>
    </main>
  );
}
