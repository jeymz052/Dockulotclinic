import Image from "next/image";
import Link from "next/link";
import {
  FaArrowRight,
  FaFacebookF,
  FaStar,
  FaYoutube,
} from "react-icons/fa6";
import InlineArticleBrowser from "@/src/components/blog/InlineArticleBrowser";
import PublicHeader from "@/src/components/layout/PublicHeader";
import InquiryForm from "@/src/components/marketing/InquiryForm";
import HomeServicesShowcase from "@/src/components/marketing/HomeServicesShowcase";
import LandingBookingModal from "@/src/components/marketing/LandingBookingModal";
import OfferProgramsHero from "@/src/components/marketing/OfferProgramsHero";
import RxHeroCarousel from "@/src/components/marketing/RxHeroCarousel";
import ScrollReveal from "@/src/components/marketing/ScrollReveal";
import PublicVideoGallery from "@/src/components/videos/PublicVideoGallery";
import { BeforeAfterCarousel } from "@/src/components/marketing/BeforeAfterCarousel";
import {
  beforeAfterResults,
  clinicLocations,
  contentCategories,
} from "@/src/lib/healthcare-content";
import { getPublishedContentPosts, getPublishedMediaPosts } from "@/src/lib/services/content-posts";
import type { LandingContent, LandingTestimonial } from "@/src/lib/db/types";
import { getPublishedFaqs, type PublicFaq } from "@/src/lib/services/faqs";
import { getLandingContent } from "@/src/lib/services/landing-content";
import { getPublicLiveEvents } from "@/src/lib/services/live-events";

const FALLBACK_TESTIMONIALS: LandingTestimonial[] = [
  {
    name: "GlowRx Patient",
    title: "Medical weight loss program",
    quote:
      "The plan felt realistic from the start. I had structure, regular follow-up, and clear medical guidance that helped me stay consistent and more confident in my progress.",
  },
  {
    name: "HormoneRx Patient",
    title: "PCOS and hormonal health care",
    quote:
      "I finally felt listened to. My concerns were explained clearly, my treatment plan felt personalized, and I could actually understand the next steps for my hormone health.",
  },
  {
    name: "HeartRx Patient",
    title: "Cardiovascular wellness support",
    quote:
      "The consultations helped me take my blood pressure and overall heart health seriously without feeling overwhelmed. Everything was practical, encouraging, and easy to follow.",
  },
  {
    name: "PreventRx Patient",
    title: "Executive check-up program",
    quote:
      "The preventive approach gave me peace of mind. Screenings, risk review, and lifestyle advice all came together in a way that felt proactive and reassuring.",
  },
  {
    name: "MetabolicRx Patient",
    title: "Metabolic health care",
    quote:
      "I appreciated how the guidance connected my lab results, nutrition habits, and long-term health goals. It felt like a complete plan instead of quick advice.",
  },
  {
    name: "Clinic Patient",
    title: "General consultation experience",
    quote:
      "From booking to follow-up, the experience was smooth and professional. I felt respected, informed, and comfortable asking questions throughout the consultation.",
  },
];

const PREVIOUS_ABOUT = {
  eyebrow: "About the Doctor",
  title: "Dr. Fatimah Al-Zahra T. Ditti (Doc Kulot) | Injector Queen",
  subtitle:
    "Doc Kulot is a Family Medicine and Aesthetic Medicine doctor focused on family care, women's health, telemedicine, and procedure-based aesthetics.",
  name: "Dr. Fatimah Al-Zahra T. Ditti",
  titleLabel: "Family Medicine | Aesthetic Medicine",
  photo: "/images/SEF_0442.jpeg",
  highlights: [
    { title: "Specialty", body: "Family Medicine and Aesthetic Medicine" },
    { title: "Medical School", body: "Silliman University Medical School, 2017" },
    { title: "Residency", body: "Zamboanga City Medical Center" },
    { title: "Pre-Med", body: "BS Nursing, Western Mindanao State University" },
    { title: "Care Focus", body: "Telemedicine, women's health, weight loss, and procedures" },
  ],
} as const;

