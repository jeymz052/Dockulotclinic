"use client";

import Link from "next/link";
import { FaArrowRight, FaCalendarDays, FaFolderOpen, FaUserDoctor } from "react-icons/fa6";
import type { PublicContentPost } from "@/src/lib/services/content-posts";

type BlogIndexProps = {
  posts: PublicContentPost[];
  categories: string[];
  mode?: "landing" | "page";
  labels?: {
    categoriesTitle?: string;
    recentPostsTitle?: string;
    browseAllLabel?: string;
  };
};

function formatPostDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function RecentPosts({
  posts,
  title = "Recent Posts",
}: {
  posts: PublicContentPost[];
  title?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold-700">{title}</p>
      <div className="mt-5 space-y-4">
        {posts.slice(0, 4).map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-neutral-50">
            {post.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.thumbnail_url} alt={post.title} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-xs font-semibold text-neutral-500">
                Blog
              </div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold text-neutral-900">{post.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{formatPostDate(post.published_at ?? post.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BlogIndex({ posts, categories, mode = "page", labels }: BlogIndexProps) {
  const isLanding = mode === "landing";
  const visiblePosts = isLanding ? posts.slice(0, 3) : posts;

  if (isLanding) {
    return (
      <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {visiblePosts.map((post) => (
            <article key={post.id} className="group">
              <Link href={`/blog/${post.slug}`} className="block overflow-hidden bg-white">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnail_url}
                    alt={post.title}
                    className="h-72 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-80 xl:h-96"
                  />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-neutral-100 text-sm font-semibold text-neutral-500 sm:h-80 xl:h-96">
                    No image yet
                  </div>
                )}
              </Link>

              <div className="pt-5">
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.72rem] uppercase tracking-[0.16em] text-neutral-500">
                  <span className="inline-flex items-center gap-2">
                    <FaCalendarDays className="text-black" />
                    {formatPostDate(post.published_at ?? post.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FaFolderOpen className="text-black" />
                    {post.category}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FaUserDoctor className="text-black" />
                    Doc Kulot
                  </span>
                </div>

                <Link
                  href={`/blog/${post.slug}`}
                  className="block text-2xl font-semibold leading-tight tracking-[-0.02em] text-neutral-950 transition hover:text-neutral-700"
                >
                  <span className="line-clamp-2">{post.title}</span>
                </Link>

                <p className="mt-4 line-clamp-4 max-w-[36rem] text-lg leading-8 text-neutral-500">
                  {post.excerpt || "Read practical doctor-backed guidance written to help patients make more confident health decisions."}
                </p>

                <div className="mt-5">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 border-b border-black pb-1 text-sm uppercase tracking-[0.14em] text-black transition hover:gap-3"
                  >
                    Read More
                    <FaArrowRight className="text-xs" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visiblePosts.length < 3 && categories.length ? (
          <div className="flex flex-wrap gap-3 border-t border-black/10 pt-6">
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-600"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {visiblePosts.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-stretch">
              <Link href={`/blog/${post.slug}`} className="block lg:flex lg:w-[42%] lg:self-stretch">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.thumbnail_url} alt={post.title} className="h-72 w-full object-cover lg:h-full lg:min-h-full" />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-neutral-100 text-sm font-semibold text-neutral-500 lg:h-full lg:min-h-full">
                    No image yet
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    <span className="inline-flex items-center gap-2">
                      <FaCalendarDays className="text-gold-700" />
                      {formatPostDate(post.published_at ?? post.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FaUserDoctor className="text-gold-700" />
                      Doc Kulot
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FaFolderOpen className="text-gold-700" />
                      {post.category}
                    </span>
                  </div>

                  <Link href={`/blog/${post.slug}`} className="mt-4 block text-2xl font-black tracking-tight text-gold-800 transition hover:text-gold-700 sm:text-3xl">
                    {post.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-gold-200 px-5 py-2.5 text-sm font-bold text-gold-700 transition hover:bg-gold-50"
                    >
                      Read More
                      <FaArrowRight />
                    </Link>
                    {post.is_featured ? (
                      <span className="rounded-full bg-gold-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-gold-700">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}

        {isLanding ? (
          <div className="flex justify-end">
            <Link href="/#blog" className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 transition hover:text-gold-700">
              {labels?.browseAllLabel ?? "Browse all blog posts"}
              <FaArrowRight />
            </Link>
          </div>
        ) : null}
      </div>

      <aside className="space-y-6">
        <div className="rounded-[2rem] border border-gold-100 bg-gold-50 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-gold-700">
            {labels?.categoriesTitle ?? "Categories"}
          </p>
          <ul className="mt-5 space-y-3">
            {categories.map((category) => (
              <li key={category} className="border-b border-gold-100 pb-3 text-sm font-semibold text-neutral-700 last:border-b-0 last:pb-0">
                {category}
              </li>
            ))}
          </ul>
        </div>

        <RecentPosts posts={posts} title={labels?.recentPostsTitle} />
      </aside>
    </div>
  );
}
