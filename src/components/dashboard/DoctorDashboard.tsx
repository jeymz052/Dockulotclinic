"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FaCalendarDays,
  FaChartLine,
  FaChartSimple,
  FaChevronRight,
  FaClipboardList,
  FaFileLines,
  FaFilePen,
  FaHospital,
  FaInbox,
  FaNotesMedical,
  FaPause,
  FaPrescriptionBottleMedical,
  FaUsers,
  FaVideo,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { ActionCard, DashboardHero, MetricCard, SectionCard, StatusPill } from "@/src/components/dashboard/dashboard-ui";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel, getAppointmentSecondaryReason } from "@/src/lib/appointment-context";
import type { AppointmentRecord } from "@/src/lib/appointments";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function cmpAppt(a: AppointmentRecord, b: AppointmentRecord) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.start !== b.start) return a.start.localeCompare(b.start);
  return a.queueNumber - b.queueNumber;
}

export default function DoctorDashboard() {
  const { user, profile } = useRole();
  const name = profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Doctor";
  const { appointments, isLoading } = useAppointments();
  const { data: notes } = useConsultationNotes();

  const today = isoToday();
  const todayQueue = useMemo(() => appointments.filter((a) => a.date === today).sort(cmpAppt), [appointments, today]);
  const upcoming = useMemo(
    () => appointments.filter((a) => a.date > today && a.status !== "Completed").sort(cmpAppt).slice(0, 6),
    [appointments, today],
  );
  const completedToday = useMemo(() => todayQueue.filter((a) => a.status === "Completed").length, [todayQueue]);
  const pendingNotes = useMemo(() => {
    const notedIds = new Set(notes.map((n) => n.appointmentId));
    return appointments.filter(
      (a) =>
        (a.status === "Completed" || a.status === "Confirmed" || a.status === "In Progress") &&
        !notedIds.has(a.id),
    ).length;
  }, [appointments, notes]);

  const totalSeen = appointments.filter((a) => a.status === "Completed").length;
  const nextInQueue = todayQueue.find((a) => a.status !== "Completed");
  const heroSummary = nextInQueue
    ? `Queue ready: ${todayQueue.length} patient${todayQueue.length === 1 ? "" : "s"} · next ${nextInQueue.patientName}`
    : `Queue ready: ${todayQueue.length} patient${todayQueue.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6 pb-8">
      <DashboardHero
        eyebrow="Doctor Dashboard"
        title={`Good day, ${name}`}
        description="Keep the consult flow moving, review who is next, and close notes without bouncing through extra screens."
        summary={heroSummary}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard href="/appointments" label="Today's Queue" value={todayQueue.length} helper="Patients waiting or checked in" tone="sky" icon={<FaUsers className="text-2xl" />} />
        <MetricCard href="/consultations/history" label="Completed Today" value={completedToday} helper="Patients seen and finished" tone="teal" icon={<FaChevronRight className="text-2xl" />} />
        <MetricCard href="/consultations" label="Pending Notes" value={pendingNotes} helper="Consultations needing documentation" tone="amber" icon={<FaNotesMedical className="text-2xl" />} />
        <MetricCard href="/consultations/history" label="Total Consultations" value={totalSeen} helper="All completed appointments on record" tone="sky" icon={<FaChartSimple className="text-2xl" />} />
        <MetricCard href="/prescriptions" label="Prescriptions" value="Rx" helper="Create and review prescriptions" tone="cyan" icon={<FaPrescriptionBottleMedical className="text-2xl" />} />
        <MetricCard href="/patients/records" label="Records Review" value="Files" helper="Patient records and uploaded files" tone="sky" icon={<FaFileLines className="text-2xl" />} />
        <MetricCard href="/inquiries" label="Follow-ups" value="Inbox" helper="Patient questions after visits" tone="amber" icon={<FaInbox className="text-2xl" />} />
        <MetricCard href="/reports" label="Clinical Reports" value="View" helper="Appointment and patient activity" tone="indigo" icon={<FaChartLine className="text-2xl" />} />
      </div>

      {nextInQueue ? (
        <section className="relative overflow-hidden rounded-[2.5rem] border-2 border-yellow-200 bg-linear-to-br from-amber-50/80 via-amber-50/40 to-amber-50/20 p-8 shadow-[0_28px_54px_rgba(133,77,14,0.18)] animate-pop-in transition hover:-translate-y-1">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-linear-to-br from-yellow-300/25 to-amber-200/15 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-linear-to-r from-amber-200/20 to-amber-100/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 mb-4">
                  <span className="h-3 w-3 rounded-full bg-yellow-600 animate-pulse" />
                  <span className="text-xs font-bold text-yellow-700">NEXT IN QUEUE</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 mt-3">
                  {nextInQueue.patientName}
                </h2>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 font-bold text-yellow-700">
                      #{nextInQueue.queueNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Queue #{nextInQueue.queueNumber}</p>
                      <p className="text-xs text-slate-500">Position in today&apos;s queue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-lg">
                      {nextInQueue.type === "Online" ? <FaVideo className="text-sm text-yellow-700" /> : <FaHospital className="text-sm text-yellow-700" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{nextInQueue.start} · {nextInQueue.type}</p>
                      <p className="text-xs text-slate-500">
                        {getAppointmentPrimaryLabel(nextInQueue.reason, nextInQueue.type)}
                        {getAppointmentSecondaryReason(nextInQueue.reason)
                          ? ` • ${getAppointmentSecondaryReason(nextInQueue.reason)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end lg:justify-start">
                <StatusPill tone={nextInQueue.status === "Completed" ? "sky" : nextInQueue.status === "In Progress" ? "amber" : nextInQueue.type === "Online" ? "sky" : "sky"}>
                  {nextInQueue.status}
                </StatusPill>
                {nextInQueue.type === "Online" && nextInQueue.meetingLink ? (
                  <a
                    href={nextInQueue.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-yellow-400 to-yellow-400 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(133,77,14,0.3)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(133,77,14,0.4)]"
                  >
                    <FaVideo />
                    Join meeting
                  </a>
                ) : null}
                <Link
                  href="/consultations"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-yellow-300 bg-white px-6 py-3 text-sm font-bold text-yellow-700 transition hover:bg-yellow-50 hover:shadow-[0_8px_16px_rgba(133,77,14,0.1)]"
                >
                  <FaClipboardList />
                  Open Notes
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <SectionCard
        title="Today's Patient Queue"
        description="Manage the flow of your day. See status, timing, and move patients through seamlessly."
        actionLabel="View full list"
        actionHref="/appointments"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl shimmer" />
            ))}
          </div>
        ) : todayQueue.length === 0 ? (
          <div className="rounded-[1.75rem] border-2 border-dashed border-yellow-200 px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <FaCalendarDays className="text-2xl text-yellow-700" />
            </div>
            <p className="text-base font-semibold text-slate-900">No appointments today</p>
            <p className="mt-2 text-sm text-slate-500">The schedule is clear. Enjoy your break or catch up on notes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayQueue.map((appt, i) => (
              <Link
                key={appt.id}
                href={`/consultations`}
                className={`group relative overflow-hidden flex items-center justify-between gap-4 rounded-[1.25rem] border-2 border-transparent px-5 py-4 transition-all hover:border-yellow-200 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(133,77,14,0.12)] animate-slide-in-left stagger-${Math.min(i + 1, 8)}`}
              >
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-linear-to-br from-yellow-300/10 to-amber-200/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex min-w-0 items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
                      appt.status === "Completed" ? "bg-linear-to-br from-yellow-300 to-yellow-400" : "bg-linear-to-br from-yellow-300 to-yellow-400"
                    }`}
                  >
                    {appt.queueNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{appt.patientName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {appt.start} · {appt.type}
                      {appt.reason ? ` • ${getAppointmentPrimaryLabel(appt.reason, appt.type)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={appt.status === "Completed" ? "emerald" : appt.status === "In Progress" ? "amber" : appt.type === "Online" ? "sky" : "teal"} variant="outline">
                    {appt.status}
                  </StatusPill>
                  <span className="text-slate-300 group-hover:text-slate-400 transition-colors">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Upcoming This Week"
        description="Plan ahead and prepare for upcoming consultations. Block time for follow-ups or admin work."
        actionLabel="Manage schedule"
        actionHref="/schedules"
      >
        {upcoming.length === 0 ? (
          <div className="rounded-[1.75rem] border-2 border-dashed border-slate-200 px-8 py-10 text-center">
            <p className="text-sm text-slate-500">No upcoming appointments scheduled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt, i) => (
              <Link
                key={appt.id}
                href={`/appointments`}
                className={`group flex items-center justify-between gap-4 rounded-[1.25rem] border-2 border-transparent px-5 py-4 transition-all hover:border-yellow-200 hover:bg-yellow-50/60 hover:shadow-[0_8px_20px_rgba(133,77,14,0.08)] animate-slide-in-left stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-yellow-300 to-yellow-400 text-white font-bold">
                    {appt.queueNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{appt.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(appt.date)} at {appt.start} · {appt.type}
                    </p>
                  </div>
                </div>
                <span className="text-slate-300 group-hover:text-slate-400 transition-colors">→</span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Doctor Tools" description="Quick access to your most-used consultation and scheduling tools.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ActionCard href="/consultations" title="Write Consultation" description="Document patient encounters and notes." tone="sky" icon={<FaNotesMedical className="text-lg" />} />
          <ActionCard href="/consultations/history" title="Patient History" description="Review past visits and medical notes." tone="sky" icon={<FaClipboardList className="text-lg" />} />
          <ActionCard href="/schedules" title="Your Schedule" description="See the week and plan your day." tone="sky" icon={<FaCalendarDays className="text-lg" />} />
          <ActionCard href="/schedules/slots" title="Blocked Dates" description="Mark leave, closures, and unavailable days." tone="amber" icon={<FaPause className="text-lg" />} />
          <ActionCard href="/consultations" title="Online Consultation" description="Start or join active virtual consultation rooms." tone="violet" icon={<FaVideo className="text-lg" />} />
          <ActionCard href="/creator-content" title="Content Status" description="Review blog, vlog, and live schedule content." tone="indigo" icon={<FaFilePen className="text-lg" />} />
        </div>
      </SectionCard>
    </div>
  );
}
