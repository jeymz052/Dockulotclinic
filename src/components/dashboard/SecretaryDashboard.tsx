"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FaCalendarDays,
  FaCreditCard,
  FaHospital,
  FaInbox,
  FaPlus,
  FaFilePen,
  FaUserCheck,
  FaUserPlus,
  FaUsers,
  FaVideo,
  FaClipboardList,
  FaWandMagicSparkles,
  FaCircleQuestion,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { ActionCard, DashboardHero, MetricCard, SectionCard, StatusPill } from "@/src/components/dashboard/dashboard-ui";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel } from "@/src/lib/appointment-context";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function SecretaryDashboard() {
  const { appointments } = useAppointments();
  const { user, profile } = useRole();
  const name = profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Secretary";
  const { data: patients = [] } = usePatients();
  const today = todayIso();

  const todayAppointments = useMemo(() => appointments.filter((a) => a.date === today), [appointments, today]);
  const onlineToday = useMemo(() => appointments.filter((a) => a.type === "Online" && a.date === today).length, [appointments, today]);
  const waitingClinicBilling = useMemo(() => appointments.filter((a) => a.type === "Clinic" && a.status === "In Progress").length, [appointments]);
  const readyToConfirm = useMemo(() => appointments.filter((a) => a.status === "Confirmed" && a.date === today).length, [appointments, today]);
  // Patients who arrived at the front desk and are waiting for the doctor.
  const waitingForDoctor = useMemo(
    () => appointments.filter((a) => a.status === "Checked In" && a.date === today).length,
    [appointments, today],
  );

  const heroSummary = `${todayAppointments.length} appointment${todayAppointments.length === 1 ? "" : "s"} today · ${onlineToday} online`;

  return (
    <div className="space-y-6 pb-8">
      <DashboardHero
        eyebrow="Secretary Dashboard"
        title={`Good day, ${name}`}
        description="Keep bookings, walk-ins, and billing moving from one simple front-desk view."
        summary={heroSummary}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard href="/appointments" label="Today's Schedule" value={todayAppointments.length} helper="All appointments booked for today" tone="sky" icon={<FaCalendarDays className="text-2xl" />} />
        <MetricCard href="/payments/pos" label="Ready for Billing" value={waitingClinicBilling} helper="Clinic visits ready for POS" tone="amber" icon={<FaCreditCard className="text-2xl" />} />
        <MetricCard href="/patients" label="Patient Records" value={patients.length} helper="Total registered patients" tone="teal" icon={<FaUsers className="text-2xl" />} />
        <MetricCard href="/appointments?filter=online" label="Online Visits" value={onlineToday} helper="Virtual consultations needing links" tone="sky" icon={<FaVideo className="text-2xl" />} />
        <MetricCard href="/inquiries" label="Inquiries" value="Inbox" helper="Public and patient messages" tone="indigo" icon={<FaInbox className="text-2xl" />} />
        <MetricCard href="/contents" label="Website Content" value="Edit" helper="Landing page text and media" tone="indigo" icon={<FaWandMagicSparkles className="text-2xl" />} />
        <MetricCard href="/faq-content" label="FAQ Content" value="Edit" helper="Public clinic FAQs" tone="cyan" icon={<FaCircleQuestion className="text-2xl" />} />
      </div>

      <SectionCard
        title="Today's Appointment Queue"
        description="Keep track of everyone coming through the clinic today. Monitor check-ins and statuses in real time."
        actionLabel="Open appointments"
        actionHref="/appointments"
      >
        {todayAppointments.length === 0 ? (
          <div className="rounded-[1.75rem] border-2 border-dashed border-black/15 px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
              <FaCalendarDays className="text-2xl text-black" />
            </div>
            <p className="text-base font-semibold text-neutral-900">No appointments booked</p>
            <p className="mt-2 text-sm text-neutral-500">The schedule is clear for today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppointments.slice(0, 8).map((appt, i) => (
              <Link
                key={appt.id}
                href={`/appointments`}
                className={`group flex items-center justify-between gap-4 rounded-[1.25rem] border-2 border-transparent px-5 py-4 transition-all hover:border-black/10 hover:bg-black/5 hover:shadow-[0_12px_28px_rgba(17,17,17,0.12)] animate-slide-in-left stagger-${Math.min(i + 1, 8)}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${appt.type === "Online" ? "bg-black/5 text-black" : "bg-black/5 text-black"}`}>
                      {appt.type === "Online" ? <FaVideo className="text-sm" /> : <FaHospital className="text-sm" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">{appt.patientName}</p>
                    <p className="text-xs text-neutral-500">
                      {appt.start} · {appt.type}
                      {appt.reason ? ` • ${getAppointmentPrimaryLabel(appt.reason, appt.type)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill
                    tone={
                      appt.status === "In Progress"
                        ? "amber"
                        : appt.status === "Checked In"
                          ? "sky"
                          : appt.type === "Online"
                            ? "sky"
                            : "sky"
                    }
                    variant="outline"
                  >
                    {appt.status}
                  </StatusPill>
                  <span className="text-neutral-300 group-hover:text-neutral-400 transition-colors">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Front Desk Priorities" description="The most important tasks for today. Focus on these to keep the clinic running smoothly.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/appointments/my" className="group">
            <div className="relative overflow-hidden rounded-3xl border-2 border-black/10 bg-white px-6 py-6 transition-all hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(17,17,17,0.15)]">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <FaCalendarDays className="text-2xl text-black" />
                  <span className="text-xs font-bold text-black uppercase tracking-wider">Arrivals</span>
                </div>
                <p className="text-3xl font-black tracking-tight text-neutral-900">{readyToConfirm}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Confirmed patients to check in on arrival.</p>
              </div>
            </div>
          </Link>
          <Link href="/appointments/my" className="group">
            <div className="relative overflow-hidden rounded-3xl border-2 border-black/10 bg-white px-6 py-6 transition-all hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(17,17,17,0.15)]">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <FaUserCheck className="text-2xl text-black" />
                  <span className="text-xs font-bold text-black uppercase tracking-wider">Waiting Room</span>
                </div>
                <p className="text-3xl font-black tracking-tight text-neutral-900">{waitingForDoctor}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Checked in, waiting for the doctor.</p>
              </div>
            </div>
          </Link>
          <Link href="/appointments?filter=online" className="group">
            <div className="relative overflow-hidden rounded-3xl border-2 border-black/10 bg-white px-6 py-6 transition-all hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(17,17,17,0.15)]">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <FaVideo className="text-2xl text-black" />
                  <span className="text-xs font-bold text-black uppercase tracking-wider">Online Links</span>
                </div>
                <p className="text-3xl font-black tracking-tight text-neutral-900">{onlineToday}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Meeting links & reminders needed.</p>
              </div>
            </div>
          </Link>
          <Link href="/payments/pos" className="group">
            <div className="relative overflow-hidden rounded-3xl border-2 border-black/10 bg-white px-6 py-6 transition-all hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(17,17,17,0.15)]">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <FaCreditCard className="text-2xl text-black" />
                  <span className="text-xs font-bold text-black uppercase tracking-wider">Billing Queue</span>
                </div>
                <p className="text-3xl font-black tracking-tight text-neutral-900">{waitingClinicBilling}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-600">Clinic visits awaiting POS.</p>
              </div>
            </div>
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Front Desk Tools" description="Quick access to booking, management, and billing functions.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <ActionCard href="/appointments" title="Book Appointment" description="Create a new visit for an existing patient." tone="sky" icon={<FaPlus className="text-lg" />} />
          <ActionCard href="/appointments" title="Manage Queue" description="Review and update appointment statuses." tone="sky" icon={<FaClipboardList className="text-lg" />} />
          <ActionCard href="/patients/add" title="Add Walk-In" description="Register new walk-in patients quickly." tone="amber" icon={<FaUserPlus className="text-lg" />} />
          <ActionCard href="/payments/pos" title="POS Billing" description="Process payments and generate receipts." tone="sky" icon={<FaCreditCard className="text-lg" />} />
          <ActionCard href="/contents" title="Website Content" description="Edit landing-page text, images, and content sections." tone="indigo" icon={<FaFilePen className="text-lg" />} />
          <ActionCard href="/faq-content" title="FAQ Content" description="Manage public FAQs shown on the site." tone="cyan" icon={<FaInbox className="text-lg" />} />
        </div>
      </SectionCard>
    </div>
  );
}
