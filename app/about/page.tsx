import Image from "next/image";

const ABOUT_ITEMS = [
  { label: "Specialty", value: "Family Medicine and Aesthetic Medicine" },
  { label: "Medical School", value: "Silliman University Medical School, 2017" },
  { label: "Residency", value: "Zamboanga City Medical Center" },
  { label: "Pre-Med", value: "BS Nursing, Western Mindanao State University" },
] as const;

const EDUCATION_ITEMS = [
  { label: "Location 1", value: "FamMed Family Clinic, Arquiza Building, Pasobolong, Zamboanga City" },
  { label: "Location 2", value: "Premier Medical Center, Room 420, Tuesday / Thursday / Saturday" },
  { label: "Location 3", value: "RT Lim Family Hospital, Room 4, every 1st and 3rd Sunday" },
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-black">
      <section className="overflow-hidden bg-black">
        <div className="grid min-h-[520px] lg:min-h-[760px] lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="relative flex h-full flex-col justify-center px-6 py-12 text-white sm:px-8 sm:py-14 lg:px-10 lg:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/80 backdrop-blur">
              About the Doctor
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Dr. Fatimah Al-Zahra T. Ditti (Doc Kulot) | Injector Queen
            </h1>

            <p className="mt-4 max-w-xl text-lg font-semibold text-[#d8c58a]">Family Medicine | Aesthetic Medicine</p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 sm:text-lg sm:leading-9">
              Doc Kulot provides family medicine, telemedicine, women&apos;s health, lifestyle medicine, and
              aesthetic procedure care for patients who need practical and compassionate support.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {ABOUT_ITEMS.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d8c58a]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/84">{item.value}</p>
                </div>
              ))}
            </div>

          </div>

          <div className="relative min-h-[520px] lg:min-h-[760px]">
            <Image
              src="/images/SEF_0442.jpeg"
              alt="Dr. Fatimah Al-Zahra T. Ditti"
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </div>

        <section className="mx-auto max-w-6xl rounded-[2.5rem] border border-neutral-100 bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] sm:px-8 lg:px-10">
          <p className="text-sm font-bold uppercase tracking-[0.38em] text-gold-700">Education</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {EDUCATION_ITEMS.map((item) => (
              <div key={item.label} className="rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-5">
                <p className="text-sm font-bold text-neutral-900">{item.label}</p>
                <p className="mt-2 text-base leading-7 text-neutral-700">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
