"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  FaArrowRight,
  FaChevronLeft,
  FaChevronRight,
  FaHeartPulse,
  FaLaptopMedical,
  FaStar,
  FaStethoscope,
  FaUserDoctor,
} from "react-icons/fa6";

type ProgramKey = "glowrx" | "hormonerx" | "heartrx" | "metabolicrx" | "preventrx";

type ProgramSlide = {
  key: ProgramKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  accent: string;
  featured?: boolean;
};

const GLOWRX_BEFORE_AFTER = [
  {
    before: encodeURI("/images/weightloss before1.png"),
    after: encodeURI("/images/weightloss after1.png"),
    label: "Transformation 01",
  },
  {
    before: encodeURI("/images/weightloss before2.png"),
    after: encodeURI("/images/weightloss after2.png"),
    label: "Transformation 02",
  },
  {
    before: encodeURI("/images/weightloss before3.png"),
    after: encodeURI("/images/weightloss after3.png"),
    label: "Transformation 03",
  },
] as const;

const PROGRAM_SLIDES: ProgramSlide[] = [
  {
    key: "glowrx",
    eyebrow: "✨ GlowRx by Doc Kulot",
    title: "Medical Weight Loss & Aesthetic Wellness",
    subtitle: "Personalized weight management with medical supervision, lifestyle support, and confidence-focused care.",
    description:
      "GlowRx by Doc Kulot is a comprehensive, evidence-based program that focuses on sustainable weight management while improving your overall health, confidence, and quality of life. Every plan is personalized and supervised throughout the journey. Glow beyond the scale. Because true beauty starts with better health.",
    icon: <FaHeartPulse className="h-5 w-5" />,
    accent: "from-white via-neutral-200 to-neutral-400",
    featured: true,
  },
  {
    key: "hormonerx",
    eyebrow: "🌸 HormoneRx by Doc Kulot",
    title: "PCOS, Hormonal Acne & Women’s Hormonal Health",
    subtitle: "Root-cause care for irregular periods, acne, insulin resistance, and hormone-related concerns.",
    description:
      "HormoneRx by Doc Kulot is a personalized, evidence-based program designed for women experiencing hormonal imbalances such as PCOS, hormonal acne, irregular periods, insulin resistance, and other hormone-related concerns. Our goal is to treat the root cause, not just the symptoms, through compassionate, holistic, and medically supervised care.",
    icon: <FaUserDoctor className="h-5 w-5" />,
    accent: "from-white via-neutral-200 to-neutral-300",
  },
  {
    key: "heartrx",
    eyebrow: "❤️ HeartRx by Doc Kulot",
    title: "Hypertension, Cholesterol & Cardiovascular Wellness",
    subtitle: "Long-term heart care to prevent, detect, and manage cardiovascular disease risk.",
    description:
      "HeartRx by Doc Kulot is to help prevent, detect, and manage cardiovascular diseases through personalized medical care, lifestyle medicine, and long-term follow-up. Whether you’re living with hypertension, high cholesterol, diabetes, or simply want to reduce your cardiovascular risk, HeartRx focuses on keeping your heart healthy for life.",
    icon: <FaStethoscope className="h-5 w-5" />,
    accent: "from-white via-neutral-200 to-neutral-300",
  },
  {
    key: "metabolicrx",
    eyebrow: "🍎 MetabolicRx by Doc Kulot",
    title: "Diabetes, Prediabetes & Fatty Liver Care",
    subtitle: "Lifestyle medicine and physician support for metabolic health, prevention, and reversal.",
    description:
      "MetabolicRx by Doc Kulot is designed to help individuals prevent, manage, and reverse metabolic diseases through personalized medical care, lifestyle medicine, and continuous physician support. Whether you have prediabetes, diabetes, fatty liver disease, obesity, or metabolic syndrome, our goal is to optimize your health and reduce your risk of long-term complications.",
    icon: <FaLaptopMedical className="h-5 w-5" />,
    accent: "from-white via-neutral-200 to-neutral-300",
  },
  {
    key: "preventrx",
    eyebrow: "🌿 PreventRx by Doc Kulot",
    title: "Executive Check-ups & Preventive Health",
    subtitle: "Screen early, lower future health risks, and keep wellness on track.",
    description:
      "PreventRx by Doc Kulot is a preventive care program focused on keeping you healthy before illness develops. Through regular health screenings, vaccinations, lifestyle medicine, and personalized risk assessments, we help you detect diseases early, reduce future health risks, and build a healthier future.",
    icon: <FaStar className="h-5 w-5" />,
    accent: "from-white via-neutral-200 to-neutral-300",
  },
];

