import type { PublicContentPost } from "@/src/lib/services/content-posts";
import { getPublishedContentPosts } from "@/src/lib/services/content-posts";
import { contentCategories } from "@/src/lib/healthcare-content";
import BlogBlockRenderer from "@/src/components/blog/BlogBlockRenderer";
import PublicHeader from "@/src/components/layout/PublicHeader";
import ContentViewTracker from "@/src/components/marketing/ContentViewTracker";
import TrackedLink from "@/src/components/marketing/TrackedLink";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa6";

export default async function ArticleTemplate({ post }: { post: PublicContentPost }) {
  const recent = await getPublishedContentPosts(6);
  const publishedDateObj = new Date(post.published_at ?? post.created_at);
  const publishedDay = String(publishedDateObj.getDate()).padStart(2, "0");
  const publishedMonthShort = publishedDateObj.toLocaleString(undefined, { month: "short" }).toUpperCase();

  return (
    <>
      <PublicHeader />
      <ContentViewTracker
        contentPostId={post.id}
        path={`/blog/${post.slug}`}
        metadata={{ content_type: post.content_type, source: "blog_article" }}
      />

      <article className="mx-auto max-w-7xl px-4 pt-20 pb-10 sm:px-6 sm:pt-24 sm:pb-14">
        <div className="mb-8 border-b border-neutral-200 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-neutral-500">
              <Link href="/blog" className="transition hover:text-gold-700">
                Blog
              </Link>
              <span className="px-2 text-neutral-400">/</span>
              <span className="text-neutral-700">{post.title}</span>
            </div>

            <Link
              href="/#blog"
              className="inline-flex items-center gap-2 self-start rounded-full border border-gold-200 bg-white px-4 py-2 text-sm font-bold text-gold-700 transition hover:bg-gold-50"
            >
              <FaArrowLeft />
              Back to blog preview
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_0.35fr]">
          <main>
            {post.thumbnail_url ? (
              <div className="mb-8 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
                <img src={post.thumbnail_url} alt={post.title} className="h-72 w-full object-cover sm:h-96" />
              </div>
            ) : null}

            <div className="flex gap-8">
              <div className="hidden shrink-0 lg:block">
                <div className="flex w-24 flex-col items-center justify-center rounded-[1.5rem] bg-black px-3 py-4 text-white shadow-lg shadow-gold-800/15">
                  <div className="text-3xl font-extrabold leading-none">{publishedDay}</div>
                  <div className="mt-1 text-xs font-semibold tracking-wider">{publishedMonthShort}</div>
                </div>
              </div>

              <div className="flex-1">
                <div className="inline-flex rounded-full bg-gold-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gold-700">
                  {post.category}
                </div>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-gold-800 sm:text-5xl">{post.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                  <span>By Doc Kulot</span>
                  <span>{post.category}</span>
                </div>

                <p className="mt-6 text-lg leading-8 text-neutral-600">{post.excerpt}</p>

                <div className="mt-8">
                  <TrackedLink
                    href="/#booking"
                    eventName="appointment_click"
                    contentPostId={post.id}
                    metadata={{ source: "blog_article" }}
                    className="inline-flex w-full max-w-md rounded-full bg-black px-6 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-black"
                  >
                    Book An Appointment
                  </TrackedLink>
                </div>

                <div className="mt-10 space-y-7">
                  {Array.isArray(post.blocks) && post.blocks.length ? (
                    <BlogBlockRenderer blocks={post.blocks} title={post.title} />
                  ) : (post.body ?? '').trim() ? (
                    (post.body as string)
                      .split(/\n\s*\n/)
                      .map((block, index) => (
                        <p key={index} className="text-base leading-8 text-neutral-700 sm:text-lg">
                          {block}
                        </p>
                      ))
                  ) : (
                    <p className="text-base leading-8 text-neutral-600">
                      This article is ready for Doc Kulot content. Publish blocks from the creator dashboard to see them here.
                    </p>
                  )}
                </div>

                <div className="mt-10 rounded-[1.75rem] border border-gold-100 bg-gold-50 px-6 py-5 text-sm leading-6 text-gold-800">
                  Health content is for education only. If symptoms are urgent, seek care immediately.
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-gold-100 bg-gold-50 p-6 shadow-sm">
              <h3 className="text-lg font-black tracking-tight text-gold-700">Categories</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-700">
                {contentCategories.map((c) => (
                  <li key={c} className="border-b border-gold-100 py-3 hover:text-gold-700">
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black tracking-tight text-gold-700">Recent</h3>
              <div className="mt-4 space-y-4">
                {recent.slice(0, 4).map((r) => (
                  <Link key={r.id} href={`/blog/${r.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-neutral-50">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt={r.title} className="h-14 w-14 rounded-2xl object-cover shrink-0" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-[10px] font-bold uppercase text-neutral-500">
                        Blog
                      </div>
                    )}
                    <div className="text-sm min-w-0">
                      <div className="font-semibold text-neutral-900 line-clamp-2">{r.title}</div>
                      <div className="text-xs text-neutral-500">{new Date(r.published_at ?? r.created_at).toLocaleDateString()}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}
