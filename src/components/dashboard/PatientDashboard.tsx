"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FaCalendarDays,
  FaChevronRight,
  FaCreditCard,
  FaFileLines,
  FaHospital,
  FaInbox,
  FaPrescriptionBottleMedical,
  FaShieldHalved,
  FaVideo,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
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

function upcomingComparator(a: AppointmentRecord, b: AppointmentRecord) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.start.localeCompare(b.start);
}

export default function PatientDashboard() {
  const { user } = useRole();
  const name = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Patient";
  const { appointments, isLoading } = useAppointments();

  const today = isoToday();
  const upcoming = useMemo(
    () => appointments.filter((a) => a.date >= today && a.status !== "Completed").sort(upcomingComparator),
    [appointments, today],
  );
  const pastCompleted = useMemo(() => appointments.filter((a) => a.status === "Completed").length, [appointments]);
  const onlineConsultations = useMemo(() => appointments.filter((a) => a.type === "Online").length, [appointments]);
  const clinicVisits = useMemo(() => appointments.filter((a) => a.type === "Clinic").length, [appointments]);

  const next = upcoming[0] ?? null;
  const heroSummary = next ? `Next: ${formatDate(next.date)} at ${next.start}` : `You're all set!`;

  return (
    <div className="space-y-6 pb-8">
      <DashboardHero
        eyebrow="Patient Dashboard"
        title={`Welcome, ${name}`}
        description="See upcoming visits, open your meeting link, and reach your records from one calm dashboard."
        summary={heroSummary}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard href="/appointments/my" label="Upcoming" value={upcoming.length} helper="Appointments waiting for you" tone="sky" icon={<FaCalendarDays className="text-2xl" />} />
        <MetricCard href="/appointments/my?filter=clinic" label="Clinic Visits" value={clinicVisits} helper="In-person appointments" tone="teal" icon={<FaHospital className="text-2xl" />} />
        <MetricCard href="/consultations" label="Online Consults" value={onlineConsultations} helper="Video consultations" tone="sky" icon={<FaVideo className="text-2xl" />} />
        <MetricCard href="/appointments/my?tab=completed" label="Completed" value={pastCompleted} helper="Past visits completed" tone="sky" icon={<FaChevronRight className="text-2xl" />} />
        <MetricCard href="/portal" label="Patient Portal" value="Open" helper="All patient records" tone="sky" icon={<FaShieldHalved className="text-2xl" />} />
        <MetricCard href="/profile/files" label="Medical Files" value="Files" helper="Lab results and documents" tone="indigo" icon={<FaFileLines className="text-2xl" />} />
        <MetricCard href="/prescriptions" label="Prescriptions" value="Rx" helper="Medicine instructions" tone="sky" icon={<FaPrescriptionBottleMedical className="text-2xl" />} />
        <MetricCard href="/payments/history" label="Receipts" value="Paid" helper="Billing history and receipts" tone="cyan" icon={<FaCreditCard className="text-2xl" />} />
        <MetricCard href="/profile/inquiries" label="Follow-ups" value="Ask" helper="Questions after your visit" tone="amber" icon={<FaInbox className="text-2xl" />} />
      </div>

      {next ? (
          <section className="relative overflow-hidden rounded-[2.5rem] border-2 border-yellow-200 bg-linear-to-br from-amber-50/80 via-amber-50/40 to-amber-50/20 p-8 shadow-[0_28px_54px_rgba(133,77,14,0.16)] animate-pop-in transition hover:-translate-y-1">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-linear-to-br from-yellow-300/20 to-amber-200/10 blur-3xl" />
            <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-linear-to-r from-amber-200/20 to-amber-100/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 mb-4">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-xs font-bold text-yellow-700">YOUR NEXT APPOINTMENT</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 mt-3">
                  {formatDate(next.date)} <span className="text-amber-400">·</span> {next.start}
                </h2>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                      <span className="text-lg">#{next.queueNumber}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Queue Position</p>
                      <p className="text-xs text-slate-500">You are next in queue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                      {next.type === "Online" ? <FaVideo className="text-sm text-yellow-700" /> : <FaHospital className="text-sm text-yellow-700" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{getAppointmentPrimaryLabel(next.reason, next.type)}</p>
                      <p className="text-xs text-slate-500">{getAppointmentSecondaryReason(next.reason) || "No additional note provided."}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
                <StatusPill tone={next.status === "Confirmed" ? "sky" : next.status === "In Progress" ? "amber" : "slate"}>
                  {next.status}
                </StatusPill>
                {next.type === "Online" && next.meetingLink ? (
                  <a
                    href={next.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-yellow-400 to-yellow-300 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(133,77,14,0.3)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(133,77,14,0.4)]"
                  >
                    <FaVideo />
                    Join consultation
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <SectionCard
        title="Your Upcoming Schedule"
        description="Don't miss your appointments. Check dates, times, and join online consultations directly."
        actionLabel="View all appointments"
        actionHref="/appointments/my"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl shimmer" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-[1.75rem] border-2 border-dashed border-yellow-200 px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <FaCalendarDays className="text-2xl text-yellow-700" />
            </div>
            <p className="text-base font-semibold text-slate-900">No upcoming appointments</p>
            <p className="mt-2 text-sm text-slate-500">You&apos;re all caught up! Book your next appointment when you need one.</p>
            <Link
              href="/appointments"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-linear-to-r from-yellow-400 to-yellow-300 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(133,77,14,0.25)] transition hover:-translate-y-1"
            >
              <FaCalendarDays />
              Book appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 6).map((appt, i) => (
              <Link
                key={appt.id}
                href={`/appointments/my`}
                className={`group flex items-center justify-between gap-4 rounded-[1.25rem] border-2 border-transparent px-5 py-4 transition-all hover:border-yellow-200 hover:bg-yellow-50/60 hover:shadow-[0_8px_20px_rgba(133,77,14,0.10)] animate-slide-in-left stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${appt.type === "Online" ? "bg-linear-to-br from-yellow-300 to-yellow-400" : "bg-linear-to-br from-yellow-300 to-yellow-400"}`}>
                    {appt.type === "Online" ? <FaVideo className="text-sm" /> : <FaHospital className="text-sm" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{formatDate(appt.date)} · {appt.start}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {appt.type === "Online" ? "Online consultation" : "Clinic visit"}
                      {getAppointmentPrimaryLabel(appt.reason, appt.type) ? ` • ${getAppointmentPrimaryLabel(appt.reason, appt.type)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={appt.status === "Confirmed" ? "sky" : appt.status === "In Progress" ? "amber" : "slate"} variant="outline">
                    {appt.status}
                  </StatusPill>
                  <span className="text-slate-300 group-hover:text-slate-400 transition-colors">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quick Links" description="Fast access to the tools you need most.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard href="/appointments" title="Book New Appointment" description="Schedule your next visit at a time that works for you." tone="emerald" icon={<FaCalendarDays className="text-lg" />} />
          <ActionCard href="/appointments/my" title="View Schedule" description="See your upcoming and past appointments." tone="teal" icon={<FaCalendarDays className="text-lg" />} />
          <ActionCard href="/payments" title="Online Payments" description="Pay active billings and review payment status." tone="sky" icon={<FaCreditCard className="text-lg" />} />
          <ActionCard href="/payments/history" title="Payment History" description="Open receipts and past transaction records." tone="cyan" icon={<FaChevronRight className="text-lg" />} />
          <ActionCard href="/consultations" title="Join Online Consultation" description="Open your active online consultation link." tone="violet" icon={<FaVideo className="text-lg" />} />
          <ActionCard href="/consultations/history" title="Consultation History" description="Review past visit notes and follow-ups." tone="cyan" icon={<FaFileLines className="text-lg" />} />
        </div>
      </SectionCard>
    </div>
  );
}
