"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

type ProgramKey = "glowrx" | "hormonerx" | "heartrx" | "metabolicrx" | "preventrx";

type ProgramSlide = {
  key: ProgramKey | string;
  name: string;
  description: string;
  ctaLabel: string;
};

const PROGRAM_SLIDES: ProgramSlide[] = [
  {
    key: "glowrx",
    name: "GlowRx by Doc Kulot",
    description:
      "GlowRx by Doc Kulot is a comprehensive, evidence-based program that focuses on sustainable weight management while improving your overall health, confidence, and quality of life. Every plan is personalized and supervised throughout the journey. Glow beyond the scale. Because true beauty starts with better health.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "hormonerx",
    name: "HormoneRx by Doc Kulot",
    description:
      "HormoneRx by Doc Kulot is a personalized, evidence-based program designed for women experiencing hormonal imbalances such as PCOS, hormonal acne, irregular periods, insulin resistance, and other hormone-related concerns. Our goal is to treat the root cause, not just the symptoms, through compassionate, holistic, and medically supervised care.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "heartrx",
    name: "HeartRx by Doc Kulot",
    description:
      "HeartRx by Doc Kulot is to help prevent, detect, and manage cardiovascular diseases through personalized medical care, lifestyle medicine, and long-term follow-up. Whether you're living with hypertension, high cholesterol, diabetes, or simply want to reduce your cardiovascular risk, HeartRx focuses on keeping your heart healthy for life.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "metabolicrx",
    name: "MetabolicRx by Doc Kulot",
    description:
      "MetabolicRx by Doc Kulot is designed to help individuals prevent, manage, and reverse metabolic diseases through personalized medical care, lifestyle medicine, and continuous physician support. Whether you have prediabetes, diabetes, fatty liver disease, obesity, or metabolic syndrome, our goal is to optimize your health and reduce your risk of long-term complications.",
    ctaLabel: "Book a consultation",
  },
  {
    key: "preventrx",
    name: "PreventRx by Doc Kulot",
    description:
      "PreventRx by Doc Kulot is a preventive care program focused on keeping you healthy before illness develops. Through regular health screenings, vaccinations, lifestyle medicine, and personalized risk assessments, we help you detect diseases early, reduce future health risks, and build a healthier future.",
    ctaLabel: "Book a consultation",
  },
];

function renderProgramLabel(name: string) {
  const match = name.match(/^(.*?)(Rx)( by Doc Kulot)$/);

  if (!match) {
    return name;
  }

  const [, prefix, rx, suffix] = match;

  return (
    <>
      <span className="block">
        <span className="text-white">{prefix}</span>
        <span className="text-[#d8c58a]">{rx}</span>
      </span>
      <span className="block text-white">{suffix}</span>
    </>
  );
}

export default function OfferProgramsHero({ slides = PROGRAM_SLIDES }: { slides?: ProgramSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const programSlides = slides.length ? slides : PROGRAM_SLIDES;
  const slide = programSlides[activeIndex] ?? programSlides[0];
  const isMetabolic = slide.key === "metabolicrx";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % programSlides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [programSlides.length]);

  return (
    <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#111111] pt-0 text-white">
      <div className="mx-auto min-h-[calc(100svh-4rem)] w-full max-w-[1800px]">
        <div className="grid min-h-[calc(100svh-4rem)] lg:h-[calc(100svh-4rem)] lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="relative min-h-[38rem] overflow-hidden bg-black lg:h-full lg:min-h-0">
            <Image
              src="/images/SEF_0450.jpeg"
              alt="Doc Kulot portrait"
              fill
              priority
              quality={100}
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>

          <div className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#1f1f1f] lg:h-full lg:min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_26%),linear-gradient(180deg,#111111_0%,#050505_100%)]" />

            <div className="relative flex h-full min-h-[calc(100svh-4rem)] flex-col justify-start px-8 pb-8 pt-10 sm:px-12 sm:pb-10 sm:pt-12 lg:px-16 lg:pb-10 lg:pt-10">
              <div
                className={`text-[1.8rem] font-black uppercase leading-none tracking-[0.18em] sm:text-[2.3rem] lg:text-[3.4rem] ${
                  isMetabolic
                    ? "min-h-[5.5rem] sm:min-h-[6.2rem] lg:min-h-[7.2rem]"
                    : "min-h-[6rem] sm:min-h-[6.8rem] lg:min-h-[8rem]"
                }`}
              >
                {renderProgramLabel(slide.name)}
              </div>

              <div className={`${isMetabolic ? "mt-4" : "mt-6"} max-w-3xl`}>
                <p className="max-w-2xl text-base leading-8 text-white/88 sm:text-[1.05rem] sm:leading-8 lg:text-[1.15rem] lg:leading-9">
                  {slide.description}
                </p>
                <div className="mt-5">
                  <Link
                    href="/#booking"
                    className="inline-flex min-w-[240px] items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-neutral-200"
                  >
                    {slide.ctaLabel}
                  </Link>
                </div>
              </div>

              <div className="mt-auto flex items-center gap-3 pt-6 lg:pt-4">
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current - 1 + PROGRAM_SLIDES.length) % PROGRAM_SLIDES.length)}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/45 bg-transparent text-white transition hover:bg-white hover:text-black"
                  aria-label="Previous offer"
                >
                  <FaChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex gap-3">
                  {programSlides.map((program, index) => (
                    <button
                      key={program.key}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      aria-label={`Show ${program.name}`}
                      className={`h-3 rounded-full transition-all ${
                        index === activeIndex ? "w-10 bg-white" : "w-3 bg-white/30 hover:bg-white/55"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current + 1) % PROGRAM_SLIDES.length)}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white hover:text-black"
                  aria-label="Next offer"
                >
                  <FaChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