export default function OfferHeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = PROGRAM_SLIDES[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % PROGRAM_SLIDES.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-black/10 bg-[linear-gradient(180deg,#0b0b0b_0%,#111111_55%,#0a0a0a_100%)] text-white shadow-[0_40px_100px_-60px_rgba(0,0,0,0.7)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(217,173,47,0.12),transparent_25%)]" />
      <div className="relative px-5 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-300">Offer Programs</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              Medical programs built around your goals
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
            <FaHeartPulse className="h-4 w-4 text-neutral-200" />
            Minimal black and white with a small gold accent
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-neutral-200 sm:text-base lg:text-lg">
              {slide.eyebrow}
            </div>
            <div className="space-y-4">
              <h2 className="max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                {slide.title}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
                {slide.subtitle}
              </p>
              <p className="max-w-2xl text-sm leading-7 text-neutral-400">
                {slide.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PROGRAM_SLIDES.map((program) => (
                <button
                  key={program.key}
                  type="button"
                  onClick={() => setActiveIndex(PROGRAM_SLIDES.findIndex((item) => item.key === program.key))}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                    program.key === slide.key
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/30 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {program.icon}
                  {program.key === slide.key ? "Active" : program.eyebrow.replace(/^[✨🌸❤️🍎🌿]\s*/, "")}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/booking"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-neutral-200"
              >
                Book Now!
                <FaArrowRight />
              </Link>
              <Link
                href="#offers"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm font-bold text-white transition hover:bg-white/5"
              >
                View offer details
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + PROGRAM_SLIDES.length) % PROGRAM_SLIDES.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Previous program"
              >
                <FaChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-2">
                {PROGRAM_SLIDES.map((program, index) => (
                  <button
                    key={program.key}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${program.title}`}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeIndex ? "w-8 bg-white" : "w-2.5 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current + 1) % PROGRAM_SLIDES.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Next program"
              >
                <FaChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-white/10 bg-white/5 p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.55)] backdrop-blur">
            {slide.key === "glowrx" ? (
              <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-300">GlowRx results</p>
                  <div className="mt-4 grid gap-3">
                    {GLOWRX_BEFORE_AFTER.map((pair) => (
                      <div key={pair.label} className="grid grid-cols-2 gap-2">
                        <figure className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/40">
                          <Image
                            src={pair.before}
                            alt={`${pair.label} before`}
                            width={480}
                            height={640}
                            className="h-40 w-full object-cover"
                            unoptimized
                          />
                          <figcaption className="border-t border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-300">
                            Before
                          </figcaption>
                        </figure>
                        <figure className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/40">
                          <Image
                            src={pair.after}
                            alt={`${pair.label} after`}
                            width={480}
                            height={640}
                            className="h-40 w-full object-cover"
                            unoptimized
                          />
                          <figcaption className="border-t border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-300">
                            After
                          </figcaption>
                        </figure>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)] p-4">
                  <Image
                    src="/images/glowrx.png"
                    alt="GlowRx program visual"
                    width={960}
                    height={960}
                    className="h-[18rem] w-full rounded-[1.5rem] object-cover"
                    unoptimized
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200">
                      Medical weight loss
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200">
                      Aesthetic wellness
                    </span>
                    <span className="rounded-full border border-white/10 bg-[rgba(217,173,47,0.15)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e7c766]">
                      Featured program
                    </span>
                  </div>
                </div>
              </div>
            ) : slide.key === "heartrx" ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/30 p-4">
                <Image
                  src="/images/heartrx.png"
                  alt="HeartRx program visual"
                  width={1400}
                  height={1200}
                  className="h-[28rem] w-full rounded-[1.5rem] object-cover"
                  unoptimized
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200">
                    Hypertension
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200">
                    Cholesterol
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200">
                    Cardiovascular wellness
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
                <div className={`rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)] p-5`}>
                  <div className={`flex h-full min-h-[18rem] flex-col justify-between rounded-[1.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-5`}>
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                      {slide.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-neutral-300 sm:text-base">{slide.eyebrow}</p>
                      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{slide.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-neutral-300">{slide.subtitle}</p>
                    </div>
                  </div>
                </div>
                <div className={`rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-5 text-black`}>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-black">Program focus</p>
                  <h4 className="mt-3 text-2xl font-black tracking-tight">{slide.title}</h4>
                  <p className="mt-4 text-sm leading-7 text-neutral-700">{slide.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                      Supervised care
                    </span>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
                      Personalized plan
                    </span>
                    <span className="rounded-full border border-black/10 bg-[rgba(217,173,47,0.12)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6516]">
                      Minimal gold accent
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
