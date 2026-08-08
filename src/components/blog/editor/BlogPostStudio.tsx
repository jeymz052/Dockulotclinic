"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  FaArrowDown,
  FaArrowLeft,
  FaArrowRight,
  FaArrowUp,
  FaEye,
  FaFloppyDisk,
  FaLayerGroup,
  FaPlus,
  FaTrash,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import BlogBlockRenderer from "@/src/components/blog/BlogBlockRenderer";
import {
  deriveExcerptFromBlocks,
  parseBlocks,
  type BlogBlock,
  type BlogBlockType,
} from "@/src/lib/content-post-blocks";
import { contentCategories } from "@/src/lib/healthcare-content";

type EditablePost = {
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
  blocks: BlogBlock[];
};

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

type LibraryPost = StoredPost & {
  source: "database" | "sample";
};

const blogContentTypes = ["Blog", "HealthTip"];
const contentTypes = blogContentTypes;

const emptyPost: EditablePost = {
  title: "",
  slug: "",
  content_type: "Blog",
  category: contentCategories[0],
  excerpt: "",
  thumbnail_url: "",
  embed_url: "",
  status: "Draft",
  is_featured: false,
  body: "",
  blocks: [],
};

const blockTemplates: Record<BlogBlockType, BlogBlock> = {
  paragraph: { type: "paragraph", text: "Write a supporting paragraph here." },
  h2: { type: "h2", text: "Section heading" },
  h3: { type: "h3", text: "Subheading" },
  blockquote: { type: "blockquote", text: "Key takeaway or memorable quote." },
  ul: { type: "ul", items: ["First point", "Second point", "Third point"] },
  ol: { type: "ol", items: ["Step one", "Step two", "Step three"] },
  image: { type: "image", url: "", alt: "" },
  embed: { type: "embed", url: "" },
  divider: { type: "divider" },
  cta: { type: "cta", buttonText: "Book an appointment", buttonLink: "/#booking" },
  faq: { type: "faq", question: "Frequently asked question", answer: "Helpful answer goes here." },
};

const blockTypeLabels: Record<BlogBlockType, string> = {
  paragraph: "Paragraph",
  h2: "Section heading",
  h3: "Subheading",
  blockquote: "Quote highlight",
  ul: "Bullet list",
  ol: "Numbered list",
  image: "Inline image",
  embed: "Embedded media",
  divider: "Divider",
  cta: "Call to action",
  faq: "FAQ item",
};