function getTestimonials(items: LandingTestimonial[]) {
  const normalized = items
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      title: String(item.title ?? "").trim(),
      quote: String(item.quote ?? "").trim(),
    }))
    .filter((item) => item.name && item.quote);

  return normalized.length ? normalized : FALLBACK_TESTIMONIALS;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAboutProfile(content: LandingContent) {
  const hasLegacyDefaults =
    content.about_title === "Dr. Fatimah Al-Zahra Ditti"
    || content.doctor_title === "Medical Doctor"
    || content.doctor_photo_url?.includes("dockulots-removebg-preview.png");

  return {
    eyebrow: hasLegacyDefaults ? PREVIOUS_ABOUT.eyebrow : content.about_eyebrow,
    title: hasLegacyDefaults ? PREVIOUS_ABOUT.title : content.about_title,
    subtitle: hasLegacyDefaults ? PREVIOUS_ABOUT.subtitle : content.about_subtitle,
    name: hasLegacyDefaults ? PREVIOUS_ABOUT.name : content.doctor_name,
    titleLabel: hasLegacyDefaults ? PREVIOUS_ABOUT.titleLabel : content.doctor_title,
    photo: hasLegacyDefaults ? PREVIOUS_ABOUT.photo : content.doctor_photo_url || PREVIOUS_ABOUT.photo,
    highlights: hasLegacyDefaults || !content.about_highlights?.length
      ? PREVIOUS_ABOUT.highlights
      : content.about_highlights,
  };
}

