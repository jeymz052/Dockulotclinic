import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor } from "@/src/lib/http";
import type {
  LandingContent,
  LandingHowToStep,
  LandingHighlight,
  LandingNavItem,
  LandingProgramSlide,
  LandingService,
  LandingServiceBullet,
  LandingTestimonial,
} from "@/src/lib/db/types";

// Generic patch shape — every editable column appears here as an optional.
// JSONB columns are typed against their array shape; the service then
// sanitizes per-array before persisting.
export type LandingContentInput = Partial<
  Omit<
    LandingContent,
    | "id"
    | "updated_at"
    | "updated_by"
    | "about_highlights"
    | "testimonials"
    | "nav_items"
    | "program_slides"
    | "services"
    | "blog_categories"
    | "how_to_steps"
    | "footer_services"
    | "footer_hours"
  >
> & {
  about_highlights?: LandingHighlight[];
  testimonials?: LandingTestimonial[];
  nav_items?: LandingNavItem[];
  program_slides?: LandingProgramSlide[];
  services?: LandingService[];
  blog_categories?: string[];
  how_to_steps?: LandingHowToStep[];
  footer_services?: string[];
  footer_hours?: string[];
};

const ALLOW_ROLES = new Set(["super_admin", "admin", "staff", "secretary", "doctor"]);

function ensureCanEdit(actor: Actor) {
  if (!ALLOW_ROLES.has(actor.profile.role)) {
    throw new HttpError(403, "Only clinic staff can edit landing content");
  }
}

// Read is public — the landing page hydrates without a session, and the
// row is a singleton, so no input validation is needed.
export async function getLandingContent(): Promise<LandingContent> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("landing_content")
    .select("*")
    .eq("id", true)
    .maybeSingle<LandingContent>();
  if (error) throw error;
  if (!data) {
    // The migration seeds this row, but we recover gracefully if a fresh
    // env hasn't been migrated yet by inserting on demand.
    const { data: inserted, error: insertError } = await supabase
      .from("landing_content")
      .insert({ id: true })
      .select("*")
      .single<LandingContent>();
    if (insertError) throw insertError;
    return inserted;
  }
  return data;
}

function sanitizeTestimonials(items: LandingTestimonial[]): LandingTestimonial[] {
  return items
    .map((t) => ({
      name: String(t.name ?? "").trim(),
      title: String(t.title ?? "").trim(),
      quote: String(t.quote ?? "").trim(),
    }))
    .filter((t) => t.name && t.quote);
}