const blockInsertGroups: Array<{
  label: string;
  description: string;
  types: BlogBlockType[];
}> = [
  {
    label: "Story",
    description: "Use headings, paragraphs, and takeaways to shape the main article flow.",
    types: ["paragraph", "h2", "h3", "blockquote"],
  },
  {
    label: "Lists",
    description: "Break advice into steps, tips, symptoms, or common patient questions.",
    types: ["ul", "ol", "faq"],
  },
  {
    label: "Media",
    description: "Support the article with imagery, videos, and visual separation.",
    types: ["image", "embed", "divider"],
  },
  {
    label: "Conversion",
    description: "Add the next action the visitor should take after reading.",
    types: ["cta"],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function coerceEditablePost(post: StoredPost): EditablePost {
  return {
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
    blocks: parseBlocks(post.body) ?? [],
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Draft";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
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

function Surface({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[2rem] border border-neutral-200 bg-white/95 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur sm:p-6 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-black">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatCard({ label, value, tone = "slate" }: { label: string; value: ReactNode; tone?: "slate" | "sky" | "teal" }) {
  const toneClass =
    tone === "sky"
      ? "border-neutral-200 bg-neutral-50 text-neutral-800"
      : tone === "teal"
        ? "border-neutral-100 bg-neutral-50 text-neutral-800"
        : "border-neutral-200 bg-white text-black";

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function toneForStatus(status: string) {
  if (status === "Published") return "border-neutral-200 bg-neutral-50 text-neutral-700";
  if (status === "Archived") return "border-neutral-200 bg-neutral-100 text-neutral-600";
  return "border-neutral-100 bg-neutral-50 text-neutral-700";
}

function HeroImageUploader({
  accessToken,
  currentUrl,
  onChange,
  onError,
}: {
  accessToken: string | null;
  currentUrl: string;
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
      const res = await fetch("/api/v2/content-posts/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.message ?? "Upload failed");
      }
      onChange(payload.url);
    } catch (error) {
      if (error instanceof TypeError && /fetch/i.test(error.message)) {
        onError("Upload API could not be reached. Check that the dev server is running and Supabase is configured.");
      } else {
        onError(error instanceof Error ? error.message : "Upload failed");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Hero image</p>
          <p className="mt-1 text-xs text-neutral-500">Upload the main image used in the landing card and article header.</p>
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
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt="Uploaded hero preview" className="h-36 w-full object-cover" />
          </>
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

export default function BlogPostStudio() {
  const { accessToken } = useRole();
  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [draft, setDraft] = useState<EditablePost>(emptyPost);
  const [feedback, setFeedback] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken],
  );

  const databasePosts = useMemo<LibraryPost[]>(
    () =>
      posts
        .filter((post) => blogContentTypes.includes(post.content_type))
        .map((post) => ({ ...post, source: "database" as const })),
    [posts],
  );

  const filteredLibraryPosts = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    if (!query) return databasePosts;
    return databasePosts.filter((post) =>
      [post.title, post.category, post.status, post.slug].some((value) => value.toLowerCase().includes(query)),
    );
  }, [databasePosts, libraryQuery]);

  const isTemplateDraft = draft.id?.startsWith("sample-post-") ?? false;
  const generatedExcerpt = deriveExcerptFromBlocks(draft.blocks);
  const previewTitle = draft.title.trim() || "Preview title";
  const previewCategory = draft.category || "Category";
  const previewExcerpt =
    draft.excerpt.trim() ||
    generatedExcerpt ||
    "A short summary for landing-page cards and the article intro will appear here.";
  const readyChecks = [
    { label: "Headline", complete: Boolean(draft.title.trim()) },
    { label: "Slug", complete: Boolean(draft.slug.trim()) },
    { label: "Summary", complete: Boolean(previewExcerpt.trim()) },
    { label: "Hero image", complete: Boolean(draft.thumbnail_url.trim()) },
    { label: "Story blocks", complete: draft.blocks.length > 0 },
  ];
  const completionCount = readyChecks.filter((item) => item.complete).length;
  const completionPercent = Math.round((completionCount / readyChecks.length) * 100);

  function updateDraft<K extends keyof EditablePost>(key: K, value: EditablePost[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBlock(index: number, patch: Partial<BlogBlock>) {
    setDraft((current) => {
      const blocks = current.blocks.slice();
      blocks[index] = { ...blocks[index], ...patch };
      return { ...current, blocks };
    });
  }

  function updateListItem(index: number, itemIndex: number, value: string) {
    setDraft((current) => {
      const blocks = current.blocks.slice();
      const items = [...(blocks[index].items ?? [])];
      items[itemIndex] = value;
      blocks[index] = { ...blocks[index], items };
      return { ...current, blocks };
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.blocks.length) return current;
      const blocks = current.blocks.slice();
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return { ...current, blocks };
    });
  }

  function removeBlock(index: number) {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  function addBlock(type: BlogBlockType) {
    setDraft((current) => ({
      ...current,
      blocks: [...current.blocks, structuredClone(blockTemplates[type])],
    }));
  }

  function startFreshDraft() {
    setDraft({
      ...emptyPost,
      category: draft.category || emptyPost.category,
      content_type: draft.content_type || emptyPost.content_type,
    });
    setFeedback("Started a fresh blog draft.");
    setIsPreviewMode(false);
  }

  function loadDraft(post: StoredPost) {
    setDraft(coerceEditablePost(post));
    setFeedback(`Loaded "${post.title}" into Blog Builder.`);
    setIsPreviewMode(false);
  }

  async function loadPosts() {
    if (!accessToken) return;
    const response = await fetch("/api/v2/content-posts", {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      setFeedback("Unable to load content posts.");
      return;
    }
    const payload = (await response.json()) as { posts?: StoredPost[] };
    setPosts(payload.posts ?? []);
  }

  useEffect(() => {
    startTransition(() => {
      void loadPosts();
    });
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePost(overrides?: Partial<EditablePost>) {
    if (!accessToken) return;

    const nextDraft = { ...draft, ...overrides };
    const payload = {
      title: nextDraft.title,
      slug: nextDraft.slug || slugify(nextDraft.title),
      content_type: nextDraft.content_type,
      category: nextDraft.category,
      excerpt: nextDraft.excerpt.trim() || deriveExcerptFromBlocks(nextDraft.blocks) || null,
      thumbnail_url: nextDraft.thumbnail_url || null,
      embed_url: nextDraft.embed_url || null,
      status: nextDraft.status,
      is_featured: nextDraft.is_featured,
      body: nextDraft.body,
      blocks: nextDraft.blocks,
    };

    const endpoint = nextDraft.id && !isTemplateDraft ? `/api/v2/content-posts/${nextDraft.id}` : "/api/v2/content-posts";
    const method = nextDraft.id && !isTemplateDraft ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      setFeedback(result.message ?? "Unable to save blog post.");
      return;
    }

    setFeedback(nextDraft.id && !isTemplateDraft ? "Blog post updated." : "Blog post created from builder.");
    setDraft(emptyPost);
    setIsPreviewMode(false);
    await loadPosts();
  }

  async function updateStoredPostStatus(post: StoredPost, status: EditablePost["status"]) {
    if (!accessToken) return;

    const response = await fetch(`/api/v2/content-posts/${post.id}`, {
      method: "PATCH",
      headers,
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
        blocks: parseBlocks(post.body) ?? [],
      }),
    });

    if (!response.ok) {
      setFeedback(`Unable to update "${post.title}".`);
      return;
    }

    if (draft.id === post.id) {
      setDraft((current) => ({ ...current, status }));
    }
    setFeedback(`"${post.title}" is now ${status.toLowerCase()}.`);
    await loadPosts();
  }

  async function removePost(id: string) {
    if (!accessToken) return;
    const response = await fetch(`/api/v2/content-posts/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!response.ok) {
      setFeedback("Unable to delete the post.");
      return;
    }
    if (draft.id === id) setDraft(emptyPost);
    setFeedback("Blog post deleted.");
    await loadPosts();
  }

  if (isPreviewMode) {
    return (
      <div className="min-h-screen space-y-6 bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_58%,#ffffff_100%)] pb-10">
        <div className="rounded-[2rem] border border-neutral-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewMode(false)}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <FaArrowLeft />
              Back to Blog Builder
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startTransition(() => void savePost())}
                disabled={isPending || !draft.title.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                <FaFloppyDisk />
                {draft.id && !isTemplateDraft ? "Update post" : "Save post"}
              </button>
              <Link href="/blog" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50">
                View public blog
                <FaArrowRight />
              </Link>
            </div>
          </div>
        </div>

        <article className="mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
          <div className="mb-8 border-b border-neutral-200 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-neutral-500">
                <Link href="/blog" className="transition hover:text-neutral-700">
                  Blog
                </Link>
                <span className="px-2 text-neutral-400">/</span>
                <span className="text-neutral-700">{previewTitle}</span>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewMode(false)}
                className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
              >
                <FaArrowLeft />
                Back to builder
              </button>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.35fr]">
            <main>
              {draft.thumbnail_url ? (
                <div className="mb-8 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.thumbnail_url} alt={previewTitle} className="h-72 w-full object-cover sm:h-96" />
                </div>
              ) : null}

              <div className="flex gap-8">
                <div className="hidden shrink-0 lg:block">
                  <div className="flex w-24 flex-col items-center justify-center rounded-[1.5rem] bg-black px-3 py-4 text-white shadow-lg shadow-neutral-800/15">
                    <div className="text-3xl font-extrabold leading-none">{new Date().getDate().toString().padStart(2, "0")}</div>
                    <div className="mt-1 text-xs font-semibold tracking-wider">
                      {new Date().toLocaleString(undefined, { month: "short" }).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="inline-flex rounded-full bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-700">
                    {previewCategory}
                  </div>
                  <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-800 sm:text-5xl">{previewTitle}</h1>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                    <span>By Doc Kulot</span>
                    <span>{previewCategory}</span>
                  </div>
                  <p className="mt-6 text-lg leading-8 text-neutral-600">{previewExcerpt}</p>

                  <div className="mt-8">
                    <span className="inline-flex w-full max-w-md rounded-full bg-black px-6 py-3 text-center text-base font-semibold text-white shadow-sm">
                      Book An Appointment
                    </span>
                  </div>

                  <div className="mt-10 space-y-7">
                    {draft.blocks.length ? (
                      <BlogBlockRenderer blocks={draft.blocks} title={previewTitle} />
                    ) : (draft.body ?? "").trim() ? (
                      draft.body.split(/\n\s*\n/).map((block, index) => (
                        <p key={index} className="text-base leading-8 text-neutral-700 sm:text-lg">
                          {block}
                        </p>
                      ))
                    ) : (
                      <p className="text-base leading-8 text-neutral-600">
                        This article preview is ready for content. Add story blocks in the builder to see the full page.
                      </p>
                    )}
                  </div>

                  <div className="mt-10 rounded-[1.75rem] border border-neutral-100 bg-neutral-50 px-6 py-5 text-sm leading-6 text-neutral-800">
                    Health content is for education only. If symptoms are urgent, seek care immediately.
                  </div>
                </div>
              </div>
            </main>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-neutral-100 bg-neutral-50 p-6 shadow-sm">
                <h3 className="text-lg font-black tracking-tight text-neutral-700">Categories</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
                  {contentCategories.map((category) => (
                    <li key={category} className="border-b border-neutral-100 py-3 transition hover:text-neutral-700 last:border-b-0">
                      {category}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black tracking-tight text-neutral-700">Recent</h3>
                <div className="mt-4 space-y-4">
                  {databasePosts.slice(0, 4).map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-neutral-50">
                      {post.thumbnail_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.thumbnail_url} alt={post.title} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                        </>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-[10px] font-bold uppercase text-neutral-500">
                          Blog
                        </div>
                      )}
                      <div className="min-w-0 text-sm">
                        <div className="line-clamp-2 font-semibold text-neutral-900">{post.title}</div>
                        <div className="text-xs text-neutral-500">{formatDate(post.published_at ?? post.created_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_left,_rgba(17,17,17,0.22),_transparent_28%),radial-gradient(circle_at_90%_12%,_rgba(59,130,246,0.14),_transparent_24%),linear-gradient(135deg,#fcf9ef_0%,#ffffff_45%,#f7f7f5_100%)] p-6 shadow-[0_30px_80px_-40px_rgba(17,17,17,0.45)] sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-700">Internal publishing workspace</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-black sm:text-5xl">Blog Builder</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600 sm:text-base">
            Build the landing-page card, write the full article, and manage publishing in one workspace. Preview opens
            in a dedicated full-page view so you can inspect it like the public blog.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {["Landing card", "Article hero", "Story blocks", "Appointment CTA", "Health advisory"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-neutral-200 bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-700"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Builder progress" value={`${completionPercent}%`} tone="sky" />
            <StatCard label="Story blocks" value={draft.blocks.length} tone="teal" />
            <StatCard label="Saved posts" value={databasePosts.length} />
            <StatCard
              label="Current mode"
              value={
                <span className="text-sm font-bold text-black">
                  {isTemplateDraft ? "Starter template" : draft.id ? "Editing live entry" : "New story draft"}
                </span>
              }
            />
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-white/80 bg-white/80 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Publishing readiness</p>
                <p className="mt-1 text-sm text-neutral-600">
                  Complete the essentials below and the builder will mirror the public blog page more cleanly.
                </p>
              </div>
              <div className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-bold text-neutral-700">
                {completionCount}/{readyChecks.length} ready
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#67490c_0%,#2563eb_100%)]" style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {readyChecks.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                    item.complete
                      ? "border-neutral-200 bg-neutral-50 text-neutral-700"
                      : "border-neutral-200 bg-white text-neutral-500"
                  }`}
                >
                  {item.complete ? "Ready" : "Needed"}: {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Surface
        title={draft.id ? "Blog Builder" : "Start a new article"}
        description="Write the card content, shape the article, and manage blog publishing from one full-page workspace."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startFreshDraft}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              New draft
            </button>
            <button
              type="button"
              onClick={() => setIsPreviewMode(true)}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
            >
              <FaEye />
              Preview full page
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => void savePost())}
              disabled={isPending || !draft.title.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <FaFloppyDisk />
              {isTemplateDraft ? "Create from starter" : draft.id ? "Save changes" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => void savePost({ status: "Published" }))}
              disabled={isPending || !draft.title.trim()}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => void savePost({ status: "Archived" }))}
              disabled={isPending || !draft.title.trim()}
              className="rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Archive
            </button>
          </div>
        }
      >
        {isTemplateDraft ? (
          <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
            You are editing a starter template. Saving will create a new post in the main content library.
          </div>
        ) : null}

        {feedback ? (
          <div className="mt-4 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">
            {feedback}
          </div>
        ) : null}

        <div className="mt-4">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Blog title">
                <input
                  value={draft.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      title,
                      slug: current.id ? current.slug : slugify(title),
                    }));
                  }}
                  placeholder="Write a patient-friendly headline"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                />
              </Field>

              <Field label="Slug" hint="Auto-generated for new drafts">
                <input
                  value={draft.slug}
                  onChange={(event) => updateDraft("slug", slugify(event.target.value))}
                  placeholder="blog-post-slug"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Content type">
                <select
                  value={draft.content_type}
                  onChange={(event) => updateDraft("content_type", event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                >
                  {contentTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>

              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(event) => updateDraft("category", event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                >
                  {contentCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label="Excerpt"
              hint={draft.excerpt.trim() ? "Manual summary" : generatedExcerpt ? "Builder can derive this from the first paragraph" : undefined}
            >
              <textarea
                value={draft.excerpt}
                onChange={(event) => updateDraft("excerpt", event.target.value)}
                rows={4}
                placeholder="This appears on the landing page and near the top of the public article."
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <HeroImageUploader
                accessToken={accessToken}
                currentUrl={draft.thumbnail_url}
                onChange={(url) => updateDraft("thumbnail_url", url)}
                onError={setFeedback}
              />

              <Field label="Optional embed URL">
                <input
                  value={draft.embed_url}
                  onChange={(event) => updateDraft("embed_url", event.target.value)}
                  placeholder="https://youtube.com/embed/..."
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_170px_180px]">
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                >
                  {["Draft", "Published", "Archived"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>

              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.is_featured}
                  onChange={(event) => updateDraft("is_featured", event.target.checked)}
                />
                Featured
              </label>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Live URL</p>
                <p className="mt-1 truncate text-sm font-semibold text-neutral-700">/blog/{draft.slug || "your-slug"}</p>
              </div>
            </div>

            <Field label="Fallback body text" hint="Used only if no structured blocks exist">
              <textarea
                value={draft.body}
                onChange={(event) => updateDraft("body", event.target.value)}
                rows={5}
                placeholder="Optional plain text fallback."
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 font-normal text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </Field>

            <div className="rounded-[1.6rem] border border-neutral-200 bg-[linear-gradient(180deg,#fcf9ef_0%,#ffffff_100%)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black tracking-tight text-black">Story builder</p>
                  <p className="mt-1 text-sm text-neutral-500">Compose the article in the same reading order the public blog page will render.</p>
                </div>
                <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">
                  {draft.blocks.length} block{draft.blocks.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {blockInsertGroups.map((group) => (
                  <div key={group.label} className="rounded-[1.35rem] border border-neutral-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{group.label}</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{group.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.types.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => addBlock(type)}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                        >
                          <FaPlus />
                          {blockTypeLabels[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {draft.blocks.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-neutral-300 bg-neutral-50 px-5 py-12 text-center text-sm leading-7 text-neutral-500">
                  Start with a paragraph or section heading, then add supporting media, FAQs, and a CTA.
                </div>
              ) : null}

              {draft.blocks.map((block, index) => (
                <div key={`${block.type}-${index}`} className="rounded-[1.6rem] border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-700">
                        <FaLayerGroup />
                        Block {index + 1}
                      </div>
                      <p className="mt-2 text-base font-bold text-black">{blockTypeLabels[block.type]}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveBlock(index, -1)}
                        className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 transition hover:bg-neutral-100"
                        aria-label={`Move block ${index + 1} up`}
                      >
                        <FaArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 1)}
                        className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 transition hover:bg-neutral-100"
                        aria-label={`Move block ${index + 1} down`}
                      >
                        <FaArrowDown />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 transition hover:bg-neutral-50"
                        aria-label={`Delete block ${index + 1}`}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {block.type === "paragraph" || block.type === "h2" || block.type === "h3" || block.type === "blockquote" ? (
                      <textarea
                        rows={block.type === "paragraph" ? 5 : 3}
                        value={block.text ?? ""}
                        onChange={(event) => updateBlock(index, { text: event.target.value })}
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      />
                    ) : null}

                    {block.type === "ul" || block.type === "ol" ? (
                      <div className="space-y-2">
                        {(block.items ?? []).map((item, itemIndex) => (
                          <input
                            key={`${itemIndex}-${block.type}`}
                            value={item}
                            onChange={(event) => updateListItem(index, itemIndex, event.target.value)}
                            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => updateBlock(index, { items: [...(block.items ?? []), "New item"] })}
                          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          <FaPlus />
                          Add list item
                        </button>
                      </div>
                    ) : null}

                    {block.type === "image" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={block.url ?? ""}
                          onChange={(event) => updateBlock(index, { url: event.target.value })}
                          placeholder="Image URL"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                        <input
                          value={block.alt ?? ""}
                          onChange={(event) => updateBlock(index, { alt: event.target.value })}
                          placeholder="Alt text"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>
                    ) : null}

                    {block.type === "embed" ? (
                      <input
                        value={block.url ?? ""}
                        onChange={(event) => updateBlock(index, { url: event.target.value })}
                        placeholder="Embed URL"
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      />
                    ) : null}

                    {block.type === "cta" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={block.buttonText ?? ""}
                          onChange={(event) => updateBlock(index, { buttonText: event.target.value })}
                          placeholder="Button label"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                        <input
                          value={block.buttonLink ?? ""}
                          onChange={(event) => updateBlock(index, { buttonLink: event.target.value })}
                          placeholder="/#booking"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>
                    ) : null}

                    {block.type === "faq" ? (
                      <div className="space-y-3">
                        <input
                          value={block.question ?? ""}
                          onChange={(event) => updateBlock(index, { question: event.target.value })}
                          placeholder="Question"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                        <textarea
                          rows={4}
                          value={block.answer ?? ""}
                          onChange={(event) => updateBlock(index, { answer: event.target.value })}
                          placeholder="Answer"
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>
                    ) : null}

                    {block.type === "divider" ? (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
                        Divider block added. This creates spacing between major story sections.
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <div className="grid gap-6">
        <Surface
          title="Recent blogs"
          description="Manage your saved blogs with larger image cards and quick publishing actions."
          action={
            <button
              type="button"
              onClick={() => startTransition(() => void loadPosts())}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <FaWandMagicSparkles />
              Refresh
            </button>
          }
        >
          <input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search by title, category, slug, or status"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
          />

          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredLibraryPosts.map((post) => (
              <div key={post.id} className="overflow-hidden rounded-[1.6rem] border border-neutral-200 bg-white shadow-sm">
                <div>
                  {post.thumbnail_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.thumbnail_url} alt={post.title} className="h-48 w-full object-cover" />
                    </>
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-neutral-100 text-sm font-bold uppercase text-neutral-500">
                      No image yet
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneForStatus(post.status)}`}>
                      {post.status}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {formatDate(post.published_at ?? post.created_at)}
                    </span>
                  </div>

                  <div>
                    <p className="line-clamp-2 text-lg font-black tracking-tight text-black">{post.title}</p>
                    <p className="mt-2 text-sm font-medium text-neutral-500">{post.category}</p>
                    <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">/{post.slug}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadDraft(post)}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void updateStoredPostStatus(post, "Published"))}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => void updateStoredPostStatus(post, "Draft"))}
                      className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-200"
                    >
                      Unpublish
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
                      onClick={() => startTransition(() => void removePost(post.id))}
                      className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!filteredLibraryPosts.length ? (
              <div className="rounded-[1.5rem] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500 md:col-span-2 xl:col-span-3">
                {databasePosts.length ? "No posts match that search yet." : "No saved posts yet. Publish your first article to build the library."}
              </div>
            ) : null}
          </div>
        </Surface>
      </div>
    </div>
  );
}
