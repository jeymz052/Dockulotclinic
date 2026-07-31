import Link from "next/link";
import PublicHeader from "@/src/components/layout/PublicHeader";
import { getPublicLiveEvents } from "@/src/lib/services/live-events";

export default async function LivePage() {
  const events = await getPublicLiveEvents(24);

  return (
    <main className="min-h-screen bg-white text-black">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 sm:pt-24">
        <div className="mb-8 border-b border-slate-200 pb-4 text-sm font-semibold text-slate-500">
          <Link href="/#live" className="transition hover:text-yellow-700">
            Landing page
          </Link>
          <span className="px-2 text-slate-400">/</span>
          <span className="text-slate-700">Live schedule</span>
        </div>

        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-700">Live Schedule Page</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Upcoming live sessions, webinars, and replays</h1>
          <p className="mt-4 leading-8 text-slate-600">
            Public visitors can use this page to follow Doctor Kulot&apos;s live health talks, open the stream or registration link,
            and check whether a replay has already been posted.
          </p>
        </div>

        <div className="mt-10 grid gap-5">
          {events.map((event) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-[2.25rem] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff_0%,#fafafa_52%,#f5f5f5_100%)] p-6 shadow-[0_24px_60px_-36px_rgba(17,17,17,0.22)]"
            >
              <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-stretch">
                <div className="flex flex-row gap-4 lg:flex-col">
                  <div className="min-w-[110px] rounded-[1.75rem] bg-[linear-gradient(180deg,#111111_0%,#2a2a2a_100%)] px-5 py-5 text-white shadow-lg shadow-black/20">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-200">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { month: "short" })}
                    </p>
                    <p className="mt-2 text-4xl font-black leading-none">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { day: "2-digit" })}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-200">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { year: "numeric" })}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-yellow-100 bg-white/85 px-4 py-4 text-sm text-slate-600">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">Starts at</p>
                    <p className="mt-2 text-base font-bold text-black">
                      {new Date(event.starts_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.9rem] border border-white/70 bg-white/80 p-5 backdrop-blur">
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-700">
                    <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-800">{event.status}</span>
                    {event.platform ? <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-700">{event.platform}</span> : null}
                    {event.registration_enabled ? (
                      <span className="rounded-full bg-white px-3 py-1.5 text-neutral-600">Registration enabled</span>
                    ) : null}
                  </div>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-black">{event.title}</h2>
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
                    {event.description || "More event details will appear here once the creator team adds the full health-talk summary."}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">
                      Live health talk
                    </span>
                    {event.content_posts?.title ? (
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                        Replay posted: {event.content_posts.title}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                        Replay will appear after the event
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-[1.9rem] border border-neutral-200 bg-white/90 p-5 shadow-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-700">Next step</p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-black">
                      {event.registration_enabled ? "Reserve your slot" : "Open the live stream"}
                    </h3>
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
                        className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                      >
                        {event.registration_enabled ? "Register / Join live" : "Open live link"}
                      </Link>
                    ) : null}
                    <Link
                      href="/#live"
                      className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-5 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Back to landing section
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!events.length ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm leading-7 text-slate-500">
              No live sessions are posted yet. Once the creator team schedules one from the internal content creator page, it will appear here.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
