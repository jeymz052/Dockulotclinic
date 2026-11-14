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

export default function OfferProgramsHero({
  slides = PROGRAM_SLIDES,
  featureImageUrl = "/images/SEF_0450.jpeg",
}: {
  slides?: ProgramSlide[];
  featureImageUrl?: string | null;
}) {
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
    <section className="relative w-full overflow-hidden bg-[#111111] pt-0 text-white">
      <div className="mx-auto min-h-0 lg:min-h-[calc(100svh-4rem)] w-full max-w-[1800px]">
        <div className="grid min-h-0 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <div className="relative min-h-[18rem] sm:min-h-[26rem] overflow-hidden bg-black lg:min-h-[calc(100svh-4rem)]">
            <Image
              src={featureImageUrl || "/images/SEF_0450.jpeg"}
              alt="Doc Kulot portrait"
              fill
              priority
              quality={100}
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
          </div>

          <div className="relative min-h-0 lg:min-h-[calc(100svh-4rem)] overflow-hidden bg-[#1f1f1f]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_26%),linear-gradient(180deg,#111111_0%,#050505_100%)]" />

            <div className="relative flex min-h-0 lg:min-h-[calc(100svh-4rem)] flex-col justify-start px-5 py-8 sm:px-10 sm:py-12 lg:px-16 lg:pb-16 lg:pt-10">
              <div
                className="text-2xl font-black uppercase leading-tight tracking-[0.14em] sm:text-4xl lg:text-[3.2rem]"
              >
                {renderProgramLabel(slide.name)}
              </div>

              <div className={`${isMetabolic ? "mt-3 sm:mt-4" : "mt-4 sm:mt-6"} max-w-3xl`}>
                <p className="max-w-2xl text-sm leading-7 text-white/88 sm:text-base sm:leading-8 lg:text-[1.15rem] lg:leading-9">
                  {slide.description}
                </p>
                <div className="mt-5">
                  <Link
                    href="/#booking"
                    className="inline-flex w-full sm:w-auto sm:min-w-[240px] items-center justify-center rounded-full bg-white px-7 py-3.5 text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-black transition hover:bg-neutral-200"
                  >
                    {slide.ctaLabel}
                  </Link>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2.5 sm:mt-8 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current - 1 + programSlides.length) % programSlides.length)}
                  className="inline-flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-white/45 bg-transparent text-white transition hover:bg-white hover:text-black"
                  aria-label="Previous offer"
                >
                  <FaChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex gap-2 sm:gap-3">
                  {programSlides.map((program, index) => (
                    <button
                      key={program.key}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      aria-label={`Show ${program.name}`}
                      className={`h-2.5 sm:h-3 rounded-full transition-all ${
                        index === activeIndex ? "w-8 sm:w-10 bg-white" : "w-2.5 sm:w-3 bg-white/30 hover:bg-white/55"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current + 1) % programSlides.length)}
                  className="inline-flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white hover:text-black"
                  aria-label="Next offer"
                >
                  <FaChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
