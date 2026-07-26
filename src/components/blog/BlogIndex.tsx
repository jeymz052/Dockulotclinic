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
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-700">{title}</p>
      <div className="mt-5 space-y-4">
        {posts.slice(0, 4).map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50">
            {post.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.thumbnail_url} alt={post.title} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-500">
                Blog
              </div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold text-slate-900">{post.title}</p>
              <p className="mt-1 text-xs text-slate-500">{formatPostDate(post.published_at ?? post.created_at)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BlogIndex({ posts, categories, mode = "page", labels }: BlogIndexProps) {
  const visiblePosts = mode === "landing" ? posts.slice(0, 3) : posts;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {visiblePosts.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-stretch">
              <Link href={`/blog/${post.slug}`} className="block lg:flex lg:w-[42%] lg:self-stretch">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.thumbnail_url} alt={post.title} className="h-72 w-full object-cover lg:h-full lg:min-h-full" />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500 lg:h-full lg:min-h-full">
                    No image yet
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <FaCalendarDays className="text-yellow-700" />
                      {formatPostDate(post.published_at ?? post.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FaUserDoctor className="text-yellow-700" />
                      Doctor Kulot Clinic
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <FaFolderOpen className="text-yellow-700" />
                      {post.category}
                    </span>
                  </div>

                  <Link href={`/blog/${post.slug}`} className="mt-4 block text-2xl font-black tracking-tight text-yellow-800 transition hover:text-yellow-700 sm:text-3xl">
                    {post.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-yellow-200 px-5 py-2.5 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
                    >
                      Read More
                      <FaArrowRight />
                    </Link>
                    {post.is_featured ? (
                      <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-yellow-700">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}

        {mode === "landing" ? (
          <div className="flex justify-end">
            <Link href="/#blog" className="inline-flex items-center gap-2 text-sm font-bold text-yellow-700 transition hover:text-yellow-700">
              {labels?.browseAllLabel ?? "Browse all blog posts"}
              <FaArrowRight />
            </Link>
          </div>
        ) : null}
      </div>

      <aside className="space-y-6">
        <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-700">
            {labels?.categoriesTitle ?? "Categories"}
          </p>
          <ul className="mt-5 space-y-3">
            {categories.map((category) => (
              <li key={category} className="border-b border-yellow-100 pb-3 text-sm font-semibold text-slate-700 last:border-b-0 last:pb-0">
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