export default async function HomePage() {
  const [landingContent, faqItems, blogPosts, mediaItems, liveSchedule] = await Promise.all([
    getLandingContent(),
    getPublishedFaqs(),
    getPublishedContentPosts(6),
    getPublishedMediaPosts(6),
    getPublicLiveEvents(4, ["Upcoming", "Live"]),
  ]);
  const featuredContent = blogPosts;
  const mediaPosts = mediaItems;
  const liveEvents = liveSchedule;
  const faqGroups = groupFaqsByCategory(faqItems);
  const aboutProfile = getAboutProfile(landingContent);
  const blogHeadline = landingContent.blog_title?.trim() || "Learn from Doc Kulot";
  const blogSubheadline
    = landingContent.blog_subtitle?.trim() || "Articles written by Doc Kulot.";
  const blogCategories = landingContent.blog_categories?.length ? landingContent.blog_categories : contentCategories;
  const testimonials = getTestimonials(landingContent.testimonials);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <PublicHeader />
      <LandingBookingModal />

      <section id="hero" className="bg-white md:pt-16">
        <RxHeroCarousel />
      </section>

      <ScrollReveal as="section" id="programs" className="bg-white" delayMs={40}>
        <OfferProgramsHero slides={landingContent.program_slides} />
      </ScrollReveal>

      <ScrollReveal delayMs={80}>
        <HomeServicesShowcase
          eyebrow={landingContent.services_eyebrow}
          title={landingContent.services_title}
          subtitle={landingContent.services_subtitle}
          services={landingContent.services}
        />
      </ScrollReveal>

      <ScrollReveal
        as="section"
        id="about"
        className="relative isolate overflow-hidden bg-black"
        delayMs={120}
      >
        <div className="grid min-h-[520px] lg:min-h-[760px] lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <section className="relative flex h-full flex-col justify-center px-6 py-12 text-white sm:px-8 sm:py-14 lg:px-12 lg:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/80 backdrop-blur">
              {aboutProfile.eyebrow}
            </div>

            <h2 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              {aboutProfile.title}
            </h2>

            <p className="mt-4 max-w-xl text-lg font-semibold text-[#d8c58a]">{aboutProfile.titleLabel}</p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 sm:text-lg sm:leading-9">
              {aboutProfile.subtitle}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {aboutProfile.highlights.map((feature, index) => (
                <div
                  key={`${feature.title}-${feature.body}`}
                  className={`rounded-[1.5rem] border p-5 backdrop-blur ${
                    index === 0 ? "border-white/16 bg-white/8" : "border-white/10 bg-white/6"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d8c58a]">
                    {feature.title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/82">{feature.body}</p>
                </div>
              ))}
            </div>

          </section>

          <div className="relative min-h-[520px] lg:min-h-[760px]">
            <Image
              src={aboutProfile.photo}
              alt={aboutProfile.name}
              fill
              priority
              unoptimized
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="results" className="bg-white py-16 md:py-24" delayMs={80}>
        <div>
          <div className="px-4 sm:px-6">
          <SectionHeading
            eyebrow={landingContent.results_eyebrow}
            title={landingContent.results_title}
            description={landingContent.results_subtitle}
            eyebrowClassName="text-sm font-semibold uppercase tracking-[0.25em] text-[#a98c45]"
          />
          </div>
          <BeforeAfterCarousel items={beforeAfterResults} />
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="booking" className="bg-white py-12 md:py-16" delayMs={100}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,#080808_0%,#171717_58%,#050505_100%)] px-6 py-9 text-white shadow-[0_30px_90px_-50px_rgba(0,0,0,0.85)] sm:px-8 md:px-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8ad5f]/45 to-transparent" />
            <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#c8ad5f]">Ready to book?</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  {landingContent.booking_title}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
                  {landingContent.booking_subtitle}
                </p>
              </div>

              <Link
                href="/#booking"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-neutral-200"
              >
                Open booking form
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="blog" className="scroll-mt-20 bg-slate-50 py-16 md:scroll-mt-24 md:py-24" delayMs={120}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="border-t border-black/10 pt-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Our Blog</p>
                <h2 className="font-mono text-4xl font-black tracking-[-0.03em] text-black sm:text-5xl">
                  {blogHeadline}
                </h2>
                <p className="mt-3 max-w-2xl font-mono text-base text-neutral-500 sm:text-lg">
                  {blogSubheadline}
                </p>
              </div>

              <Link
                href="/blog"
                className="inline-flex items-center gap-2 self-start border-b border-black pb-1 text-sm uppercase tracking-[0.14em] text-black transition hover:text-slate-700"
              >
                Read our blog
                <FaArrowRight className="text-xs" />
              </Link>
            </div>
          </div>

          <div className="mt-10">
            <InlineArticleBrowser
              posts={featuredContent}
              categories={blogCategories}
              labels={{
                categoriesTitle: landingContent.blog_categories_title,
                recentPostsTitle: landingContent.blog_recent_posts_title,
              }}
            />
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="videos" className="bg-white py-16 md:py-24" delayMs={100}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.38em] text-black">Vlogs</p>
          <SectionHeading
            eyebrow={landingContent.videos_eyebrow}
            title={landingContent.videos_title}
            description={landingContent.videos_subtitle}
            eyebrowClassName="text-sm font-bold uppercase tracking-[0.38em] text-black"
          />
          <div className="mb-5 flex justify-between">
            <Link href="/videos" className="inline-flex items-center gap-2 text-sm font-bold text-black hover:text-slate-700">
              Open video page <FaArrowRight />
            </Link>
          </div>

          <PublicVideoGallery posts={mediaPosts.slice(0, 6)} variant="compact" />

          {mediaPosts.length ? (
            <div className="mt-6 flex justify-end">
              <Link href="/videos" className="inline-flex items-center gap-2 text-sm font-bold text-black transition hover:text-slate-700">
                Browse all vlogs
                <FaArrowRight />
              </Link>
            </div>
            ) : null}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="live" className="scroll-mt-20 bg-white py-16 md:scroll-mt-24 md:py-24" delayMs={120}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.38em] text-black">Live Schedule</p>
          <SectionHeading
            eyebrow={landingContent.live_eyebrow}
            title={landingContent.live_title}
            description={landingContent.live_subtitle}
            eyebrowClassName="text-sm font-bold uppercase tracking-[0.38em] text-black"
          />
          <div className="mb-5 flex justify-between">
            <Link href="/live" className="inline-flex items-center gap-2 text-sm font-bold text-black hover:text-slate-700">
              {landingContent.live_cta_label} <FaArrowRight />
            </Link>
          </div>

          <div className="grid gap-5">
            {liveEvents.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#f1f5f9_100%)] p-6 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.25)]"
              >
                <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-stretch">
                  <div className="flex flex-row gap-4 lg:flex-col">
                    <div className="min-w-[110px] rounded-[1.75rem] bg-[linear-gradient(180deg,#0f172a_0%,#334155_100%)] px-5 py-5 text-white shadow-lg shadow-black/20">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { month: "short" })}
                      </p>
                      <p className="mt-2 text-4xl font-black leading-none">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { day: "2-digit" })}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { year: "numeric" })}
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] border border-black/10 bg-white/85 px-4 py-4 text-sm text-slate-600">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Starts at</p>
                      <p className="mt-2 text-base font-bold text-slate-950">
                        {new Date(event.starts_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.9rem] border border-white/70 bg-white/80 p-5 backdrop-blur">
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-black">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5">{event.status}</span>
                      {event.platform ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{event.platform}</span> : null}
                      {event.registration_enabled ? (
                        <span className="rounded-full bg-white px-3 py-1.5 text-slate-600">Registration enabled</span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{event.title}</h3>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {new Date(event.starts_at).toLocaleString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">
                      {event.description || "A live health talk schedule is available. Open the public live page for more event details and replay updates."}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span className="inline-flex rounded-full border border-black bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black">
                        Live health talk
                      </span>
                      {event.content_posts?.title ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                          Replay available: {event.content_posts.title}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                          Replay will appear after the event
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-[1.9rem] border border-black/10 bg-white/90 p-5 shadow-sm">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black">Next step</p>
                      <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                        {event.registration_enabled ? "Reserve your slot" : "Open the live stream"}
                      </h4>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {event.registration_enabled
                          ? "Join the upcoming session from the public link, then come back for the replay or follow-up schedule."
                          : "Use the stream link when the session starts, then visit the live page for updates and replays."}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3">
                      {event.live_url ? (
                        <Link
                          href={event.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          {event.registration_enabled ? "Register / Join" : "Open stream"}
                        </Link>
                      ) : null}
                      <Link
                        href="/live"
                        className="inline-flex items-center justify-center rounded-full border border-black px-5 py-3 text-sm font-bold text-black transition hover:bg-slate-50"
                      >
                        View schedule page
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {!liveEvents.length ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm leading-7 text-slate-500">
                No live sessions are posted yet. Upcoming schedules from the creator platform will appear here as soon as they are added.
              </div>
            ) : null}
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="testimonials" className="bg-white py-14 md:py-20" delayMs={80}>
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-mono text-4xl font-medium leading-none text-black sm:text-5xl">
              {landingContent.testimonials_eyebrow || "Testimonials"}
            </h2>
            <p className="mt-5 font-mono text-base text-neutral-600">
              {landingContent.testimonials_subtitle || "Believe the hype!"}
            </p>
          </div>

          <div className="mt-10 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <article
                key={`${testimonial.name}-${index}`}
                className="flex min-h-[26.5rem] flex-col items-center rounded-[1.25rem] border border-neutral-100 bg-white px-8 py-9 text-center shadow-[0_16px_28px_rgba(0,0,0,0.16),0_2px_10px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_34px_rgba(0,0,0,0.18),0_4px_14px_rgba(0,0,0,0.08)] sm:px-10"
              >
                <div className="mx-auto flex min-h-[8.75rem] max-w-[18rem] items-start">
                  <p className="line-clamp-5 text-base leading-6 text-neutral-500">
                    {testimonial.quote}
                  </p>
                </div>

                <div className="mt-7 flex h-[5.75rem] w-[5.75rem] items-center justify-center rounded-full bg-[linear-gradient(180deg,#f8f8f8_0%,#eeeeee_100%)] text-2xl font-semibold text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  {getInitials(testimonial.name)}
                </div>

                <div className="mt-7 flex justify-center gap-1 text-[#f4b400]">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <FaStar key={starIndex} className="h-3.5 w-3.5" />
                  ))}
                </div>

                <h3 className="mt-7 text-lg font-bold leading-tight text-black">
                  {testimonial.name}
                </h3>
                <p className="mt-1 text-base font-bold leading-5 text-black">{testimonial.title}</p>
              </article>
            ))}
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="faq" className="bg-slate-50 py-16 md:py-24" delayMs={100}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow={landingContent.faq_eyebrow}
            title={landingContent.faq_title}
            description={landingContent.faq_subtitle}
          />

          <div className="rounded-[2.25rem] border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_52%,#f1f5f9_100%)] p-5 shadow-[0_25px_60px_-40px_rgba(0,0,0,0.25)] sm:p-6">
            <div className="flex flex-wrap gap-2">
              {faqGroups.map((group) => (
                <span
                  key={group.category}
                  className="rounded-full border border-black bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-black shadow-sm"
                >
                  {group.category}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {faqGroups.map((group) => (
                <section
                  key={group.category}
                  className="rounded-[1.85rem] border border-black/10 bg-white/95 p-5 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-black">FAQ Category</p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{group.category}</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-black">
                      {group.items.length} question{group.items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {group.items.map((faq) => (
                      <FaqItem key={`${faq.category}-${faq.question}`} question={faq.question} answer={faq.answer} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="contact" className="bg-white py-16 md:py-24" delayMs={120}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 border-t border-black/10 pt-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <section className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#a98c45]">{landingContent.contact_eyebrow}</p>
              <h2 className="mt-3 font-mono text-4xl font-medium leading-tight text-black sm:text-5xl">{landingContent.contact_title}</h2>
              <p className="mt-5 text-base leading-8 text-neutral-600">{landingContent.contact_subtitle}</p>
              <Link href="/#booking" className="mt-8 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-neutral-800">
                Go to booking
              </Link>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={landingContent.contact_facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-black bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-slate-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white">
                    <FaFacebookF className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {landingContent.contact_facebook_label}
                </a>
                <a
                  href={landingContent.contact_youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-black bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-slate-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FF0000] text-white">
                    <FaYoutube className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {landingContent.contact_youtube_label}
                </a>
              </div>
            </section>
            <InquiryForm />
          </div>
        </div>
      </ScrollReveal>

      <footer className="relative overflow-hidden bg-white text-slate-800">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        <div className="absolute left-[-6rem] top-[-4rem] h-40 w-40 rounded-full bg-black/5 blur-3xl" />
        <div className="absolute right-[-5rem] bottom-[-4rem] h-44 w-44 rounded-full bg-black/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 border-b border-black/10 pb-8 lg:grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr]">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-36 w-36 items-center justify-center">
                  <Image
                    src="/images/dockulotslogonobg.png"
                    alt="Doc Kulot logo"
                    width={320}
                    height={320}
                    className="h-36 w-36 object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">Doc Kulot</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-black">Family Medicine</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-700">{landingContent.footer_brand_blurb}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/#booking"
                  className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Book appointment
                </Link>
                <Link
                  href="/#contact"
                  className="inline-flex items-center justify-center rounded-full border border-black bg-white/70 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
                >
                  Send inquiry
                </Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-black">Quick Links</p>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  { label: "Home", href: "/#hero" },
                  { label: "About", href: "/#about" },
                  { label: "Services", href: "/#clinic" },
                  { label: "Blog", href: "/#blog" },
                  { label: "Videos", href: "/#videos" },
                  { label: "FAQ", href: "/#faq" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="transition hover:text-slate-950">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-black">Services</p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                {landingContent.footer_services.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-black">Schedule</p>
              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                {clinicLocations.map((location) => (
                  <p key={location.name}>{location.name}: {location.schedule}</p>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-black">Contact</p>
              <p className="mt-4 text-sm leading-7 text-slate-700">{landingContent.footer_contact_text}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={landingContent.contact_facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-black bg-transparent px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/40"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm">
                    <FaFacebookF className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {landingContent.contact_facebook_label}
                </a>
                <a
                  href={landingContent.contact_youtube_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-black bg-transparent px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white/40"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-sm">
                    <FaYoutube className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {landingContent.contact_youtube_label}
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 py-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <p>{landingContent.footer_copyright}</p>
            <p className="text-slate-500">Doc Kulot</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  inverted = false,
  eyebrowClassName = "text-sm font-semibold uppercase tracking-[0.25em] text-black",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  inverted?: boolean;
  eyebrowClassName?: string;
}) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className={eyebrowClassName}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${inverted ? "text-white" : "text-slate-950"}`}>
        {title}
      </h2>
      {description ? <p className={`mt-4 leading-7 ${inverted ? "text-slate-300" : "text-slate-600"}`}>{description}</p> : null}
    </div>
  );
}

function groupFaqsByCategory(faqs: PublicFaq[]) {
  const map = new Map<string, PublicFaq[]>();

  for (const faq of faqs) {
    const items = map.get(faq.category) ?? [];
    items.push(faq);
    map.set(faq.category, items);
  }

  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:border-black hover:bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
        <span className="text-base font-bold leading-7 text-slate-950">{question}</span>
        <span className="mt-1 text-lg font-black leading-none text-black transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600">{answer}</p>
    </details>
  );
}
