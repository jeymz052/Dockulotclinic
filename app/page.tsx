import Image from "next/image";
import Link from "next/link";
import {
  FaArrowRight,
  FaFacebookF,
  FaHeartPulse,
  FaLaptopMedical,
  FaStethoscope,
  FaYoutube,
  FaUserDoctor,
} from "react-icons/fa6";
import BookAppointmentPage from "@/src/components/appointments/BookAppointmentPage";
import InlineArticleBrowser from "@/src/components/blog/InlineArticleBrowser";
import PublicHeader from "@/src/components/layout/PublicHeader";
import InquiryForm from "@/src/components/marketing/InquiryForm";
import PublicVideoGallery from "@/src/components/videos/PublicVideoGallery";
import HeroTitle from "@/src/components/ui/HeroTitle";
import { clinicServices, contentCategories } from "@/src/lib/healthcare-content";
import { getPublishedContentPosts, getPublishedMediaPosts } from "@/src/lib/services/content-posts";
import { getPublishedFaqs, type PublicFaq } from "@/src/lib/services/faqs";
import { getLandingContent } from "@/src/lib/services/landing-content";
import { getPublicLiveEvents } from "@/src/lib/services/live-events";

const DEFAULT_HERO = "/images/chiarabg.png";
const DEFAULT_DOCTOR = "/images/dockulots-removebg-preview.png";
const DOCTOR_PROFILE = {
  eyebrow: "About the Doctor",
  title: "Dr. Fatimah Al-Zahra Ditti",
  subtitle:
    "Medical Doctor focused on family medicine, women's health, preventive care, and everyday primary care support for patients and families.",
  name: "Dr. Fatimah Al-Zahra Ditti",
  titleLabel: "Medical Doctor",
} as const;

const ABOUT_HIGHLIGHTS = [
  { title: "Specialty", body: "Family Medicine" },
  { title: "Experience", body: "8 Years of clinical practice" },
  { title: "Subspecialty", body: "PCOS Management and Weightloss Management" },
  { title: "Care Focus", body: "Primary care, prevention, and follow-up support" },
  { title: "Education", body: "Silliman University, 2017 | Zamboanga City Medical Center, 2021" },
] as const;

function getAboutProfile(landingContent: {
  about_eyebrow: string;
  about_title: string;
  about_subtitle: string;
  doctor_name: string;
  doctor_title: string;
  about_highlights?: Array<{ title?: string | null; body?: string | null }>;
}) {
  const isLegacyAbout =
    landingContent.about_title === "Expert Healthcare Provider"
    || landingContent.doctor_name === "Doctora Kulot, MD"
    || landingContent.doctor_title === "Family Medicine Specialist";

  const sanitize = (value: string, fallback: string) =>
    /nowserving/i.test(value) ? fallback : value;

  return {
    eyebrow: isLegacyAbout ? DOCTOR_PROFILE.eyebrow : landingContent.about_eyebrow,
    title: isLegacyAbout ? DOCTOR_PROFILE.title : landingContent.about_title,
    subtitle: isLegacyAbout ? DOCTOR_PROFILE.subtitle : sanitize(landingContent.about_subtitle, DOCTOR_PROFILE.subtitle),
    name: isLegacyAbout ? DOCTOR_PROFILE.name : landingContent.doctor_name,
    titleLabel: isLegacyAbout ? DOCTOR_PROFILE.titleLabel : landingContent.doctor_title,
    highlights: isLegacyAbout
      ? ABOUT_HIGHLIGHTS
      : sanitizeHighlights(landingContent.about_highlights),
  };
}

