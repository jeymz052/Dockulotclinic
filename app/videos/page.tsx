import Link from "next/link";
import type { Metadata } from "next";
import { FaArrowRight } from "react-icons/fa";
import PublicHeader from "@/src/components/layout/PublicHeader";
import PublicVideoGallery from "@/src/components/videos/PublicVideoGallery";
import { getPublishedMediaPosts } from "@/src/lib/services/content-posts";

export const metadata: Metadata = {
  title: "Videos and Vlogs",
  description:
    "Watch Doc Kulot public videos, vlogs, health education content, live replays, and clinic announcements.",
  alternates: {
    canonical: "/videos",
  },
};

export default async function VideosPage() {
  const videos = await getPublishedMediaPosts(24);

  return (
    <main className="min-h-screen bg-neutral-50 text-black">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 sm:pt-24">
        <div className="mb-8 border-b border-neutral-200 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-neutral-500">
              <Link href="/#videos" className="transition hover:text-gold-700">
                Landing page
              </Link>
              <span className="px-2 text-neutral-400">/</span>
              <span className="text-neutral-700">Videos and vlogs</span>
            </div>
            <Link
              href="/#videos"
              className="inline-flex items-center gap-2 self-start rounded-full border border-gold-200 bg-white px-4 py-2 text-sm font-bold text-gold-700 transition hover:bg-gold-50"
            >
              Back to vlogs
              <FaArrowRight />
            </Link>
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gold-700">Video / Vlog Page</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Doctor content, public videos, and live replays</h1>
          <p className="mt-4 leading-8 text-neutral-600">
            This page pulls from the content creator platform so Doctor Kulot can manage YouTube, TikTok, Facebook,
            replay, and announcement content in one place.
          </p>
        </div>

        <div className="mt-10">
          <PublicVideoGallery posts={videos} />
        </div>
      </section>
    </main>
  );
}