export async function updateLandingContent(
  input: LandingContentInput,
  actor: Actor,
): Promise<LandingContent> {
  ensureCanEdit(actor);

  // Whitelist the columns we accept so a malicious caller can't sneak in
  // updated_by/id/etc.
  const patch: Record<string, unknown> = {};
  const TEXT_FIELDS: Array<keyof LandingContent> = [
    "hero_eyebrow",
    "hero_title_line1",
    "hero_title_line2",
    "hero_subtitle",
    "hero_cta_primary",
    "hero_cta_secondary",
    "about_eyebrow",
    "about_title",
    "about_subtitle",
    "doctor_name",
    "doctor_title",
    "feature_1_title",
    "feature_1_body",
    "feature_2_title",
    "feature_2_body",
    "feature_3_title",
    "feature_3_body",
    "cta_title",
    "cta_subtitle",
    "cta_button_label",
    // Phase 2 text fields
    "services_eyebrow",
    "services_title",
    "services_subtitle",
    "blog_eyebrow",
    "blog_title",
    "blog_subtitle",
    "blog_categories_title",
    "blog_recent_posts_title",
    "videos_eyebrow",
    "videos_title",
    "videos_subtitle",
    "live_eyebrow",
    "live_title",
    "live_subtitle",
    "live_cta_label",
    "results_eyebrow",
    "results_title",
    "results_subtitle",
    "faq_eyebrow",
    "faq_title",
    "faq_subtitle",
    "how_to_eyebrow",
    "how_to_title",
    "testimonials_eyebrow",
    "testimonials_title",
    "testimonials_subtitle",
    "booking_title",
    "booking_subtitle",
    "contact_eyebrow",
    "contact_title",
    "contact_subtitle",
    "contact_info_title",
    "contact_hours_label",
    "contact_facebook_label",
    "contact_facebook_url",
    "contact_youtube_label",
    "contact_youtube_url",
    "footer_brand_blurb",
    "footer_contact_text",
    "footer_copyright",
  ];
  for (const f of TEXT_FIELDS) {
    if (f in input) {
      const v = (input as Record<string, unknown>)[f];
      // Treat undefined as "not provided"; allow empty string for clearing.
      if (typeof v === "string") patch[f] = v;
    }
  }

  // URL fields — null clears, string sets.
  for (const f of ["hero_background_url", "doctor_photo_url"] as const) {
    if (f in input) {
      const v = (input as Record<string, unknown>)[f];
      if (v === null || typeof v === "string") patch[f] = v;
    }
  }

  if (input.testimonials !== undefined) {
    if (!Array.isArray(input.testimonials)) {
      throw new HttpError(400, "testimonials must be an array");
    }
    patch.testimonials = sanitizeTestimonials(input.testimonials);
  }

  // Phase 2 JSONB arrays — sanitize each shape so we never persist
  // null fields or absurd payloads (eg. nested objects in a string list).
  if (input.nav_items !== undefined) {
    if (!Array.isArray(input.nav_items)) throw new HttpError(400, "nav_items must be an array");
    patch.nav_items = input.nav_items
      .map((n): LandingNavItem => ({
        label: String(n.label ?? "").trim(),
        href: String(n.href ?? "").trim() || "#",
      }))
      .filter((n) => n.label);
  }

  if (input.services !== undefined) {
    if (!Array.isArray(input.services)) throw new HttpError(400, "services must be an array");
    patch.services = input.services.map((s): LandingService => ({
      kind: typeof s.kind === "string" && s.kind ? s.kind : "clinic",
      title: String(s.title ?? "").trim(),
      description: String(s.description ?? "").trim(),
      bullets: Array.isArray(s.bullets)
        ? s.bullets
            .map((b): LandingServiceBullet => ({
              title: String(b.title ?? "").trim(),
              body: String(b.body ?? "").trim(),
            }))
            .filter((b) => b.title || b.body)
        : [],
    }));
  }

  if (input.program_slides !== undefined) {
    if (!Array.isArray(input.program_slides)) throw new HttpError(400, "program_slides must be an array");
    patch.program_slides = input.program_slides
      .map((s): LandingProgramSlide => ({
        key: String(s.key ?? "").trim() || "program",
        name: String(s.name ?? "").trim(),
        description: String(s.description ?? "").trim(),
        ctaLabel: String(s.ctaLabel ?? "").trim() || "Book a consultation",
      }))
      .filter((s) => s.name || s.description);
  }

  if (input.about_highlights !== undefined) {
    if (!Array.isArray(input.about_highlights)) throw new HttpError(400, "about_highlights must be an array");
    patch.about_highlights = input.about_highlights
      .map((item): LandingHighlight => ({
        title: String(item.title ?? "").trim(),
        body: String(item.body ?? "").trim(),
      }))
      .filter((item) => item.title || item.body);
  }

  if (input.blog_categories !== undefined) {
    if (!Array.isArray(input.blog_categories)) throw new HttpError(400, "blog_categories must be an array");
    patch.blog_categories = input.blog_categories.map((value) => String(value ?? "").trim()).filter(Boolean);
  }

  if (input.how_to_steps !== undefined) {
    if (!Array.isArray(input.how_to_steps)) throw new HttpError(400, "how_to_steps must be an array");
    patch.how_to_steps = input.how_to_steps.map((s, i): LandingHowToStep => ({
      // Renumber on save so the public site never shows gaps if the
      // owner deleted a middle step.
      step: i + 1,
      title: String(s.title ?? "").trim(),
      description: String(s.description ?? "").trim(),
    }));
  }

  if (input.footer_services !== undefined) {
    if (!Array.isArray(input.footer_services)) throw new HttpError(400, "footer_services must be an array");
    patch.footer_services = input.footer_services
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }

  if (input.footer_hours !== undefined) {
    if (!Array.isArray(input.footer_hours)) throw new HttpError(400, "footer_hours must be an array");
    patch.footer_hours = input.footer_hours
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }

  patch.updated_by = actor.id;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("landing_content")
    .update(patch)
    .eq("id", true)
    .select("*")
    .single<LandingContent>();
  if (error) throw error;
  return data;
}

// Upload an image to the public `landing-assets` bucket and return the
// public URL. We always overwrite the *target* file (hero-bg / doctor-photo)
// — this avoids unbounded disk growth on the bucket and means we don't need
// to clean up old files on update.
export async function uploadLandingImage(
  kind: "hero-bg" | "doctor-photo",
  file: File,
  actor: Actor,
): Promise<{ url: string; path: string }> {
  ensureCanEdit(actor);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const allowed = ["png", "jpg", "jpeg", "webp", "avif", "gif"];
  if (!allowed.includes(ext)) {
    throw new HttpError(400, `Unsupported image type: .${ext}`);
  }
  // Cap matches the bucket's file_size_limit (10 MiB). Server-side check so
  // we fail fast with a friendly message instead of relying on a vague
  // storage error.
  if (file.size > 10 * 1024 * 1024) {
    throw new HttpError(400, "Image must be 10 MB or smaller");
  }

  // Cache-busting suffix in the path: when the doctor uploads a new photo,
  // we want browsers / CDNs to fetch the new bytes immediately. Without
  // this, hitting the same URL would serve stale content.
  const path = `${kind}-${Date.now()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("landing-assets")
    .upload(path, buffer, {
      contentType: file.type || `image/${ext}`,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from("landing-assets").getPublicUrl(path);
  return { url: pub.publicUrl, path };
}
