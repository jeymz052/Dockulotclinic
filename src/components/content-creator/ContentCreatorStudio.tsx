"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  FaArrowRight,
  FaCalendarDays,
  FaCirclePlay,
  FaEye,
  FaFloppyDisk,
  FaLink,
  FaRadio,
  FaTrash,
  FaVideo,
} from "react-icons/fa6";
import BlogPostStudio from "@/src/components/blog/editor/BlogPostStudio";
import { useRole } from "@/src/components/layout/RoleProvider";
import { contentCategories } from "@/src/lib/healthcare-content";
import { getPublicVideoThumbnail } from "@/src/lib/video-media";

type CreatorTab = "blog" | "videos" | "live";

type StoredPost = {
  id: string;
  title: string;
  slug: string;
  content_type: string;
  category: string;
  excerpt: string | null;
  thumbnail_url: string | null;
  embed_url: string | null;
  status: string;
  is_featured: boolean;
  body: string | null;
  published_at: string | null;
  created_at: string;
};

type VideoDraft = {
  id?: string;
  title: string;
  slug: string;
  content_type: string;
  category: string;
  excerpt: string;
  thumbnail_url: string;
  embed_url: string;
  status: string;
  is_featured: boolean;
  body: string;
};

type LiveEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  platform: string | null;
  live_url: string | null;
  replay_post_id: string | null;
  registration_enabled: boolean;
  status: string;
  content_posts?: {
    title: string;
    slug: string;
  } | null;
};

type LiveEventDraft = {
  id?: string;
  title: string;
  description: string;
  starts_at: string;
  platform: string;
  live_url: string;
  replay_post_id: string;
  registration_enabled: boolean;
  status: string;
};

const videoTypes = ["Video", "Announcement", "LiveReplay"];
const livePlatforms = ["Facebook Live", "YouTube Live", "TikTok Live", "Zoom Webinar", "Clinic Event"];
const liveStatuses = ["Upcoming", "Live", "Completed", "Cancelled"];
const liveTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4)
    .toString()
    .padStart(2, "0");
  const minutes = ((index % 4) * 15).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

const emptyVideoDraft: VideoDraft = {
  title: "",
  slug: "",
  content_type: "Video",
  category: contentCategories[0],
  excerpt: "",
  thumbnail_url: "",
  embed_url: "",
  status: "Draft",
  is_featured: false,
  body: "",
};

