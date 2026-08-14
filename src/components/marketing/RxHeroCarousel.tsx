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
    <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden bg-black text-white">
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
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.76)_42%,rgba(255,255,255,0.14)_72%,rgba(255,255,255,0)_100%)] md:bg-[linear-gradient(90deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.84)_30%,rgba(255,255,255,0.22)_64%,rgba(255,255,255,0.02)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.22),transparent_30%)] md:bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.28),transparent_28%)]" />

        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-xl p-6 text-left sm:max-w-2xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-black/70 sm:text-sm">
              {eyebrow}
            </p>
            <h1 className="mt-5 whitespace-pre-line text-4xl font-black leading-[1.02] tracking-tight text-black sm:text-6xl lg:text-7xl">
              {formatRxTitle(activeSlide.title)}
            </h1>
            <p className="mt-5 max-w-md text-lg font-semibold leading-8 text-black/80 sm:max-w-xl sm:text-2xl sm:leading-9">
              {activeSlide.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/#booking"
                className="inline-flex items-center justify-center rounded-full bg-black px-7 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition hover:bg-neutral-800"
              >
                {ctaLabel}
              </Link>
            </div>

            <div className="mt-12 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-white/70 text-black backdrop-blur transition hover:bg-black hover:text-white"
                aria-label="Previous Rx program"
              >
                <FaChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-2">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${slide.title}`}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeIndex ? "w-9 bg-black" : "w-2.5 bg-black/20 hover:bg-black/45"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current + 1) % heroSlides.length)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-white/70 text-black backdrop-blur transition hover:bg-black hover:text-white"
                aria-label="Next Rx program"
              >
                <FaChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
