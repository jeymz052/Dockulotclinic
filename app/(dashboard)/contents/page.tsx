"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FaArrowUpRightFromSquare,
  FaCalendarDays,
  FaCircleCheck,
  FaCircleXmark,
  FaCloudArrowUp,
  FaFolderOpen,
  FaNewspaper,
  FaPlus,
  FaTrash,
  FaUserDoctor,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { LandingContent, LandingHighlight, LandingService } from "@/src/lib/db/types";
import { clinicServices, contentCategories, faqCategories } from "@/src/lib/healthcare-content";

type Tab = "home" | "about" | "services" | "blog" | "videos" | "faq";
type Feedback = { kind: "ok" | "err"; msg: string } | null;
type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
};

const DEFAULT_HERO = "/images/dockulotbgs.png";
const DEFAULT_DOCTOR = "/images/dockulotslogonobg.png";
const DEFAULT_ABOUT_HIGHLIGHTS: LandingHighlight[] = [
  { title: "Specialty", body: "Family Medicine" },
  { title: "Experience", body: "8 Years of clinical practice" },
  { title: "Subspecialty", body: "PCOS Management and Weightloss Management" },
  { title: "Care Focus", body: "Primary care, prevention, and follow-up support" },
  { title: "Education", body: "Silliman University, 2017 | Zamboanga City Medical Center, 2021" },
];
const EMPTY_FAQ_FORM = {
  category: faqCategories[0],
  question: "",
  answer: "",
  sort_order: "0",
  is_published: true,
};
const TABS: Array<{ id: Tab; label: string; detail: string }> = [
  { id: "home", label: "Home", detail: "Hero section on the landing page" },
  { id: "about", label: "About", detail: "Doctor introduction section" },
  { id: "services", label: "Services", detail: "Clinic and online booking section" },
  { id: "blog", label: "Blog", detail: "Landing blog texts only" },
  { id: "videos", label: "Videos", detail: "Vlogs and live schedule texts only" },
  { id: "faq", label: "FAQ", detail: "Landing-page FAQs" },
];

