"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaArrowRight, FaCalendarCheck, FaPlay, FaVideo, FaXmark } from "react-icons/fa6";
import type { PublicContentPost } from "@/src/lib/services/content-posts";
import { getPublicVideoPlaybackUrl, getPublicVideoThumbnail } from "@/src/lib/video-media";

type PublicVideoGalleryProps = {
  posts: PublicContentPost[];
  variant?: "default" | "compact";
};

export default function PublicVideoGallery({ posts, variant = "default" }: PublicVideoGalleryProps) {
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const activePost = useMemo(() => posts.find((post) => post.id === activePostId) ?? null, [activePostId, posts]);
  const playbackUrl = activePost ? getPublicVideoPlaybackUrl(activePost) : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePostId(null);
    }

    if (activePostId) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePostId]);

  return (
    <>
      <div className={variant === "compact" ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3" : "grid gap-6 lg:grid-cols-2"}>
        {posts.map((post) => {
          const thumbnail = getPublicVideoThumbnail(post);
          const playback = getPublicVideoPlaybackUrl(post);
          const canPlayInline = Boolean(playback);

          return (
            <article
              key={post.id}
              className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                variant === "compact" ? "" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (canPlayInline) setActivePostId(post.id);
                }}
                className="group block w-full text-left"
                aria-label={canPlayInline ? `Play ${post.title}` : post.title}
                disabled={!canPlayInline}
              >
                <div className={`relative overflow-hidden bg-slate-100 ${variant === "compact" ? "aspect-[16/10]" : "aspect-[16/9]"}`}>
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt={post.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                      Media preview not attached yet
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div className="max-w-[75%]">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                        {post.content_type} · {post.category}
                      </p>
                      <p className={`mt-1 line-clamp-2 font-black leading-tight text-white ${variant === "compact" ? "text-base sm:text-lg" : "text-lg"}`}>
                        {post.title}
                      </p>
                    </div>
                    {canPlayInline ? (
                      <span
                        className={`inline-flex items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg transition group-hover:scale-105 ${
                          variant === "compact" ? "h-10 w-10" : "h-12 w-12"
                        }`}
                      >
                        <FaPlay className={`ml-0.5 ${variant === "compact" ? "text-xs" : "text-sm"}`} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>

              <div className={variant === "compact" ? "space-y-4 p-5" : "space-y-4 p-6"}>
                <p className="text-sm leading-7 text-slate-600">
                  {post.excerpt || "This creator video or announcement will show more detail once the content team adds a summary."}
                </p>
                <div className="rounded-[1.35rem] border border-yellow-100 bg-yellow-50/70 px-4 py-3 text-sm text-slate-600">
                  {post.content_type === "LiveReplay"
                    ? "Missed the live session? Open the replay, then check the live schedule for the next health talk."
                    : post.content_type === "Announcement"
                      ? "Clinic updates and creator announcements are posted here so followers can act right away."
                      : "Watch the vlog, then continue with booking, live events, or more health education from the clinic."}
                </div>
                <div className="flex flex-wrap gap-3">
                  {post.embed_url ? (
                    <button
                      type="button"
                      onClick={() => setActivePostId(post.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-yellow-300"
                    >
                      Watch here
                      <FaArrowRight />
                    </button>
                  ) : null}
                  <Link
                    href="/#booking"
                    className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-5 py-2.5 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50"
                  >
                    <FaCalendarCheck />
                    Book appointment
                  </Link>
                  <Link
                    href="/live"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    <FaVideo />
                    Live schedule
                  </Link>
                </div>
              </div>
            </article>
          );
        })}

        {!posts.length ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm leading-7 text-slate-500 lg:col-span-2">
            No public video posts have been published yet. Once the creator team publishes videos, replays, or announcements, they will appear here.
          </div>
        ) : null}
      </div>

      {activePost && playbackUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={activePost.title}
          onClick={() => setActivePostId(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_40px_120px_-50px_rgba(0,0,0,0.8)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Now playing</p>
                <h2 className="mt-1 text-lg font-black tracking-tight sm:text-xl">{activePost.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePostId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close player"
              >
                <FaXmark />
              </button>
            </div>

            <div className="bg-black">
              <div className="aspect-video w-full">
                <iframe
                  key={playbackUrl}
                  src={playbackUrl}
                  title={activePost.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