function sanitizeHighlights(
  highlights: Array<{ title?: string | null; body?: string | null }> | undefined,
) {
  const normalized = (highlights ?? [])
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      body: String(item.body ?? "").trim(),
    }))
    .filter((item) => item.title || item.body);
  return normalized.length ? normalized : ABOUT_HIGHLIGHTS;
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
  const services = landingContent.services.length
    ? landingContent.services
    : clinicServices.map((service, index) => ({
        kind: index === 1 ? "online" : "clinic",
        title: service.title,
        description: service.description,
        bullets: [],
      }));
  const blogCategories = landingContent.blog_categories?.length ? landingContent.blog_categories : contentCategories;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <PublicHeader />

      <section id="hero" className="relative isolate min-h-[100svh] overflow-hidden">
        <Image
          src={landingContent.hero_background_url || DEFAULT_HERO}
          alt="Clinic background"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-left md:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-slate-950/25 to-yellow-900/20 md:bg-gradient-to-r md:from-black/50 md:via-slate-950/35 md:to-yellow-900/20" />
        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-4 pb-14 pt-20 sm:px-6 sm:pt-24 lg:justify-end lg:pt-16">
          <div className="max-w-2xl text-center lg:max-w-3xl lg:text-right">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-200 sm:tracking-[0.28em]">
              {landingContent.hero_eyebrow}
            </p>
            <HeroTitle line1={landingContent.hero_title_line1} line2={landingContent.hero_title_line2} />
            <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-7 text-slate-200 sm:mt-6 sm:text-base sm:leading-8 lg:ml-auto lg:mr-0 lg:max-w-2xl lg:text-right lg:text-lg">
              {landingContent.hero_subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-end">
              <Link
                href="/#online"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-black/20 transition hover:bg-yellow-500"
              >
                {landingContent.hero_cta_primary}
                <FaArrowRight />
              </Link>
              <Link
                href="/#clinic"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white/70 px-6 py-3 text-sm font-bold text-yellow-900 backdrop-blur transition hover:bg-white/90"
              >
                {landingContent.hero_cta_secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-[2rem] border border-yellow-100 bg-yellow-50 p-4 shadow-sm">
            <Image
              src={landingContent.doctor_photo_url || DEFAULT_DOCTOR}
              alt={aboutProfile.name}
              width={900}
              height={1100}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
          <section>
            <p className="text-sm font-bold uppercase tracking-[0.38em] text-yellow-800">{aboutProfile.eyebrow}</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {aboutProfile.title}
            </h2>
            <p className="mt-3 text-lg font-semibold text-slate-700">{aboutProfile.titleLabel}</p>
            <p className="mt-5 max-w-2xl leading-8 text-slate-600">{aboutProfile.subtitle}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {aboutProfile.highlights.map((feature) => (
                  <div key={`${feature.title}-${feature.body}`} className="rounded-2xl border border-yellow-100 bg-yellow-50/40 p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-800">{feature.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{feature.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
                <Link href="/#booking" className="inline-flex rounded-full bg-yellow-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-yellow-600">
                Book an appointment
              </Link>
            </div>
          </section>
        </div>
      </section>

      <section id="clinic" className="bg-yellow-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow={landingContent.services_eyebrow}
            title={landingContent.services_title}
            description={landingContent.services_subtitle}
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {services.map((service) => {
              const ServiceIcon = service.kind === "online"
                ? FaLaptopMedical
                : service.kind === "wellness"
                  ? FaHeartPulse
                  : service.kind === "doctor"
                    ? FaUserDoctor
                    : FaStethoscope;
              return (
                <article key={`${service.kind}-${service.title}`} className="rounded-2xl border border-yellow-100 bg-white p-5 shadow-sm">
                  <ServiceIcon className="text-2xl text-yellow-700" />
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <ScheduleCard
              title="Clinic Visit"
              schedule="Friday to Sunday"
              hours="9:00 AM - 3:00 PM"
              detail="Face-to-face visits at FamMed Family Clinic."
            />
            <ScheduleCard
              title="Virtual Consult"
              schedule="Monday to Friday"
              hours="10:00 AM - 8:00 PM"
              detail="Online consults for weekdays."
            />
            <ScheduleCard
              title="Weekend Virtual"
              schedule="Saturday and Sunday"
              hours="10:00 AM - 6:00 PM"
              detail="Extended virtual consult hours on weekends."
            />
          </div>
        </div>
      </section>

      <section id="online" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Online / Booking Services"
            title={landingContent.booking_title}
            description={landingContent.booking_subtitle}
          />
          <div id="booking" className="w-full overflow-visible rounded-3xl border border-yellow-100 bg-white p-4 shadow-xl sm:p-6">
            <BookAppointmentPage />
          </div>
        </div>
      </section>

      <section id="blog" className="scroll-mt-20 bg-yellow-50 py-16 md:scroll-mt-24 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.38em] text-yellow-800">Blogs</p>
          <SectionHeading
            eyebrow={landingContent.blog_eyebrow}
            title={landingContent.blog_title}
            description={landingContent.blog_subtitle}
            eyebrowClassName="text-sm font-bold uppercase tracking-[0.38em] text-yellow-800"
          />
          <div className="mb-5 flex justify-between">
            <Link href="/#blog" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-800 hover:text-yellow-900">
              View all blog posts <FaArrowRight />
            </Link>
          </div>

          <InlineArticleBrowser
            posts={featuredContent}
            categories={blogCategories}
            labels={{
              categoriesTitle: landingContent.blog_categories_title,
              recentPostsTitle: landingContent.blog_recent_posts_title,
            }}
          />
        </div>
      </section>

      <section id="videos" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.38em] text-yellow-800">Vlogs</p>
          <SectionHeading
            eyebrow={landingContent.videos_eyebrow}
            title={landingContent.videos_title}
            description={landingContent.videos_subtitle}
            eyebrowClassName="text-sm font-bold uppercase tracking-[0.38em] text-yellow-800"
          />
          <div className="mb-5 flex justify-between">
            <Link href="/videos" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-800 hover:text-yellow-900">
              Open video page <FaArrowRight />
            </Link>
          </div>

          <PublicVideoGallery posts={mediaPosts.slice(0, 6)} variant="compact" />

          {mediaPosts.length ? (
            <div className="mt-6 flex justify-end">
              <Link href="/videos" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-900 transition hover:text-yellow-800">
                Browse all vlogs
                <FaArrowRight />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section id="live" className="scroll-mt-20 bg-yellow-50 py-16 md:scroll-mt-24 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.38em] text-yellow-800">Live Schedule</p>
          <SectionHeading
            eyebrow={landingContent.live_eyebrow}
            title={landingContent.live_title}
            description={landingContent.live_subtitle}
            eyebrowClassName="text-sm font-bold uppercase tracking-[0.38em] text-yellow-800"
          />
          <div className="mb-5 flex justify-between">
            <Link href="/live" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-800 hover:text-yellow-900">
              {landingContent.live_cta_label} <FaArrowRight />
            </Link>
          </div>

          <div className="grid gap-5">
            {liveEvents.map((event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-[2.25rem] border border-yellow-100 bg-[linear-gradient(135deg,#ffffff_0%,#fffbeb_52%,#fef3c7_100%)] p-6 shadow-[0_24px_60px_-36px_rgba(180,83,9,0.25)]"
              >
                <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-stretch">
                  <div className="flex flex-row gap-4 lg:flex-col">
                    <div className="min-w-[110px] rounded-[1.75rem] bg-[linear-gradient(180deg,#78350f_0%,#b45309_100%)] px-5 py-5 text-white shadow-lg shadow-yellow-900/20">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-100">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { month: "short" })}
                      </p>
                      <p className="mt-2 text-4xl font-black leading-none">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { day: "2-digit" })}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-yellow-100">
                        {new Date(event.starts_at).toLocaleDateString(undefined, { year: "numeric" })}
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] border border-yellow-100 bg-white/85 px-4 py-4 text-sm text-slate-600">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-800">Starts at</p>
                      <p className="mt-2 text-base font-bold text-slate-950">
                        {new Date(event.starts_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.9rem] border border-white/70 bg-white/80 p-5 backdrop-blur">
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-800">
                      <span className="rounded-full bg-yellow-50 px-3 py-1.5">{event.status}</span>
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
                      <span className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-yellow-900">
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

                  <div className="flex flex-col justify-between rounded-[1.9rem] border border-yellow-100 bg-white/90 p-5 shadow-sm">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-800">Next step</p>
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
                          className="inline-flex items-center justify-center rounded-full bg-yellow-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-yellow-500"
                        >
                          {event.registration_enabled ? "Register / Join" : "Open stream"}
                        </Link>
                      ) : null}
                      <Link
                        href="/live"
                        className="inline-flex items-center justify-center rounded-full border border-yellow-200 px-5 py-3 text-sm font-bold text-yellow-900 transition hover:bg-yellow-50"
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
      </section>

      <section id="faq" className="bg-yellow-50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="FAQ"
            title="Quick answers for common clinic questions"
            description="Frequently asked questions now live on the landing page instead of a separate page."
          />

          <div className="rounded-[2.25rem] border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fef9c3_52%,#fef3c7_100%)] p-5 shadow-[0_25px_60px_-40px_rgba(180,83,9,0.25)] sm:p-6">
            <div className="flex flex-wrap gap-2">
              {faqGroups.map((group) => (
                <span
                  key={group.category}
                  className="rounded-full border border-yellow-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-yellow-900 shadow-sm"
                >
                  {group.category}
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {faqGroups.map((group) => (
                <section
                  key={group.category}
                  className="rounded-[1.85rem] border border-yellow-100 bg-white/95 p-5 shadow-[0_18px_40px_-32px_rgba(180,83,9,0.25)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-yellow-800">FAQ Category</p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{group.category}</h3>
                    </div>
                    <span className="rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-yellow-800">
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
      </section>

      <section id="contact" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-800">{landingContent.contact_eyebrow}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{landingContent.contact_title}</h2>
              <p className="mt-4 leading-8 text-slate-600">{landingContent.contact_subtitle}</p>
              <Link href="/#booking" className="mt-8 inline-flex rounded-full bg-yellow-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-yellow-600">
                Go to booking
              </Link>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://www.facebook.com/share/1GnJA9tPm2/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-bold text-yellow-900 transition hover:bg-yellow-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white">
                    <FaFacebookF className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  Doc Kulot Facebook
                </a>
                <a
                  href="https://www.youtube.com/@DocKulot"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-bold text-yellow-900 transition hover:bg-yellow-50"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FF0000] text-white">
                    <FaYoutube className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  Doc Kulot YouTube
                </a>
              </div>
            </section>
            <InquiryForm />
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-[linear-gradient(180deg,#fff8e1_0%,#ffecb3_55%,#ffe082_100%)] text-slate-800">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
        <div className="absolute left-[-6rem] top-[-4rem] h-40 w-40 rounded-full bg-yellow-200/40 blur-3xl" />
        <div className="absolute right-[-5rem] bottom-[-4rem] h-44 w-44 rounded-full bg-yellow-400/25 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 border-b border-yellow-400/25 pb-8 lg:grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr]">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-36 w-36 items-center justify-center">
                  <Image
                    src="/images/dockulotslogonobg.png"
                    alt="Doctor Kulot Clinic logo"
                    width={320}
                    height={320}
                    className="h-36 w-36 object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">Doctor Kulot Clinic</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-yellow-800">Family Medicine</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-700">{landingContent.footer_brand_blurb}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/#booking"
                  className="inline-flex items-center justify-center rounded-full bg-yellow-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-yellow-500"
                >
                  Book appointment
                </Link>
                <Link
                  href="/#contact"
                  className="inline-flex items-center justify-center rounded-full border border-yellow-300 bg-white/70 px-5 py-2.5 text-sm font-bold text-yellow-900 transition hover:bg-white"
                >
                  Send inquiry
                </Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-800">Quick Links</p>
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
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-800">Services</p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                {landingContent.footer_services.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-yellow-800">Clinic Hours</p>
              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                <p>Clinic Visit: Friday to Sunday, 9:00 AM - 3:00 PM</p>
                <p>Virtual Consult: Monday to Friday, 10:00 AM - 8:00 PM</p>
                <p>Weekend Virtual: Saturday and Sunday, 10:00 AM - 6:00 PM</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-800">Contact</p>
              <p className="mt-4 text-sm leading-7 text-slate-700">{landingContent.footer_contact_text}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="https://www.facebook.com/share/1GnJA9tPm2/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-transparent px-4 py-2.5 text-sm font-bold text-yellow-900 transition hover:bg-white/40"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm">
                    <FaFacebookF className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  Doc Kulot Facebook
                </a>
                <a
                  href="https://www.youtube.com/@DocKulot"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-transparent px-4 py-2.5 text-sm font-bold text-yellow-900 transition hover:bg-white/40"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-sm">
                    <FaYoutube className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  Doc Kulot YouTube
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 py-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <p>All rights reserved 2026</p>
            <p className="text-slate-500">Doctor Kulot Clinic</p>
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
  eyebrowClassName = "text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700",
}: {
  eyebrow: string;
  title: string;
  description: string;
  inverted?: boolean;
  eyebrowClassName?: string;
}) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className={eyebrowClassName}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${inverted ? "text-white" : "text-slate-950"}`}>
        {title}
      </h2>
      <p className={`mt-4 leading-7 ${inverted ? "text-slate-300" : "text-slate-600"}`}>{description}</p>
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
    <details className="group rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-4 transition hover:border-yellow-300 hover:bg-white">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
        <span className="text-base font-bold leading-7 text-slate-950">{question}</span>
        <span className="mt-1 text-lg font-black leading-none text-yellow-700 transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-4 border-t border-slate-200 pt-4 text-sm leading-7 text-slate-600">{answer}</p>
    </details>
  );
}

function ScheduleCard({
  title,
  schedule,
  hours,
  detail,
}: {
  title: string;
  schedule: string;
  hours: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.8rem] border border-yellow-100 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-800">{title}</p>
      <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{hours}</h3>
      <p className="mt-2 text-sm font-semibold text-slate-700">{schedule}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </article>
  );
}
