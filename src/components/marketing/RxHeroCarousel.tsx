"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import type { LandingHeroSlide } from "@/src/lib/db/types";
import { DEFAULT_RX_HERO_SLIDES } from "@/src/lib/landing-defaults";

function formatRxTitle(title: string) {
  return title.replace(" by Doc Kulot", "\nby Doc Kulot");
}

export default function RxHeroCarousel({
  slides = DEFAULT_RX_HERO_SLIDES,
  eyebrow = "Doc Kulot Rx Programs",
  ctaLabel = "Book appointment",
}: {
  slides?: LandingHeroSlide[];
  eyebrow?: string;
  ctaLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const heroSlides = (slides.length ? slides : DEFAULT_RX_HERO_SLIDES).map((slide, index) => ({
    ...slide,
    image: slide.image || DEFAULT_RX_HERO_SLIDES[index]?.image || DEFAULT_RX_HERO_SLIDES[0].image,
    title: slide.title || DEFAULT_RX_HERO_SLIDES[index]?.title || "Doc Kulot",
    subtitle: slide.subtitle || DEFAULT_RX_HERO_SLIDES[index]?.subtitle || "",
  }));
  const activeSlide = heroSlides[activeIndex] ?? heroSlides[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  return (
    <section className="relative w-full overflow-hidden bg-black text-white">
      <div className="relative min-h-[calc(100svh-4rem)]">
        {heroSlides.map((slide, index) => (
          <Image
            key={slide.key}
            src={slide.image}
            alt={`${slide.title} background`}
            fill
            priority={index === 0}
            quality={100}
            unoptimized
            sizes="100vw"
            className={`object-cover object-[78%_center] transition-opacity duration-700 md:object-center ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.82)_42%,rgba(255,255,255,0.2)_75%,rgba(255,255,255,0.02)_100%)] md:bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.84)_30%,rgba(255,255,255,0.22)_64%,rgba(255,255,255,0.02)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.22),transparent_30%)] md:bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.28),transparent_28%)]" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-xl p-4 text-left sm:max-w-2xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-black/70 sm:text-sm">
              {eyebrow}
            </p>
            <h1 className="mt-4 whitespace-pre-line break-words text-3xl font-black leading-[1.08] tracking-tight text-black sm:mt-5 sm:text-5xl md:text-6xl lg:text-7xl">
              {formatRxTitle(activeSlide.title)}
            </h1>
            <p className="mt-4 max-w-md text-base font-semibold leading-7 text-black/80 sm:mt-5 sm:max-w-xl sm:text-xl sm:leading-8 lg:text-2xl lg:leading-9">
              {activeSlide.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8 sm:gap-4">
              <Link
                href="/#booking"
                className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition hover:bg-neutral-800 sm:px-7 sm:py-3.5 sm:text-sm"
              >
                {ctaLabel}
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-2.5 sm:mt-12 sm:gap-3">
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white/70 text-black backdrop-blur transition hover:bg-black hover:text-white sm:h-12 sm:w-12"
                aria-label="Previous Rx program"
              >
                <FaChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <div className="flex gap-1.5 sm:gap-2">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${slide.title}`}
                    className={`h-2 sm:h-2.5 rounded-full transition-all ${
                      index === activeIndex ? "w-7 sm:w-9 bg-black" : "w-2 sm:w-2.5 bg-black/20 hover:bg-black/45"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current + 1) % heroSlides.length)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white/70 text-black backdrop-blur transition hover:bg-black hover:text-white sm:h-12 sm:w-12"
                aria-label="Next Rx program"
              >
                <FaChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