export default function ContentsManagerPage() {
  const { accessToken, role, isLoading } = useRole();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [original, setOriginal] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqForm, setFaqForm] = useState(EMPTY_FAQ_FORM);

  const canEdit = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/landing-content", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { content: LandingContent };
        if (!active) return;
        const normalized = normalizeLandingContent(payload.content);
        setContent(normalized);
        setOriginal(normalized);
      } catch (error) {
        if (active) {
          setFeedback({
            kind: "err",
            msg: error instanceof Error ? error.message : "Failed to load website content",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    (async () => {
      try {
        const payload = await fetchFaqs(accessToken);
        if (!active) return;
        setFaqs(payload);
      } catch (error) {
        if (active) {
          setFeedback({
            kind: "err",
            msg: error instanceof Error ? error.message : "Failed to load FAQs",
          });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const dirty = useMemo(() => {
    if (!content || !original) return false;
    return JSON.stringify(content) !== JSON.stringify(original);
  }, [content, original]);

  function update<K extends keyof LandingContent>(key: K, value: LandingContent[K]) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
    setFeedback(null);
  }

  function patchArray<K extends keyof LandingContent>(
    key: K,
    fn: (current: LandingContent[K]) => LandingContent[K],
  ) {
    setContent((current) => (current ? { ...current, [key]: fn(current[key]) } : current));
    setFeedback(null);
  }

  function updateAboutHighlight(index: number, patch: Partial<LandingHighlight>) {
    patchArray("about_highlights", (current) => {
      const next = [...ensureAboutHighlights(current as LandingHighlight[])];
      next[index] = { ...next[index], ...patch };
      return next as LandingContent["about_highlights"];
    });
  }

  function addAboutHighlight() {
    patchArray("about_highlights", (current) => [
      ...ensureAboutHighlights(current as LandingHighlight[]),
      { title: "", body: "" },
    ] as LandingContent["about_highlights"]);
  }

  function removeAboutHighlight(index: number) {
    patchArray("about_highlights", (current) =>
      ensureAboutHighlights(current as LandingHighlight[]).filter((_, itemIndex) => itemIndex !== index) as LandingContent["about_highlights"],
    );
  }

  function addService() {
    patchArray("services", (current) => [
      ...(current as LandingService[]),
      { kind: "clinic", title: "", description: "", bullets: [] },
    ]);
  }

  function updateService(index: number, patch: Partial<LandingService>) {
    patchArray("services", (current) => {
      const next = (current as LandingService[]).slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeService(index: number) {
    patchArray("services", (current) => (current as LandingService[]).filter((_, itemIndex) => itemIndex !== index));
  }

  function updateBlogCategory(index: number, value: string) {
    patchArray("blog_categories", (current) => {
      const next = Array.isArray(current) ? [...current] : [];
      next[index] = value;
      return next;
    });
  }

  function addBlogCategory() {
    patchArray("blog_categories", (current) => [...((current as string[]) || []), ""]);
  }

  function removeBlogCategory(index: number) {
    patchArray("blog_categories", (current) => ((current as string[]) || []).filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSave() {
    if (!content || !accessToken || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const body: Partial<LandingContent> = {
        hero_eyebrow: content.hero_eyebrow,
        hero_title_line1: content.hero_title_line1,
        hero_title_line2: content.hero_title_line2,
        hero_subtitle: content.hero_subtitle,
        hero_cta_primary: content.hero_cta_primary,
        hero_cta_secondary: content.hero_cta_secondary,
        hero_background_url: content.hero_background_url,
        about_eyebrow: content.about_eyebrow,
        about_title: content.about_title,
        about_subtitle: content.about_subtitle,
        doctor_name: content.doctor_name,
        doctor_title: content.doctor_title,
        doctor_photo_url: content.doctor_photo_url,
        about_highlights: content.about_highlights,
        services_eyebrow: content.services_eyebrow,
        services_title: content.services_title,
        services_subtitle: content.services_subtitle,
        services: content.services,
        booking_title: content.booking_title,
        booking_subtitle: content.booking_subtitle,
        blog_eyebrow: content.blog_eyebrow,
        blog_title: content.blog_title,
        blog_subtitle: content.blog_subtitle,
        blog_categories_title: content.blog_categories_title,
        blog_recent_posts_title: content.blog_recent_posts_title,
        blog_categories: content.blog_categories,
        videos_eyebrow: content.videos_eyebrow,
        videos_title: content.videos_title,
        videos_subtitle: content.videos_subtitle,
        live_eyebrow: content.live_eyebrow,
        live_title: content.live_title,
        live_subtitle: content.live_subtitle,
        live_cta_label: content.live_cta_label,
      };
      const res = await fetch("/api/v2/landing-content", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { content?: LandingContent; message?: string };
      if (!res.ok || !payload.content) throw new Error(payload.message ?? "Failed to save website content");
      setContent(payload.content);
      setOriginal(payload.content);
      setFeedback({ kind: "ok", msg: "Website content updated." });
    } catch (error) {
      setFeedback({ kind: "err", msg: error instanceof Error ? error.message : "Failed to save website content" });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setContent(original);
    setFeedback(null);
  }

  async function handleAddFaq() {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/v2/faqs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: faqForm.category,
          question: faqForm.question,
          answer: faqForm.answer,
          sort_order: Number(faqForm.sort_order || 0),
          is_published: faqForm.is_published,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(payload.message ?? "Unable to save FAQ");
      setFaqForm(EMPTY_FAQ_FORM);
      setFaqs(await fetchFaqs(accessToken));
      setFeedback({ kind: "ok", msg: "FAQ saved." });
    } catch (error) {
      setFeedback({ kind: "err", msg: error instanceof Error ? error.message : "Unable to save FAQ" });
    }
  }

  async function handleUpdateFaq(id: string, patch: Partial<Faq>, successMessage: string) {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v2/faqs/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(payload.message ?? "Unable to update FAQ");
      setFaqs(await fetchFaqs(accessToken));
      setFeedback({ kind: "ok", msg: successMessage });
    } catch (error) {
      setFeedback({ kind: "err", msg: error instanceof Error ? error.message : "Unable to update FAQ" });
    }
  }

  async function handleDeleteFaq(id: string) {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v2/faqs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(payload.message ?? "Unable to delete FAQ");
      setFaqs(await fetchFaqs(accessToken));
      setFeedback({ kind: "ok", msg: "FAQ removed." });
    } catch (error) {
      setFeedback({ kind: "err", msg: error instanceof Error ? error.message : "Unable to delete FAQ" });
    }
  }

  if (isLoading || loading) {
    return <div className="h-40 animate-pulse rounded-3xl border border-yellow-100 bg-white shadow-sm" />;
  }

  if (!canEdit) {
    return (
      <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
        You don&apos;t have permission to manage website content.
      </div>
    );
  }

  if (!content) {
    return (
      <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-700">
        Website content wasn&apos;t found. Run the latest migration and reload.
      </div>
    );
  }

  const blogCategories = content.blog_categories?.length ? content.blog_categories : contentCategories;
  const faqGroups = groupFaqsByCategory(faqs);

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-[2rem] border border-yellow-100 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.32),_transparent_36%),linear-gradient(135deg,#ffffff_0%,#f4faff_52%,#fef3c7_100%)] p-6 shadow-[0_28px_70px_-48px_rgba(14,116,194,0.45)]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-700">Website Content</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-5xl">
            Edit only the landing-page sections
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            This editor now follows the landing page navigation only: Home, About, Services, Blog, Videos, and FAQ.
            Actual blogs, vlogs, and live schedule entries are still created in the Content Creator workspace.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-white transition hover:bg-yellow-400"
            >
              Preview landing page
              <FaArrowUpRightFromSquare className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.kind === "ok"
              ? "border border-yellow-200 bg-yellow-50 text-yellow-700"
              : "border border-yellow-200 bg-yellow-50 text-yellow-800"
          }`}
        >
          {feedback.kind === "ok" ? (
            <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          ) : (
            <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden="true" />
          )}
          <span>{feedback.msg}</span>
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-yellow-100 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-[1.35rem] px-4 py-4 text-left transition ${
                  active
                    ? "bg-[linear-gradient(135deg,#A16207_0%,#854D0E_100%)] text-white shadow-[0_16px_35px_-20px_rgba(120,53,15,0.7)]"
                    : "bg-slate-50 text-slate-800 hover:bg-yellow-50"
                }`}
              >
                <p className="text-sm font-black tracking-tight">{tab.label}</p>
                <p className={`mt-1 text-xs leading-5 ${active ? "text-amber-50" : "text-slate-500"}`}>{tab.detail}</p>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "home" ? (
        <EditorSection title="Home / Hero" note="This is the Home section from the landing page navigation.">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Field label="Eyebrow" value={content.hero_eyebrow ?? ""} onChange={(value) => update("hero_eyebrow", value)} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title line 1" value={content.hero_title_line1 ?? ""} onChange={(value) => update("hero_title_line1", value)} />
                <Field label="Title line 2" value={content.hero_title_line2 ?? ""} onChange={(value) => update("hero_title_line2", value)} />
              </div>
              <Textarea label="Subtitle" rows={4} value={content.hero_subtitle ?? ""} onChange={(value) => update("hero_subtitle", value)} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Primary CTA label" value={content.hero_cta_primary ?? ""} onChange={(value) => update("hero_cta_primary", value)} />
                <Field label="Secondary CTA label" value={content.hero_cta_secondary ?? ""} onChange={(value) => update("hero_cta_secondary", value)} />
              </div>
              <ImageUploader
                kind="hero-bg"
                label="Hero background image"
                hint="This is the full landing-page Home background."
                currentUrl={content.hero_background_url}
                defaultUrl={DEFAULT_HERO}
                accessToken={accessToken}
                onChange={(url) => update("hero_background_url", url)}
                onError={(msg) => setFeedback({ kind: "err", msg })}
              />
            </div>

            <PreviewCard title="Home Preview">
              <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-black">
                <div className="relative min-h-[320px]">
                  <Image src={content.hero_background_url || DEFAULT_HERO} alt="Hero preview" fill unoptimized className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-slate-950/35 to-amber-800/20" />
                  <div className="relative flex min-h-[320px] flex-col justify-end px-5 py-6 text-white">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">{content.hero_eyebrow}</p>
                    <h3 className="mt-3 text-3xl font-black leading-tight">
                      {content.hero_title_line1}
                      <br />
                      {content.hero_title_line2}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-200">{content.hero_subtitle}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-yellow-300 px-4 py-2 text-xs font-bold text-white">{content.hero_cta_primary}</span>
                      <span className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white">{content.hero_cta_secondary}</span>
                    </div>
                  </div>
                </div>
              </div>
            </PreviewCard>
          </div>
        </EditorSection>
      ) : null}

      {activeTab === "about" ? (
        <EditorSection title="About" note="This is the About section from the landing page navigation.">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Field label="Eyebrow" value={content.about_eyebrow ?? ""} onChange={(value) => update("about_eyebrow", value)} />
              <Field label="Section title" value={content.about_title ?? ""} onChange={(value) => update("about_title", value)} />
              <Textarea label="Section description" rows={4} value={content.about_subtitle ?? ""} onChange={(value) => update("about_subtitle", value)} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Doctor name" value={content.doctor_name ?? ""} onChange={(value) => update("doctor_name", value)} />
                <Field label="Doctor title" value={content.doctor_title ?? ""} onChange={(value) => update("doctor_title", value)} />
              </div>
              <div className="max-w-[320px]">
                <ImageUploader
                  kind="doctor-photo"
                  label="Doctor photo"
                  hint="This appears in the landing-page About section."
                  currentUrl={content.doctor_photo_url}
                  defaultUrl={DEFAULT_DOCTOR}
                  accessToken={accessToken}
                  onChange={(url) => update("doctor_photo_url", url)}
                  onError={(msg) => setFeedback({ kind: "err", msg })}
                  aspect="portrait"
                />
              </div>
              <div className="rounded-[1.5rem] border border-yellow-100 bg-yellow-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">About highlights</p>
                    <p className="mt-1 text-sm text-slate-600">
                      These cards show on the landing-page About section and now mirror the updated profile details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addAboutHighlight}
                    className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-4 py-2 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
                  >
                    <FaPlus className="h-3 w-3" aria-hidden="true" />
                    Add card
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {ensureAboutHighlights(content.about_highlights).map((item, index) => (
                    <div key={`${item.title}-${index}`} className="rounded-[1.4rem] border border-yellow-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">Card {index + 1}</p>
                        <RemoveButton onClick={() => removeAboutHighlight(index)} title="Remove about card" compact />
                      </div>
                      <div className="mt-3 space-y-3">
                        <Field label="Title" value={item.title} onChange={(value) => updateAboutHighlight(index, { title: value })} />
                        <Textarea label="Body" rows={3} value={item.body} onChange={(value) => updateAboutHighlight(index, { body: value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <PreviewCard title="About Preview">
              <div className="rounded-[1.6rem] border border-yellow-100 bg-white p-4 shadow-sm">
                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[1.3rem] border border-yellow-100 bg-yellow-50 p-3">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-white">
                      <Image src={content.doctor_photo_url || DEFAULT_DOCTOR} alt="Doctor preview" fill unoptimized className="object-contain" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-700">{content.about_eyebrow}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{content.about_title}</h3>
                    <p className="mt-2 text-sm font-semibold text-yellow-700">
                      {content.doctor_name}
                      {content.doctor_title ? `, ${content.doctor_title}` : ""}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{content.about_subtitle}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {ensureAboutHighlights(content.about_highlights).map((item, index) => (
                        <div key={`${item.title}-${index}`} className="rounded-2xl border border-yellow-100 bg-yellow-50/50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-700">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </PreviewCard>
          </div>
        </EditorSection>
      ) : null}

      {activeTab === "services" ? (
        <EditorSection
          title="Services"
          note="This edits only the landing-page services section: eyebrow, title, subtitle, and the service cards. You can also add more service cards here."
          action={
            <button
              type="button"
              onClick={addService}
              className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-bold text-yellow-700 transition hover:bg-yellow-100"
            >
              <FaPlus className="h-3 w-3" aria-hidden="true" />
              Add service card
            </button>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_500px]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Services eyebrow" value={content.services_eyebrow ?? ""} onChange={(value) => update("services_eyebrow", value)} />
                <Field label="Services title" value={content.services_title ?? ""} onChange={(value) => update("services_title", value)} />
                <Field label="Services subtitle" value={content.services_subtitle ?? ""} onChange={(value) => update("services_subtitle", value)} />
              </div>

              {content.services.map((service, index) => (
                <div key={`${service.title}-${index}`} className="rounded-[1.2rem] border border-yellow-100 bg-slate-50/70 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid flex-1 gap-2.5 md:grid-cols-[118px_minmax(0,1fr)]">
                      <KindSelect value={service.kind} onChange={(value) => updateService(index, { kind: value })} />
                      <div className="grid gap-2.5">
                        <Field label="Card title" value={service.title} onChange={(value) => updateService(index, { title: value })} />
                        <Textarea label="Card description" rows={2} value={service.description} onChange={(value) => updateService(index, { description: value })} />
                      </div>
                    </div>
                    <RemoveButton onClick={() => removeService(index)} title="Remove service card" compact />
                  </div>
                </div>
              ))}
            </div>

            <PreviewCard title="Services Preview">
              <div className="rounded-[1.7rem] border border-yellow-100 bg-yellow-50/40 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-700">{content.services_eyebrow || "Services"}</p>
                <h3 className="mt-3 text-3xl font-black tracking-tight text-black">{content.services_title || "Clinic and online services"}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{content.services_subtitle || "Review available services before booking."}</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {content.services.map((service, index) => (
                    <div key={`${service.title}-${index}`} className="rounded-[1.5rem] border border-yellow-100 bg-white p-5 shadow-sm">
                      <div className="inline-flex rounded-full bg-yellow-100 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-700">
                        {service.kind || "Service"}
                      </div>
                      <h4 className="mt-4 text-xl font-black tracking-tight text-black">{service.title || "Service title"}</h4>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{service.description || "Service description appears here."}</p>
                    </div>
                  ))}
                </div>
              </div>
            </PreviewCard>
          </div>
        </EditorSection>
      ) : null}

      {activeTab === "blog" ? (
        <EditorSection
          title="Blog"
          note="Only the landing blog texts and labels are editable here. The actual blog posts stay in the Blog Builder inside Content Creator."
          action={
            <Link
              href="/creator-content"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-yellow-400"
            >
              Open Blog Builder
              <FaArrowUpRightFromSquare className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Field label="Eyebrow" value={content.blog_eyebrow ?? "Blogs"} onChange={(value) => update("blog_eyebrow", value)} />
              <Field label="Title" value={content.blog_title ?? "Fresh health tips from the clinic"} onChange={(value) => update("blog_title", value)} />
              <Textarea label="Subtitle" rows={4} value={content.blog_subtitle ?? ""} onChange={(value) => update("blog_subtitle", value)} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Categories heading" value={content.blog_categories_title ?? "Categories"} onChange={(value) => update("blog_categories_title", value)} />
                <Field label="Recent posts heading" value={content.blog_recent_posts_title ?? "Recent Posts"} onChange={(value) => update("blog_recent_posts_title", value)} />
              </div>
              <StringListEditor
                label="Categories"
                items={blogCategories}
                onAdd={addBlogCategory}
                onRemove={removeBlogCategory}
                onChange={updateBlogCategory}
              />
            </div>

            <PreviewCard title="Blog Preview">
              <div className="rounded-[1.6rem] border border-yellow-100 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-700">{content.blog_eyebrow ?? "Blogs"}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{content.blog_title ?? "Fresh health tips from the clinic"}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{content.blog_subtitle}</p>
                <div className="mt-5 grid gap-4">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)] lg:items-center">
                      <div className="h-24 rounded-[1rem] bg-yellow-100" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">Health Tips</p>
                        <h4 className="mt-2 text-xl font-black tracking-tight text-black">Preview blog title from Content Creator</h4>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.3rem] border border-yellow-100 bg-yellow-50 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-700">{content.blog_categories_title ?? "Categories"}</p>
                      <ul className="mt-4 space-y-2">
                        {blogCategories.map((category) => (
                          <li key={category} className="border-b border-yellow-100 pb-2 text-sm font-semibold text-slate-700 last:border-b-0 last:pb-0">
                            {category}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-700">{content.blog_recent_posts_title ?? "Recent Posts"}</p>
                      <div className="mt-4 space-y-3">
                        {[1, 2].map((item) => (
                          <div key={item} className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-slate-100" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">Recent blog preview</p>
                              <p className="text-xs text-slate-500">May 28, 2026</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PreviewCard>
          </div>
        </EditorSection>
      ) : null}

      {activeTab === "videos" ? (
        <EditorSection
          title="Videos"
          note="Only the landing texts for vlogs and live schedule are editable here. The actual videos and live events stay in Content Creator."
          action={
            <Link
              href="/creator-content"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-white transition hover:bg-yellow-400"
            >
              Open Content Creator
              <FaArrowUpRightFromSquare className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <Field label="Videos eyebrow" value={content.videos_eyebrow ?? "Videos"} onChange={(value) => update("videos_eyebrow", value)} />
              <Field label="Videos title" value={content.videos_title ?? ""} onChange={(value) => update("videos_title", value)} />
              <Textarea label="Videos subtitle" rows={4} value={content.videos_subtitle ?? ""} onChange={(value) => update("videos_subtitle", value)} />
              <div className="rounded-[1.35rem] border border-yellow-100 bg-yellow-50/60 p-4">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                  <FaCalendarDays className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-black tracking-tight text-black">Live schedule copy</p>
                <div className="mt-4 space-y-4">
                  <Field label="Live eyebrow" value={content.live_eyebrow ?? "Live Schedule"} onChange={(value) => update("live_eyebrow", value)} />
                  <Field label="Live title" value={content.live_title ?? ""} onChange={(value) => update("live_title", value)} />
                  <Textarea label="Live subtitle" rows={4} value={content.live_subtitle ?? ""} onChange={(value) => update("live_subtitle", value)} />
                  <Field label="Live CTA label" value={content.live_cta_label ?? "Open live schedule page"} onChange={(value) => update("live_cta_label", value)} />
                </div>
              </div>
            </div>

            <PreviewCard title="Videos Preview">
              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-yellow-100 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-700">{content.videos_eyebrow ?? "Videos"}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{content.videos_title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{content.videos_subtitle}</p>
                  <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                    <div className="h-32 rounded-t-[1.5rem] bg-yellow-100" />
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        <span>Video</span>
                        <span>Health Tips</span>
                      </div>
                      <h4 className="mt-3 text-xl font-black tracking-tight text-black">Preview vlog title from Content Creator</h4>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-yellow-100 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-700">{content.live_eyebrow ?? "Live Schedule"}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-black">{content.live_title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{content.live_subtitle}</p>
                  <div className="mt-5 inline-flex rounded-full border border-yellow-200 px-4 py-2 text-sm font-bold text-yellow-700">
                    {content.live_cta_label ?? "Open live schedule page"}
                  </div>
                </div>
              </div>
            </PreviewCard>
          </div>
        </EditorSection>
      ) : null}

      {activeTab === "faq" ? (
        <EditorSection title="FAQ" note="These FAQs appear on the landing page and the public FAQ page.">
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-[1.6rem] border border-yellow-100 bg-yellow-50/60 p-5">
              <p className="text-sm font-black tracking-tight text-black">Add a new FAQ</p>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Category</span>
                  <select
                    value={faqForm.category}
                    onChange={(event) => setFaqForm((current) => ({ ...current, category: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-yellow-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  >
                    {faqCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <Field label="Question" value={faqForm.question} onChange={(value) => setFaqForm((current) => ({ ...current, question: value }))} />
                <Textarea label="Answer" rows={4} value={faqForm.answer} onChange={(value) => setFaqForm((current) => ({ ...current, answer: value }))} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Sort order" value={faqForm.sort_order} onChange={(value) => setFaqForm((current) => ({ ...current, sort_order: value }))} />
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Visibility</span>
                    <select
                      value={faqForm.is_published ? "published" : "hidden"}
                      onChange={(event) => setFaqForm((current) => ({ ...current, is_published: event.target.value === "published" }))}
                      className="mt-1.5 w-full rounded-xl border border-yellow-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddFaq()}
                  className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-yellow-400"
                >
                  <FaPlus className="h-3 w-3" aria-hidden="true" />
                  Save FAQ
                </button>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-yellow-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {faqGroups.map((group) => (
                  <span key={group.category} className="rounded-full border border-yellow-100 bg-yellow-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-yellow-700">
                    {group.category}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {faqGroups.map((group) => (
                  <div key={group.category} className="rounded-[1.4rem] border border-yellow-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">FAQ Category</p>
                        <h3 className="mt-2 text-xl font-black tracking-tight text-black">{group.category}</h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.items.map((faq) => (
                        <details key={faq.id} className="rounded-[1.15rem] border border-slate-200 bg-white p-4">
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-black">{faq.question}</p>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {faq.is_published ? "Published" : "Hidden"}
                                </p>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                            <Field
                              label="Question"
                              value={faq.question}
                              onChange={(value) => setFaqs((current) => current.map((item) => (item.id === faq.id ? { ...item, question: value } : item)))}
                            />
                            <Textarea
                              label="Answer"
                              rows={4}
                              value={faq.answer}
                              onChange={(value) => setFaqs((current) => current.map((item) => (item.id === faq.id ? { ...item, answer: value } : item)))}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentFaq = faqs.find((item) => item.id === faq.id);
                                  if (!currentFaq) return;
                                  void handleUpdateFaq(faq.id, { question: currentFaq.question, answer: currentFaq.answer }, "FAQ updated.");
                                }}
                                className="rounded-full border border-yellow-200 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-700 transition hover:bg-yellow-100"
                              >
                                Save changes
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleUpdateFaq(faq.id, { is_published: !faq.is_published }, faq.is_published ? "FAQ hidden." : "FAQ published.");
                                }}
                                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                {faq.is_published ? "Hide" : "Publish"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteFaq(faq.id);
                                }}
                                className="rounded-full border border-yellow-200 bg-white px-3.5 py-1.5 text-xs font-bold text-yellow-700 transition hover:bg-yellow-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </EditorSection>
      ) : null}

      <div className="sticky bottom-4 z-30 mt-2 flex flex-col items-stretch gap-3 rounded-2xl border border-yellow-100 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs font-semibold ${dirty ? "text-yellow-700" : "text-slate-500"}`}>
          {dirty ? "Unsaved landing-page changes" : "Landing-page content is up to date"}
        </p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || saving}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-full bg-yellow-400 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save website content"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function fetchFaqs(accessToken: string) {
  const res = await fetch("/api/v2/faqs", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FAQ HTTP ${res.status}`);
  const payload = (await res.json()) as { faqs?: Faq[] };
  return payload.faqs ?? [];
}

function groupFaqsByCategory(faqs: Faq[]) {
  const grouped = new Map<string, Faq[]>();
  for (const faq of [...faqs].sort((a, b) => a.sort_order - b.sort_order)) {
    const items = grouped.get(faq.category) ?? [];
    items.push(faq);
    grouped.set(faq.category, items);
  }
  return Array.from(grouped.entries()).map(([category, items]) => ({ category, items }));
}

function normalizeLandingContent(content: LandingContent): LandingContent {
  const normalizedHighlights = ensureAboutHighlights(content.about_highlights);
  const normalizedServices = content.services.length
    ? content.services
    : clinicServices.map((service, index) => ({
        kind: index === 1 ? "online" : index === clinicServices.length - 1 ? "wellness" : "clinic",
        title: service.title,
        description: service.description,
        bullets: [],
      }));

  if (
    content.services.length
    && JSON.stringify(normalizedHighlights) === JSON.stringify(content.about_highlights ?? [])
  ) {
    return content;
  }

  return {
    ...content,
    about_highlights: normalizedHighlights,
    services: normalizedServices,
  };
}

function ensureAboutHighlights(highlights?: LandingHighlight[] | null) {
  const normalized = (highlights ?? [])
    .map((item) => ({
      title: String(item.title ?? "").trim(),
      body: String(item.body ?? "").trim(),
    }))
    .filter((item) => item.title || item.body);
  return normalized.length ? normalized : DEFAULT_ABOUT_HIGHLIGHTS;
}

function EditorSection({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-100 bg-white p-5 shadow-[0_16px_45px_-38px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-yellow-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-black">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{note}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-[1.7rem] border border-yellow-100 bg-[linear-gradient(180deg,#f8fcff_0%,#edf7ff_100%)] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-700">{title}</p>
      <div className="mt-3">{children}</div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-yellow-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-xl border border-yellow-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

function ImageUploader({
  kind,
  label,
  hint,
  currentUrl,
  defaultUrl,
  accessToken,
  onChange,
  onError,
  aspect = "landscape",
}: {
  kind: "hero-bg" | "doctor-photo";
  label: string;
  hint: string;
  currentUrl: string | null;
  defaultUrl: string;
  accessToken: string | null;
  onChange: (url: string | null) => void;
  onError: (msg: string) => void;
  aspect?: "landscape" | "portrait";
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    if (!accessToken) {
      onError("Sign in again to upload images.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const res = await fetch("/api/v2/landing-content/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload.url) throw new Error(payload.message ?? "Upload failed");
      onChange(payload.url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-[1.4rem] border border-yellow-100 bg-yellow-50/60 p-4">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {kind === "doctor-photo" ? <FaUserDoctor className="h-3 w-3" aria-hidden="true" /> : <FaNewspaper className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{hint}</p>
      <div className={`relative mt-4 overflow-hidden rounded-[1.25rem] border border-yellow-100 bg-white ${aspect === "portrait" ? "aspect-[3/4]" : "aspect-[16/9]"}`}>
        <Image src={currentUrl || defaultUrl} alt={label} fill unoptimized className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaCloudArrowUp className="h-3 w-3" aria-hidden="true" />
          {uploading ? "Uploading..." : currentUrl ? "Replace image" : "Upload image"}
        </button>
        {currentUrl ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Use default
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
    </div>
  );
}

function KindSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Type</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-yellow-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        <option value="clinic">Clinic</option>
        <option value="online">Online</option>
        <option value="wellness">Wellness</option>
        <option value="doctor">Doctor</option>
        <option value="other">Other</option>
      </select>
    </label>
  );
}

function StringListEditor({
  label,
  items,
  onAdd,
  onRemove,
  onChange,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-yellow-100 bg-yellow-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          <FaFolderOpen className="h-3 w-3 text-yellow-700" aria-hidden="true" />
          {label}
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-white px-3 py-1.5 text-xs font-bold text-yellow-700 transition hover:bg-yellow-50"
        >
          <FaPlus className="h-2.5 w-2.5" aria-hidden="true" />
          Add
        </button>
      </div>
      <div className="space-y-2">
        {items.map((value, index) => (
          <div key={`${value}-${index}`} className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
              className="flex-1 rounded-xl border border-yellow-100 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <RemoveButton onClick={() => onRemove(index)} title="Remove category" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RemoveButton({
  onClick,
  title,
  compact = false,
}: {
  onClick: () => void;
  title: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-yellow-200 bg-white text-yellow-600 transition hover:border-yellow-300 hover:bg-yellow-50 ${
        compact ? "p-1.5" : "p-2"
      }`}
      title={title}
    >
      <FaTrash className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true" />
    </button>
  );
}