const emptyLiveDraft: LiveEventDraft = {
  title: "",
  description: "",
  starts_at: "",
  platform: livePlatforms[0],
  live_url: "",
  replay_post_id: "",
  registration_enabled: true,
  status: "Upcoming",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not published";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Schedule not set";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function getLiveDatePart(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getLiveTimePart(value: string) {
  if (!value) return "";
  return value.slice(11, 16);
}

function mergeLiveScheduleParts(datePart: string, timePart: string) {
  if (!datePart) return "";
  return `${datePart}T${timePart || "09:00"}`;
}

function statusTone(status: string) {
  if (status === "Published" || status === "Live") return "border-neutral-200 bg-neutral-50 text-neutral-700";
  if (status === "Archived" || status === "Cancelled") return "border-neutral-200 bg-neutral-100 text-neutral-700";
  if (status === "Completed") return "border-neutral-100 bg-neutral-50 text-neutral-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function Surface({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-neutral-200 bg-white/95 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-black">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-neutral-700">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="text-xs font-medium text-neutral-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function MediaImageUploader({
  accessToken,
  currentUrl,
  label,
  helper,
  onChange,
  onError,
}: {
  accessToken: string | null;
  currentUrl: string;
  label: string;
  helper: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
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
      form.append("file", file);
      const response = await fetch("/api/v2/content-posts/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.message ?? "Upload failed");
      }
      onChange(payload.url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">{label}</p>
          <p className="mt-1 text-xs text-neutral-500">{helper}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading..." : currentUrl ? "Replace image" : "Upload image"}
          </button>
          {currentUrl ? (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={uploading}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-neutral-200 bg-white">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Uploaded media preview" className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-neutral-100 text-sm font-semibold text-neutral-500">
            No image uploaded yet
          </div>
        )}
      </div>

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
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof FaVideo;
  label: string;
  onClick: () => void;
}) {
  return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-[3.75rem] min-w-[200px] flex-1 items-center justify-center gap-3 rounded-[1.2rem] border px-5 py-4 text-center transition ${
        active
          ? "border-neutral-300 bg-[linear-gradient(135deg,#111111_0%,#2b2b2b_100%)] text-white shadow-[0_18px_35px_-22px_rgba(17,17,17,0.75)]"
          : "border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f5_100%)] text-neutral-700 shadow-[0_14px_30px_-24px_rgba(17,17,17,0.22)] hover:border-neutral-300 hover:bg-[linear-gradient(180deg,#ffffff_0%,#f2f2f2_100%)] hover:text-neutral-900"
      }`}
    >
      <span
        className={`rounded-full p-2 ${
          active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-800"
        }`}
      >
        <Icon />
      </span>
      <span className="text-base font-black tracking-tight">{label}</span>
    </button>
  );
}

export default function ContentCreatorStudio() {
  const { accessToken } = useRole();
  const [activeTab, setActiveTab] = useState<CreatorTab>("blog");
  const [contentPosts, setContentPosts] = useState<StoredPost[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [videoDraft, setVideoDraft] = useState<VideoDraft>(emptyVideoDraft);
  const [liveDraft, setLiveDraft] = useState<LiveEventDraft>(emptyLiveDraft);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  const jsonHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken],
  );

  const mediaPosts = useMemo(
    () => contentPosts.filter((post) => videoTypes.includes(post.content_type)),
    [contentPosts],
  );

  const replayCandidates = useMemo(
    () => contentPosts.filter((post) => post.content_type === "LiveReplay" || post.content_type === "Video"),
    [contentPosts],
  );

  async function loadContentPosts() {
    if (!accessToken) return;
    const response = await fetch("/api/v2/content-posts", {
      headers: jsonHeaders,
      cache: "no-store",
    });
    if (!response.ok) {
      setFeedback("Unable to load creator content.");
      return;
    }
    const payload = (await response.json()) as { posts?: StoredPost[] };
    setContentPosts(payload.posts ?? []);
  }

  async function loadLiveEvents() {
    const response = await fetch("/api/v2/live-events", { cache: "no-store" });
    if (!response.ok) {
      setFeedback("Unable to load live schedule.");
      return;
    }
    const payload = (await response.json()) as { events?: LiveEvent[] };
    setLiveEvents(payload.events ?? []);
  }

  useEffect(() => {
    startTransition(() => {
      void loadContentPosts();
      void loadLiveEvents();
    });
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveVideoDraft(nextStatus?: string) {
    if (!accessToken) return;

    const payload = {
      title: videoDraft.title,
      slug: videoDraft.slug || slugify(videoDraft.title),
      content_type: videoDraft.content_type,
      category: videoDraft.category,
      excerpt: videoDraft.excerpt || null,
      thumbnail_url: videoDraft.thumbnail_url || null,
      embed_url: videoDraft.embed_url || null,
      status: nextStatus ?? videoDraft.status,
      is_featured: videoDraft.is_featured,
      body: videoDraft.body || null,
      blocks: [],
    };

    const endpoint = videoDraft.id ? `/api/v2/content-posts/${videoDraft.id}` : "/api/v2/content-posts";
    const method = videoDraft.id ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      setFeedback(result.message ?? "Unable to save video content.");
      return;
    }

    setFeedback(videoDraft.id ? "Video content updated." : "Video content created.");
    setVideoDraft(emptyVideoDraft);
    await loadContentPosts();
  }

  async function deletePost(id: string) {
    if (!accessToken) return;
    const response = await fetch(`/api/v2/content-posts/${id}`, {
      method: "DELETE",
      headers: jsonHeaders,
    });
    if (!response.ok) {
      setFeedback("Unable to delete the content item.");
      return;
    }
    if (videoDraft.id === id) {
      setVideoDraft(emptyVideoDraft);
    }
    setFeedback("Content item deleted.");
    await loadContentPosts();
  }

  async function updateStoredPostStatus(post: StoredPost, status: string) {
    if (!accessToken) return;
    const response = await fetch(`/api/v2/content-posts/${post.id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        title: post.title,
        slug: post.slug,
        content_type: post.content_type,
        category: post.category,
        excerpt: post.excerpt,
        thumbnail_url: post.thumbnail_url,
        embed_url: post.embed_url,
        status,
        is_featured: post.is_featured,
        body: post.body,
      }),
    });
    if (!response.ok) {
      setFeedback(`Unable to update "${post.title}".`);
      return;
    }
    setFeedback(`"${post.title}" is now ${status.toLowerCase()}.`);
    await loadContentPosts();
  }

  async function saveLiveDraft(nextStatus?: string) {
    if (!accessToken) return;

    if (!liveDraft.title.trim()) {
      setFeedback("Add a live title before saving the event.");
      return;
    }

    if (!liveDraft.starts_at) {
      setFeedback("Choose the live start date and time before saving the event.");
      return;
    }

    const startsAt =
      liveDraft.starts_at && !Number.isNaN(new Date(liveDraft.starts_at).getTime())
        ? new Date(liveDraft.starts_at).toISOString()
        : liveDraft.starts_at;

    const payload = {
      title: liveDraft.title,
      description: liveDraft.description || null,
      starts_at: startsAt,
      platform: liveDraft.platform || null,
      live_url: liveDraft.live_url || null,
      replay_post_id: liveDraft.replay_post_id || null,
      registration_enabled: liveDraft.registration_enabled,
      status: nextStatus ?? liveDraft.status,
    };

    const endpoint = liveDraft.id ? `/api/v2/live-events/${liveDraft.id}` : "/api/v2/live-events";
    const method = liveDraft.id ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      setFeedback(result.message ?? "Unable to save the live event.");
      return;
    }

    setFeedback(liveDraft.id ? "Live event updated." : "Live event created.");
    setLiveDraft(emptyLiveDraft);
    await loadLiveEvents();
  }

  async function deleteLiveEvent(id: string) {
    if (!accessToken) return;
    const response = await fetch(`/api/v2/live-events/${id}`, {
      method: "DELETE",
      headers: jsonHeaders,
    });
    if (!response.ok) {
      setFeedback("Unable to delete the live event.");
      return;
    }
    if (liveDraft.id === id) {
      setLiveDraft(emptyLiveDraft);
    }
    setFeedback("Live event deleted.");
    await loadLiveEvents();
  }

  async function updateLiveEventStatus(event: LiveEvent, status: string) {
    if (!accessToken) return;
    const response = await fetch(`/api/v2/live-events/${event.id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        platform: event.platform,
        live_url: event.live_url,
        replay_post_id: event.replay_post_id,
        registration_enabled: event.registration_enabled,
        status,
      }),
    });
    if (!response.ok) {
      setFeedback(`Unable to update "${event.title}".`);
      return;
    }
    setFeedback(`"${event.title}" is now ${status.toLowerCase()}.`);
    await loadLiveEvents();
  }

  return (
    <div className="min-h-screen space-y-6 bg-[linear-gradient(180deg,#fcf9ef_0%,#ffffff_38%,#f7f7f5_100%)] px-4 pb-10 pt-2 sm:px-6">
      <section className="relative overflow-hidden rounded-[2.75rem] border border-neutral-200 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.24),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_22%),linear-gradient(135deg,#111111_0%,#1f1f1f_34%,#2b2b2b_68%,#111111_100%)] px-6 py-8 text-white shadow-[0_40px_90px_-48px_rgba(17,17,17,0.58)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-10 top-6 h-28 w-28 rounded-full bg-neutral-300/20 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-24 w-56 rounded-full bg-neutral-200/10 blur-2xl" />
        </div>

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-100/95">Creator workspace</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl xl:text-[4.25rem]">
              Content Creator Platform
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-neutral-50/90 sm:text-lg">
              Build blog articles, doctor-vlogger video posts, and live health-talk schedules in one place. Everything
              published here is meant to surface on the public website and landing-page sections.
            </p>
          </div>

          <div className="w-full max-w-[430px] rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.08)_100%)] p-5 shadow-[0_22px_48px_-30px_rgba(17,17,17,0.75)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-100">Publishing snapshot</p>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-100">
                Live sync
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-3xl font-black text-white">{contentPosts.length}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-neutral-100/80">Total content posts</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4">
                <p className="text-3xl font-black text-white">{liveEvents.length}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-neutral-100/80">Live schedule entries</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-neutral-50/80">
              Keep blogs, vlogs, and live sessions aligned so public visitors always see the latest creator activity.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-[2rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f7_100%)] p-2.5 shadow-[0_24px_50px_-34px_rgba(17,17,17,0.22)] backdrop-blur">
        <div className="grid gap-2 md:grid-cols-3">
          <TabButton
            active={activeTab === "blog"}
            icon={FaEye}
            label="Blog Builder"
            onClick={() => setActiveTab("blog")}
          />
          <TabButton
            active={activeTab === "videos"}
            icon={FaCirclePlay}
            label="Videos / Vlogs"
            onClick={() => setActiveTab("videos")}
          />
          <TabButton
            active={activeTab === "live"}
            icon={FaRadio}
            label="Live Stream"
            onClick={() => setActiveTab("live")}
          />
        </div>
      </div>

      {feedback ? (
        <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
          {feedback}
        </div>
      ) : null}

      {activeTab === "blog" ? <BlogPostStudio /> : null}

      {activeTab === "videos" ? (
        <div className="space-y-6">
          <Surface
            title={videoDraft.id ? "Edit video content" : "Create video / vlog content"}
            description="Use this for doctor videos, live replays, and clinic announcements that should appear in the landing-page media section and public video page."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVideoDraft(emptyVideoDraft)}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Start fresh
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => void saveVideoDraft())}
                  disabled={isPending || !videoDraft.title.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  <FaFloppyDisk />
                  {videoDraft.id ? "Update content" : "Save content"}
                </button>
              </div>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Content type">
                  <select
                    value={videoDraft.content_type}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, content_type: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  >
                    {videoTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Category">
                  <select
                    value={videoDraft.category}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  >
                    {contentCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Headline" hint="Public title">
                  <input
                    value={videoDraft.title}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  />
                </Field>

                <Field label="Slug" hint="Auto-generated if blank">
                  <input
                    value={videoDraft.slug}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, slug: event.target.value }))}
                    placeholder="doctor-health-tip-video"
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Short summary" hint="Used on public cards">
                    <textarea
                      rows={4}
                      value={videoDraft.excerpt}
                      onChange={(event) => setVideoDraft((current) => ({ ...current, excerpt: event.target.value }))}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Embed URL" hint="YouTube, TikTok, or Facebook">
                    <input
                      value={videoDraft.embed_url}
                      onChange={(event) => setVideoDraft((current) => ({ ...current, embed_url: event.target.value }))}
                      placeholder="https://www.youtube.com/embed/..."
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Optional notes / body" hint="For announcements or replay context">
                    <textarea
                      rows={5}
                      value={videoDraft.body}
                      onChange={(event) => setVideoDraft((current) => ({ ...current, body: event.target.value }))}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <MediaImageUploader
                    accessToken={accessToken}
                    currentUrl={videoDraft.thumbnail_url}
                    label="Card thumbnail"
                    helper="Upload the preview image visitors will see on the landing page and the public video page. If you leave this blank, a YouTube thumbnail will be used automatically when available."
                    onChange={(url) => setVideoDraft((current) => ({ ...current, thumbnail_url: url }))}
                    onError={setFeedback}
                  />
                </div>

                <Field label="Status">
                  <select
                    value={videoDraft.status}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </Field>

                <label className="flex items-center gap-3 rounded-[1.35rem] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm font-semibold text-neutral-700">
                  <input
                    type="checkbox"
                    checked={videoDraft.is_featured}
                    onChange={(event) => setVideoDraft((current) => ({ ...current, is_featured: event.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-700 focus:ring-neutral-300"
                  />
                  Feature this item on public surfaces
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-neutral-200 bg-[linear-gradient(180deg,#fcf9ef_0%,#ffffff_60%,#f7f7f5_100%)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-700">Landing-page media preview</p>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusTone(videoDraft.status)}`}>
                      {videoDraft.status}
                    </span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-neutral-200 bg-white shadow-sm">
                    {(() => {
                      const previewThumbnail = getPublicVideoThumbnail({
                        thumbnail_url: videoDraft.thumbnail_url || null,
                        embed_url: videoDraft.embed_url || null,
                      });

                      return previewThumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewThumbnail} alt={videoDraft.title || "Video thumbnail"} className="h-52 w-full object-cover" />
                      ) : (
                        <div className="flex h-52 items-center justify-center bg-neutral-100 text-sm font-semibold text-neutral-500">
                          Upload a thumbnail to preview the public card
                        </div>
                      );
                    })()}

                    <div className="space-y-3 p-5">
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                        <span>{videoDraft.content_type}</span>
                        <span>{videoDraft.category}</span>
                      </div>
                      <h3 className="text-2xl font-black tracking-tight text-black">
                        {videoDraft.title.trim() || "Video headline preview"}
                      </h3>
                      <p className="text-sm leading-7 text-neutral-600">
                        {videoDraft.excerpt.trim() || "A short preview about this video, replay, or clinic announcement will appear here."}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">
                          Watch / View
                          <FaArrowRight />
                        </span>
                        {videoDraft.embed_url ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">
                            <FaLink />
                            Embed attached
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => void saveVideoDraft("Draft"))}
                      disabled={isPending || !videoDraft.title.trim()}
                      className="rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-200 disabled:opacity-60"
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void saveVideoDraft("Published"))}
                      disabled={isPending || !videoDraft.title.trim()}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void saveVideoDraft("Archived"))}
                      disabled={isPending || !videoDraft.title.trim()}
                      className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <Surface
            title="Recent video / vlog content"
            description="Manage smaller public cards, live replay content, and clinic announcements from one media library."
          >
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {mediaPosts.map((post) => (
                <article key={post.id} className="overflow-hidden rounded-[1.6rem] border border-neutral-200 bg-white shadow-sm">
                  <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
                    {getPublicVideoThumbnail(post) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getPublicVideoThumbnail(post) ?? ""}
                        alt={post.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-neutral-100 text-sm font-bold uppercase tracking-[0.16em] text-neutral-500">
                        No thumbnail
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(post.status)}`}>
                        {post.status}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        {post.content_type}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                        {formatDate(post.published_at ?? post.created_at)}
                      </span>
                    </div>

                    <div>
                      <p className="line-clamp-2 text-xl font-black tracking-tight text-black">{post.title}</p>
                      <p className="mt-2 text-sm font-medium text-neutral-500">{post.category}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVideoDraft({
                            id: post.id,
                            title: post.title,
                            slug: post.slug,
                            content_type: post.content_type,
                            category: post.category,
                            excerpt: post.excerpt ?? "",
                            thumbnail_url: post.thumbnail_url ?? "",
                            embed_url: post.embed_url ?? "",
                            status: post.status,
                            is_featured: post.is_featured,
                            body: post.body ?? "",
                          })
                        }
                        className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      {post.embed_url ? (
                        <a
                          href={post.embed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                        >
                          Open source
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startTransition(() => void updateStoredPostStatus(post, "Published"))}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Make public
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void updateStoredPostStatus(post, "Draft"))}
                        className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-200"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void updateStoredPostStatus(post, "Archived"))}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void deletePost(post.id))}
                        className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {!mediaPosts.length ? (
                <div className="rounded-[1.5rem] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500 md:col-span-2 xl:col-span-3">
                  No video, replay, or announcement content yet. Publish your first media item here and it will be ready for the public site.
                </div>
              ) : null}
            </div>
          </Surface>
        </div>
      ) : null}

      {activeTab === "live" ? (
        <div className="space-y-6">
          <Surface
            title={liveDraft.id ? "Edit live event" : "Create a live stream schedule"}
            description="Plan upcoming lives, webinars, and health talks. You can pair them with replay content after the event so public visitors always see the latest schedule and replays."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLiveDraft(emptyLiveDraft)}
                  className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Start fresh
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => void saveLiveDraft())}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  <FaFloppyDisk />
                  {liveDraft.id ? "Update event" : "Save event"}
                </button>
              </div>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Live title">
                  <input
                    value={liveDraft.title}
                    onChange={(event) => setLiveDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  />
                </Field>

                <Field label="Platform">
                  <select
                    value={liveDraft.platform}
                    onChange={(event) => setLiveDraft((current) => ({ ...current, platform: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  >
                    {livePlatforms.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start date and time">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      value={getLiveDatePart(liveDraft.starts_at)}
                      onChange={(event) =>
                        setLiveDraft((current) => ({
                          ...current,
                          starts_at: mergeLiveScheduleParts(event.target.value, getLiveTimePart(current.starts_at)),
                        }))
                      }
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                    <select
                      value={getLiveTimePart(liveDraft.starts_at) || "09:00"}
                      onChange={(event) =>
                        setLiveDraft((current) => ({
                          ...current,
                          starts_at: mergeLiveScheduleParts(getLiveDatePart(current.starts_at), event.target.value),
                        }))
                      }
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    >
                      {liveTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {new Date(`2000-01-01T${time}:00`).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-xs font-medium ${liveDraft.starts_at ? "text-neutral-400" : "text-neutral-700"}`}>
                      {liveDraft.starts_at
                        ? "This event will publish using your selected local date and selected time slot."
                        : "Required. Choose the event date and time before saving."}
                    </p>
                  </div>
                </Field>

                <Field label="Status">
                  <select
                    value={liveDraft.status}
                    onChange={(event) => setLiveDraft((current) => ({ ...current, status: event.target.value }))}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  >
                    {liveStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Live / registration link" hint="Public CTA button">
                    <input
                      value={liveDraft.live_url}
                      onChange={(event) => setLiveDraft((current) => ({ ...current, live_url: event.target.value }))}
                      placeholder="https://facebook.com/... or registration link"
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Description" hint="Public overview">
                    <textarea
                      rows={5}
                      value={liveDraft.description}
                      onChange={(event) => setLiveDraft((current) => ({ ...current, description: event.target.value }))}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Replay content link" hint="Optional handoff after the event">
                    <select
                      value={liveDraft.replay_post_id}
                      onChange={(event) => setLiveDraft((current) => ({ ...current, replay_post_id: event.target.value }))}
                      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    >
                      <option value="">No replay linked yet</option>
                      {replayCandidates.map((post) => (
                        <option key={post.id} value={post.id}>
                          {post.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <label className="md:col-span-2 flex items-center gap-3 rounded-[1.35rem] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm font-semibold text-neutral-700">
                  <input
                    type="checkbox"
                    checked={liveDraft.registration_enabled}
                    onChange={(event) => setLiveDraft((current) => ({ ...current, registration_enabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-700 focus:ring-neutral-300"
                  />
                  Allow visitors to register interest or join from the public page
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-neutral-200 bg-[linear-gradient(180deg,#fcf9ef_0%,#ffffff_40%,#f7f7f5_100%)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-700">Landing-page live preview</p>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusTone(liveDraft.status)}`}>
                      {liveDraft.status}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[1.6rem] border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-700">
                      <FaCalendarDays />
                      {liveDraft.starts_at ? formatDateTime(new Date(liveDraft.starts_at).toISOString()) : "Choose a schedule"}
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-tight text-black">
                      {liveDraft.title.trim() || "Upcoming live health talk"}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-neutral-600">
                      {liveDraft.description.trim() || "A public summary of the live topic, who it is for, and why followers should join will appear here."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em]">
                      <span className="rounded-full bg-neutral-50 px-3 py-1.5 text-neutral-700">{liveDraft.platform || "Platform"}</span>
                      {liveDraft.registration_enabled ? (
                        <span className="rounded-full bg-neutral-50 px-3 py-1.5 text-neutral-700">Registration enabled</span>
                      ) : null}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startTransition(() => void saveLiveDraft("Upcoming"))}
                        disabled={isPending}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                      >
                        Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void saveLiveDraft("Live"))}
                        disabled={isPending}
                        className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                      >
                        Mark live
                      </button>
                      <button
                        type="button"
                        onClick={() => startTransition(() => void saveLiveDraft("Completed"))}
                        disabled={isPending}
                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <Surface
            title="Recent live schedule"
            description="Edit, update status, or connect completed events to replay content."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {liveEvents.map((event) => (
                <article key={event.id} className="rounded-[1.7rem] border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTone(event.status)}`}>
                          {event.status}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                          {event.platform || "Platform TBA"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black tracking-tight text-black">{event.title}</h3>
                      <p className="mt-2 text-sm font-medium text-neutral-500">{formatDateTime(event.starts_at)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLiveDraft({
                          id: event.id,
                          title: event.title,
                          description: event.description ?? "",
                          starts_at: toDateTimeLocal(event.starts_at),
                          platform: event.platform ?? livePlatforms[0],
                          live_url: event.live_url ?? "",
                          replay_post_id: event.replay_post_id ?? "",
                          registration_enabled: event.registration_enabled,
                          status: event.status,
                        })
                      }
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-neutral-600">
                    {event.description || "No public summary added yet."}
                  </p>

                  {event.content_posts?.title ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-700">
                      Replay linked: {event.content_posts.title}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startTransition(() => void updateLiveEventStatus(event, "Live"))}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Go live
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void updateLiveEventStatus(event, "Completed"))}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void updateLiveEventStatus(event, "Cancelled"))}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void deleteLiveEvent(event.id))}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </article>
              ))}

              {!liveEvents.length ? (
                <div className="rounded-[1.5rem] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500 lg:col-span-2">
                  No live events scheduled yet. Create the first health talk schedule here to populate the public live section.
                </div>
              ) : null}
            </div>
          </Surface>
        </div>
      ) : null}
    </div>
  );
}
