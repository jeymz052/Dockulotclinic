import Image from "next/image";
import Link from "next/link";

const ABOUT_ITEMS = [
  { label: "Specialty", value: "Family Medicine" },
  { label: "Experience", value: "8 Years of clinical practice" },
  { label: "Subspecialty", value: "PCOS Management and Weightloss Management" },
  { label: "Care Focus", value: "Primary care, prevention, and follow-up support" },
] as const;

const EDUCATION_ITEMS = [
  { label: "Med School", value: "Silliman University, 2017" },
  { label: "Residency", value: "Zamboanga City Medical Center, 2021" },
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-amber-50 px-4 py-12 text-black sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
            <div className="flex items-start justify-center bg-[linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)] px-8 py-10 lg:px-10 lg:py-12">
              <div className="overflow-hidden rounded-full border border-white bg-white shadow-lg">
                <Image
                  src="/images/dockulotslogonobg.png"
                  alt="Dr. Fatimah Al-Zahra Ditti"
                  width={280}
                  height={280}
                  className="h-[240px] w-[240px] object-contain sm:h-[280px] sm:w-[280px]"
                  priority
                />
              </div>
            </div>

            <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
              <p className="text-sm font-bold uppercase tracking-[0.38em] text-yellow-700">About the Doctor</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-black sm:text-5xl">
                Dr. Fatimah Al-Zahra Ditti
              </h1>
              <p className="mt-3 text-lg font-semibold text-slate-700">Medical Doctor</p>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
                Dr. Fatimah Al-Zahra Ditti is a family medicine physician focused on accessible, patient-centered
                care. She supports preventive care, ongoing follow-up, women's health, and practical management
                for everyday family health needs.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {ABOUT_ITEMS.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-yellow-100 bg-yellow-50/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-700">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/#booking"
                  className="inline-flex rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-white transition hover:bg-yellow-400"
                >
                  Book an appointment
                </Link>
                <Link
                  href="/#videos"
                  className="inline-flex rounded-full border border-yellow-200 bg-white px-6 py-3 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
                >
                  View videos and updates
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-slate-100 bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:px-8 lg:px-10">
          <p className="text-sm font-bold uppercase tracking-[0.38em] text-yellow-700">Education</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {EDUCATION_ITEMS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-5">
                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                <p className="mt-2 text-base leading-7 text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
