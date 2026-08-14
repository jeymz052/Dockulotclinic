"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  FaArrowUpRightFromSquare,
  FaCalendarCheck,
  FaCalendarDays,
  FaCalendarPlus,
  FaCalendarXmark,
  FaCircleCheck,
  FaClock,
  FaHospital,
  FaTriangleExclamation,
  FaVideo,
  FaXmark,
} from "react-icons/fa6";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  getAppointmentPrimaryLabel,
  getAppointmentSecondaryReason,
  isProcedureServiceTitle,
  parseAppointmentContext,
} from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import { CONSULTATION_SLOT_MINUTES, PROCEDURE_SLOT_MINUTES } from "@/src/lib/clinic-schedule";

type MyAppointmentsPageProps = {
  title?: string;
  description?: string;
};

type AppointmentTab = "upcoming" | "history";
type AppointmentFilter = "all" | "online" | "clinic";

type RescheduleRequestView = {
  id: string;
  appointmentId: string;
  requestedDate: string;
  requestedStart: string;
  requestedEnd: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
};

export default function MyAppointmentsPage({
  title = "My Appointments",
  description = "",
}: MyAppointmentsPageProps) {
  const { accessToken } = useRole();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryFilter = searchParams.get("filter");
  const highlightedAppointmentId = searchParams.get("appointment");
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const today = getClinicToday();

  const initialTab: AppointmentTab = queryTab === "completed" ? "history" : "upcoming";
  const [manualTab, setManualTab] = useState<AppointmentTab>(initialTab);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<AppointmentRecord | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentRecord | null>(null);
  const [pendingRequests, setPendingRequests] = useState<RescheduleRequestView[]>([]);
  const [isMutating, startMutation] = useTransition();

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

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadRequests() {
      try {
        const response = await fetch("/api/v2/appointment-reschedule-requests?status=Pending", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await response.json().catch(() => ({}))) as {
          requests?: RescheduleRequestView[];
          message?: string;
        };
        if (!response.ok) throw new Error(body.message ?? "Could not load reschedule requests.");
        if (active) setPendingRequests(body.requests ?? []);
      } catch {
        if (active) setPendingRequests([]);
      }
    }

    void loadRequests();
    return () => {
      active = false;
    };
  }, [accessToken]);

  function canChangeAppointment(appointment: AppointmentRecord) {
    return appointment.date >= today
      && (appointment.status === "Pending" || appointment.status === "Confirmed");
  }

  function cancelAppointment(appointmentId: string) {
    if (!accessToken) {
      setFeedback({ message: "Sign in again to cancel your appointment.", type: "error" });
      return;
    }

    startMutation(async () => {
      try {
        const response = await fetch(`/api/v2/appointments/${appointmentId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Cancelled by patient from portal" }),
        });
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        if (!response.ok) throw new Error(body.message ?? "Could not cancel appointment.");
        setAppointments((current) => current.filter((appointment) => appointment.id !== appointmentId));
        setPendingRequests((current) => current.filter((request) => request.appointmentId !== appointmentId));
        setConfirmingCancelId(null);
        setFeedback({ message: "Appointment cancelled. The clinic has been notified.", type: "success" });
      } catch (cancelError) {
        setFeedback({
          message: cancelError instanceof Error ? cancelError.message : "Could not cancel appointment.",
          type: "error",
        });
      }
    });
  }

  function submitReschedule(input: {
    appointmentId: string;
    requestedDate: string;
    requestedStart: string;
    reason: string;
  }) {
    if (!accessToken) {
      setFeedback({ message: "Sign in again to request a new schedule.", type: "error" });
      return;
    }

    startMutation(async () => {
      try {
        const response = await fetch("/api/v2/appointment-reschedule-requests", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appointment_id: input.appointmentId,
            requested_date: input.requestedDate,
            requested_start: input.requestedStart,
            reason: input.reason,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          request?: RescheduleRequestView;
          message?: string;
        };
        if (!response.ok || !body.request) {
          throw new Error(body.message ?? "Could not submit reschedule request.");
        }
        const createdRequest = body.request;
        setPendingRequests((current) => [
          ...current.filter((request) => request.appointmentId !== createdRequest.appointmentId),
          createdRequest,
        ]);
        setRescheduleAppointment(null);
        setFeedback({
          message: "Reschedule request sent. The clinic or assigned doctor will review it.",
          type: "success",
        });
      } catch (requestError) {
        setFeedback({
          message: requestError instanceof Error ? requestError.message : "Could not submit reschedule request.",
          type: "error",
        });
      }
    });
  }

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
              {description || "Keep track of upcoming visits, join virtual consults quickly, and review past care in one calm timeline."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <FilterPill href="/appointments/my" active={activeFilter === "all"}>
                All visits
              </FilterPill>
              <FilterPill href="/appointments/my?filter=online" active={activeFilter === "online"}>
                Virtual consults
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
                <p className="mt-3 text-lg font-bold text-slate-900">No virtual consult ready yet</p>
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

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Upcoming" value={filteredUpcoming.length} tone="emerald" icon={<FaCalendarDays className="h-4 w-4" />} />
        <MetricCard label="Virtual Ready" value={onlineReadyCount} tone="sky" icon={<FaVideo className="h-4 w-4" />} />
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
                {getDoctorById(nextAppointment.doctorId)?.name ?? "Assigned doctor"} • {formatAppointmentType(nextAppointment.type)} • Queue #{nextAppointment.queueNumber}
              </p>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                {getAppointmentPrimaryLabel(nextAppointment.reason, nextAppointment.type)}
                {getAppointmentSecondaryReason(nextAppointment.reason)
                  ? ` • ${getAppointmentSecondaryReason(nextAppointment.reason)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canChangeAppointment(nextAppointment) ? (
                pendingRequests.some((request) => request.appointmentId === nextAppointment.id) ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700">
                    <FaClock className="h-3.5 w-3.5" aria-hidden="true" />
                    Reschedule pending
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRescheduleAppointment(nextAppointment)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FaCalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Request Reschedule
                  </button>
                )
              ) : null}
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
              {canChangeAppointment(nextAppointment) ? (
                confirmingCancelId === nextAppointment.id ? (
                  <ConfirmPatientCancel
                    disabled={isMutating}
                    onKeep={() => setConfirmingCancelId(null)}
                    onConfirm={() => cancelAppointment(nextAppointment.id)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCancelId(nextAppointment.id)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FaCalendarXmark className="h-3.5 w-3.5" aria-hidden="true" />
                    Cancel
                  </button>
                )
              ) : null}
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
              const pendingRequest = pendingRequests.find((request) => request.appointmentId === appointment.id) ?? null;
              const canChange = canChangeAppointment(appointment);
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
                      {canChange ? (
                        pendingRequest ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-neutral-700">
                            <FaClock className="h-3.5 w-3.5" aria-hidden="true" />
                            Reschedule pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRescheduleAppointment(appointment)}
                            disabled={isMutating}
                            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FaCalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                            Reschedule
                          </button>
                        )
                      ) : null}
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
                      <button
                        type="button"
                        onClick={() => setDetailsAppointment(appointment)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                      >
                        <FaClock className="h-3.5 w-3.5" aria-hidden="true" />
                        View details
                      </button>
                      {canChange ? (
                        confirmingCancelId === appointment.id ? (
                          <ConfirmPatientCancel
                            disabled={isMutating}
                            onKeep={() => setConfirmingCancelId(null)}
                            onConfirm={() => cancelAppointment(appointment.id)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingCancelId(appointment.id)}
                            disabled={isMutating}
                            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FaCalendarXmark className="h-3.5 w-3.5" aria-hidden="true" />
                            Cancel
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {rescheduleAppointment ? (
        <RescheduleRequestModal
          appointment={rescheduleAppointment}
          isSubmitting={isMutating}
          onClose={() => setRescheduleAppointment(null)}
          onSubmit={submitReschedule}
        />
      ) : null}
      {detailsAppointment ? (
        <AppointmentDetailsModal
          appointment={detailsAppointment}
          pendingRequest={pendingRequests.find((request) => request.appointmentId === detailsAppointment.id) ?? null}
          onClose={() => setDetailsAppointment(null)}
        />
      ) : null}
    </div>
  );
}

function ConfirmPatientCancel({
  disabled,
  onKeep,
  onConfirm,
}: {
  disabled: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800">
        <FaTriangleExclamation className="h-3 w-3" aria-hidden="true" />
        Cancel?
      </span>
      <button
        type="button"
        onClick={onKeep}
        className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Keep
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm
      </button>
    </div>
  );
}

function RescheduleRequestModal({
  appointment,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  appointment: AppointmentRecord;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    appointmentId: string;
    requestedDate: string;
    requestedStart: string;
    reason: string;
  }) => void;
}) {
  const today = getClinicToday();
  const [requestedDate, setRequestedDate] = useState(appointment.date);
  const [requestedStart, setRequestedStart] = useState("");
  const [reason, setReason] = useState("");
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading,
    error,
  } = useAppointmentAvailability(
    appointment.doctorId,
    requestedDate,
    appointment.type,
    appointment.type === "Clinic" && isProcedureServiceTitle(parseAppointmentContext(appointment.reason).service)
      ? PROCEDURE_SLOT_MINUTES
      : CONSULTATION_SLOT_MINUTES,
  );
  const selectedSlot = slotStatuses.find((slot) => slot.start === requestedStart) ?? null;
  const isSameSchedule = requestedDate === appointment.date && requestedStart === appointment.start;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-[0_28px_80px_rgba(0,0,0,0.28)] sm:p-6">
        <div className="flex flex-col gap-4 border-b border-neutral-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Reschedule Request
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              {formatDisplayDate(appointment.date)} - {formatRange(appointment.start, appointment.end)}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your appointment stays on the original schedule until the clinic or assigned doctor approves the request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label="Close reschedule request"
          >
            <FaXmark className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Preferred date
              </span>
              <input
                type="date"
                min={today}
                value={requestedDate}
                onChange={(event) => {
                  setRequestedDate(event.target.value);
                  setRequestedStart("");
                }}
                className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
              />
            </label>

            {nextAvailableSlot ? (
              <button
                type="button"
                onClick={() => {
                  setRequestedDate(nextAvailableSlot.date);
                  setRequestedStart(nextAvailableSlot.slot.start);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-white"
              >
                <FaCalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Use next available
              </button>
            ) : null}

            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Reason
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Optional note for the clinic"
                className="mt-1 w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
              />
            </label>

            {blockedReason || error ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
                {blockedReason ?? error}
              </div>
            ) : null}
          </div>

          <SharedSlotPicker
            slotStatuses={slotStatuses}
            selectedStart={requestedStart}
            onSelect={setRequestedStart}
            disabled={isSubmitting}
            loading={isLoading}
            title="Preferred time"
          />
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Keep Original
          </button>
          <button
            type="button"
            onClick={() => {
              onSubmit({
                appointmentId: appointment.id,
                requestedDate,
                requestedStart,
                reason,
              });
            }}
            disabled={isSubmitting || !selectedSlot || isSameSchedule}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaCalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {isSubmitting ? "Sending..." : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentDetailsModal({
  appointment,
  pendingRequest,
  onClose,
}: {
  appointment: AppointmentRecord;
  pendingRequest: RescheduleRequestView | null;
  onClose: () => void;
}) {
  const doctor = getDoctorById(appointment.doctorId);
  const service = getAppointmentPrimaryLabel(appointment.reason, appointment.type);
  const note = getAppointmentSecondaryReason(appointment.reason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Appointment Details
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {formatDisplayDate(appointment.date)}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {formatRange(appointment.start, appointment.end)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Close appointment details"
          >
            <FaXmark className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={appointment.type} />
            <StatusBadge status={appointment.status} />
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
              Queue #{appointment.queueNumber}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AppointmentDetailTile label="Doctor" value={doctor?.name ?? "Assigned doctor"} />
            <AppointmentDetailTile label="Visit type" value={formatAppointmentType(appointment.type)} />
            <AppointmentDetailTile label="Date" value={formatDisplayDate(appointment.date)} />
            <AppointmentDetailTile label="Time" value={formatRange(appointment.start, appointment.end)} />
            <AppointmentDetailTile label="Email" value={appointment.email || "Not provided"} />
            <AppointmentDetailTile label="Phone" value={appointment.phone || "Not provided"} />
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Service</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{service}</p>
            {note ? <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p> : null}
          </div>

          {appointment.meetingLink ? (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Virtual consult</p>
              <a
                href={appointment.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                Join Consultation
              </a>
            </div>
          ) : null}

          {pendingRequest ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                Pending reschedule request
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-950">
                {formatDisplayDate(pendingRequest.requestedDate)} - {formatRange(pendingRequest.requestedStart, pendingRequest.requestedEnd)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-neutral-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentDetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function applyFilter(appointments: AppointmentRecord[], filter: AppointmentFilter) {
  if (filter === "all") return appointments;
  const expectedType: AppointmentType = filter === "online" ? "Online" : "Clinic";
  return appointments.filter((appointment) => appointment.type === expectedType);
}

function filterLabel(filter: AppointmentFilter) {
  if (filter === "online") return "Virtual consults";
  if (filter === "clinic") return "Clinic visits";
  return "All appointments";
}

function formatAppointmentType(type: AppointmentType) {
  return type === "Online" ? "Virtual Consult" : type;
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
    emerald: "bg-emerald-100 text-emerald-700",
    teal: "bg-teal-100 text-teal-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
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
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        <FaVideo className="h-3 w-3" aria-hidden="true" />
        Virtual
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
      <FaHospital className="h-3 w-3" aria-hidden="true" />
      Clinic
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Pending"
      ? "bg-amber-50 text-amber-700"
      : status === "In Progress"
      ? "bg-sky-50 text-sky-700"
      : status === "Completed"
        ? "bg-emerald-50 text-emerald-700"
        : status === "Confirmed"
          ? "bg-emerald-50 text-emerald-700"
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
    sky: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
  } as const;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}
