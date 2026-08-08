"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FaArrowUpRightFromSquare,
  FaCalendarCheck,
  FaCalendarDays,
  FaCircleCheck,
  FaClock,
  FaHospital,
  FaVideo,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { getAppointmentPrimaryLabel, getAppointmentSecondaryReason } from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";

type MyAppointmentsPageProps = {
  title?: string;
  description?: string;
};

type AppointmentTab = "upcoming" | "history";
type AppointmentFilter = "all" | "online" | "clinic";

export default function MyAppointmentsPage({
  title = "My Appointments",
  description = "",
}: MyAppointmentsPageProps) {
  const { appointments, isLoading, error } = useAppointments();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryFilter = searchParams.get("filter");
  const highlightedAppointmentId = searchParams.get("appointment");
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const today = getClinicToday();

  const initialTab: AppointmentTab = queryTab === "completed" ? "history" : "upcoming";
  const [manualTab, setManualTab] = useState<AppointmentTab>(initialTab);

  const activeFilter: AppointmentFilter =
    queryFilter === "online" || queryFilter === "clinic" ? queryFilter : "all";

  const upcoming = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date >= today && appointment.status !== "Completed")
        .sort((left, right) =>
          `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`),
        ),
    [appointments, today],
  );

  const history = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date < today || appointment.status === "Completed")
        .sort((left, right) =>
          `${right.date} ${right.start}`.localeCompare(`${left.date} ${left.start}`),
        ),
    [appointments, today],
  );

  const filteredUpcoming = useMemo(
    () => applyFilter(upcoming, activeFilter),
    [upcoming, activeFilter],
  );
  const filteredHistory = useMemo(
    () => applyFilter(history, activeFilter),
    [history, activeFilter],
  );

  const nextAppointment = filteredUpcoming[0] ?? null;
  const nextOnlineAppointment = filteredUpcoming.find(
    (appointment) => appointment.type === "Online" && appointment.meetingLink,
  ) ?? null;
  const highlightedAppointment = highlightedAppointmentId
    ? appointments.find((appointment) => appointment.id === highlightedAppointmentId) ?? null
    : null;
  const highlightedTab: AppointmentTab | null = highlightedAppointment
    ? highlightedAppointment.date < today || highlightedAppointment.status === "Completed"
      ? "history"
      : "upcoming"
    : null;
  const activeTab = highlightedTab ?? (queryTab === "completed" ? "history" : manualTab);
  const visibleAppointments = activeTab === "upcoming" ? filteredUpcoming : filteredHistory;

  const onlineReadyCount = appointments.filter(
    (appointment) => appointment.type === "Online" && appointment.meetingLink,
  ).length;
  const clinicCount = appointments.filter((appointment) => appointment.type === "Clinic").length;
  const completedCount = appointments.filter((appointment) => appointment.status === "Completed").length;

  useEffect(() => {
    if (!highlightedAppointmentId || !highlightedRef.current) return;
    highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTab, highlightedAppointmentId, visibleAppointments.length]);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(17,17,17,0.16),transparent_30%),linear-gradient(135deg,#f5f5f5_0%,#ffffff_56%,#f5f5f5_100%)] p-6 shadow-[0_28px_70px_rgba(17,17,17,0.12)]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">
              Appointments
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {description || "Keep track of upcoming visits, join online consultations quickly, and review past care in one calm timeline."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <FilterPill href="/appointments/my" active={activeFilter === "all"}>
                All visits
              </FilterPill>
              <FilterPill href="/appointments/my?filter=online" active={activeFilter === "online"}>
                Online consultations
              </FilterPill>
              <FilterPill href="/appointments/my?filter=clinic" active={activeFilter === "clinic"}>
                Clinic visits
              </FilterPill>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quick Join
            </p>
            {nextOnlineAppointment ? (
              <>
                <p className="mt-3 text-xl font-black text-slate-900">
                  {formatDisplayDate(nextOnlineAppointment.date)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {formatRange(nextOnlineAppointment.start, nextOnlineAppointment.end)}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {getDoctorById(nextOnlineAppointment.doctorId)?.name ?? "Assigned doctor"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Queue #{nextOnlineAppointment.queueNumber} • Link ready for your session
                </p>
                <a
                  href={nextOnlineAppointment.meetingLink ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5"
                >
                  <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                  Join Consultation
                </a>
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-bold text-slate-900">No online session ready yet</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Your consultation link will appear here as soon as the clinic prepares it.
                </p>
                <Link
                  href="/appointments"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <FaCalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Book Another Appointment
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Upcoming" value={filteredUpcoming.length} tone="emerald" icon={<FaCalendarDays className="h-4 w-4" />} />
        <MetricCard label="Online Ready" value={onlineReadyCount} tone="sky" icon={<FaVideo className="h-4 w-4" />} />
        <MetricCard label="Clinic Visits" value={clinicCount} tone="teal" icon={<FaHospital className="h-4 w-4" />} />
        <MetricCard label="Completed" value={completedCount} tone="amber" icon={<FaCircleCheck className="h-4 w-4" />} />
      </div>

      {nextAppointment ? (
        <section className="rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_right,rgba(17,17,17,0.12),transparent_28%),linear-gradient(135deg,#f0fbff,#ffffff_55%,#f5f5f5)] p-6 shadow-[0_20px_45px_rgba(17,17,17,0.12)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">
                Next Up
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {formatDisplayDate(nextAppointment.date)} • {formatRange(nextAppointment.start, nextAppointment.end)}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {getDoctorById(nextAppointment.doctorId)?.name ?? "Assigned doctor"} • {nextAppointment.type} • Queue #{nextAppointment.queueNumber}
              </p>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                {getAppointmentPrimaryLabel(nextAppointment.reason, nextAppointment.type)}
                {getAppointmentSecondaryReason(nextAppointment.reason)
                  ? ` • ${getAppointmentSecondaryReason(nextAppointment.reason)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {nextAppointment.meetingLink ? (
                <a
                  href={nextAppointment.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black"
                >
                  <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                  Join Consultation
                </a>
              ) : null}
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <FaCalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Book Another
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-neutral-100 bg-white shadow-[0_18px_45px_rgba(17,17,17,0.06)]">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 p-1">
            <TabButton
              label={`Upcoming (${filteredUpcoming.length})`}
              active={activeTab === "upcoming"}
              onClick={() => setManualTab("upcoming")}
            />
            <TabButton
              label={`History (${filteredHistory.length})`}
              active={activeTab === "history"}
              onClick={() => setManualTab("history")}
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {filterLabel(activeFilter)}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 px-5 py-6">
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
          </div>
        ) : visibleAppointments.length === 0 ? (
          <EmptyState activeTab={activeTab} activeFilter={activeFilter} />
        ) : (
          <div className="grid gap-4 px-5 py-5">
            {visibleAppointments.map((appointment) => {
              const doctor = getDoctorById(appointment.doctorId);
              const isHighlighted = appointment.id === highlightedAppointmentId;
              const linkReady = Boolean(appointment.meetingLink);
              return (
                <article
                  key={appointment.id}
                  ref={isHighlighted ? highlightedRef : null}
                  className={`rounded-[1.5rem] border p-5 transition-all ${
                    isHighlighted
                      ? "border-neutral-400 bg-neutral-50/80 ring-2 ring-neutral-200"
                      : "border-slate-200 bg-white hover:border-neutral-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={appointment.type} />
                        <StatusBadge status={appointment.status} />
                        {appointment.type === "Online" ? (
                          <InfoBadge tone={linkReady ? "sky" : "slate"}>
                            {linkReady ? "Meeting link ready" : "Waiting for meeting link"}
                          </InfoBadge>
                        ) : null}
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-slate-900">
                        {formatDisplayDate(appointment.date)} • {formatRange(appointment.start, appointment.end)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {doctor?.name ?? "Assigned doctor"} • Queue #{appointment.queueNumber}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {getAppointmentPrimaryLabel(appointment.reason, appointment.type)}
                        {getAppointmentSecondaryReason(appointment.reason)
                          ? ` • ${getAppointmentSecondaryReason(appointment.reason)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {appointment.meetingLink ? (
                        <a
                          href={appointment.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          <FaArrowUpRightFromSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Join now
                        </a>
                      ) : null}
                      <Link
                        href={`/appointments/my?appointment=${encodeURIComponent(appointment.id)}`}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                      >
                        <FaClock className="h-3.5 w-3.5" aria-hidden="true" />
                        View details
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function applyFilter(appointments: AppointmentRecord[], filter: AppointmentFilter) {
  if (filter === "all") return appointments;
  const expectedType: AppointmentType = filter === "online" ? "Online" : "Clinic";
  return appointments.filter((appointment) => appointment.type === expectedType);
}

function filterLabel(filter: AppointmentFilter) {
  if (filter === "online") return "Online consultations";
  if (filter === "clinic") return "Clinic visits";
  return "All appointments";
}

function EmptyState({
  activeTab,
  activeFilter,
}: {
  activeTab: AppointmentTab;
  activeFilter: AppointmentFilter;
}) {
  const isUpcoming = activeTab === "upcoming";
  const filterText = filterLabel(activeFilter).toLowerCase();
  return (
      <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-50 text-neutral-500">
        <FaCalendarDays className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {isUpcoming ? `No upcoming ${filterText}` : `No ${filterText} in history yet`}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {isUpcoming
          ? "Once your next booking is confirmed, it will show up here with the right action for joining or reviewing it."
          : "Completed and past visits will appear here after your consultation has been finished."}
      </p>
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "border border-white/80 bg-white/80 text-slate-700 hover:border-neutral-200 hover:bg-white"
      }`}
    >
      {children}
    </Link>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "emerald" | "teal" | "amber" | "sky";
  icon: ReactNode;
}) {
  const accent = {
    emerald: "bg-neutral-300 text-neutral-700",
    teal: "bg-neutral-300 text-neutral-700",
    amber: "bg-neutral-300 text-neutral-700",
    sky: "bg-neutral-300 text-neutral-700",
  } as const;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-neutral-100 bg-white p-5 shadow-[0_16px_34px_rgba(17,17,17,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(17,17,17,0.12)]">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 ${accent[tone].split(" ")[0]}`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 ${accent[tone].split(" ")[1]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[linear-gradient(135deg,#111111,#111111)] text-white shadow-sm"
              : "text-slate-600 hover:bg-white hover:text-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

function TypeBadge({ type }: { type: AppointmentType }) {
  if (type === "Online") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
        <FaVideo className="h-3 w-3" aria-hidden="true" />
        Online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
      <FaHospital className="h-3 w-3" aria-hidden="true" />
      Clinic
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Pending"
      ? "bg-neutral-50 text-neutral-700"
      : status === "In Progress"
      ? "bg-neutral-50 text-neutral-700"
      : status === "Completed"
        ? "bg-neutral-50 text-neutral-700"
        : status === "Confirmed"
          ? "bg-neutral-50 text-neutral-700"
          : "bg-neutral-50 text-neutral-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function InfoBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "sky" | "slate";
}) {
  const styles = {
    sky: "bg-neutral-50 text-neutral-700",
    slate: "bg-slate-100 text-slate-600",
  } as const;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}
