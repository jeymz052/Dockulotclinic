"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaCalendarDay,
  FaCalendarCheck,
  FaCalendarDays,
  FaCalendarPlus,
  FaCalendarXmark,
  FaCircleCheck,
  FaCircleXmark,
  FaClock,
  FaEnvelope,
  FaFilter,
  FaFlagCheckered,
  FaHeartPulse,
  FaHospital,
  FaInbox,
  FaListUl,
  FaMagnifyingGlass,
  FaPenToSquare,
  FaPersonWalkingArrowRight,
  FaPhone,
  FaPlay,
  FaPlus,
  FaTriangleExclamation,
  FaUpRightFromSquare,
  FaUser,
  FaUserCheck,
  FaVideo,
  FaXmark,
} from "react-icons/fa6";
import {
  approveAppointmentAction,
  deleteAppointmentAction,
  updateAppointmentAction,
} from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { usePatients } from "@/src/components/clinic/useClinicData";
import { VitalSignsForm } from "@/src/components/clinic/VitalSignsForm";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  encodeAppointmentContext,
  getAppointmentPrimaryLabel,
  getAppointmentSecondaryReason,
  getDefaultServiceForType,
  getServiceOptionsForType,
  isProcedureServiceTitle,
  parseAppointmentContext,
  type ClinicConsultKind,
} from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getAppointmentSummary,
  getDoctorById,
  type AppointmentRecord,
  type AppointmentStatus,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import { CONSULTATION_SLOT_MINUTES, PROCEDURE_SLOT_MINUTES } from "@/src/lib/clinic-schedule";

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "doctora-kulot-md";

type Timeframe = "today" | "upcoming" | "past" | "all";
type StatusFilter = "all" | AppointmentStatus;
type TypeFilter = "all" | AppointmentType;
type AppointmentDraft = AppointmentRecord & { service: string; consultKind?: ClinicConsultKind };
type RescheduleRequestView = {
  id: string;
  appointmentId: string;
  patientName: string;
  appointmentType: AppointmentType;
  currentDate: string;
  currentStart: string;
  currentEnd: string;
  requestedDate: string;
  requestedStart: string;
  requestedEnd: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
};

function clinicConsultKindLabel(kind: ClinicConsultKind) {
  return kind === "FollowUp" ? "Follow-up clinic consult" : "First clinic consult";
}

export default function AppointmentListPage() {
  const { accessToken, role } = useRole();
  const searchParams = useSearchParams();
  const { doctors } = useDoctors();
  const { appointments, setAppointments, isLoading, error } = useAppointments();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequestView[]>([]);

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  // Two-step cancel: clicking Cancel arms confirmation, second click commits.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const highlightedAppointmentId = searchParams.get("appointment");
  const highlightedRef = useRef<HTMLElement | null>(null);
  // Vitals modal: holds the appointment id whose vitals are being edited.
  // null = closed. Used by the secretary at check-in (and the doctor too,
  // though the doctor more often edits via the consultation page).
  const [vitalsApptId, setVitalsApptId] = useState<string | null>(null);

  const summary = getAppointmentSummary(appointments);
  const primaryDoctor = doctors[0] ?? null;
  const canManage = role !== "PATIENT";
  const todaysCount = useMemo(
    () => appointments.filter((appt) => appt.date === today).length,
    [appointments],
  );
  const upcomingCount = useMemo(
    () => appointments.filter((appt) => appt.date > today).length,
    [appointments],
  );

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((left, right) =>
        `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`),
      ),
    [appointments],
  );

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortedAppointments.filter((appointment) => {
      // Timeframe
      if (timeframe === "today" && appointment.date !== today) return false;
      if (timeframe === "upcoming" && appointment.date <= today) return false;
      if (timeframe === "past" && appointment.date >= today) return false;

      // Status
      if (statusFilter !== "all" && appointment.status !== statusFilter) return false;

      // Type
      if (typeFilter !== "all" && appointment.type !== typeFilter) return false;

      // Search across patient name, email, phone, doctor name
      if (query) {
        const doctor = doctors.find((item) => item.id === appointment.doctorId)
          ?? (appointment.doctorId ? getDoctorById(appointment.doctorId) : null);
        const haystack = [
          appointment.patientName,
          appointment.email,
          appointment.phone,
          appointment.reason,
          doctor?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [sortedAppointments, searchQuery, timeframe, statusFilter, typeFilter, doctors]);

  // Group filtered list by date so the page reads as a timeline.
  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRecord[]>();
    for (const appt of filteredAppointments) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    const sortDir = timeframe === "past" ? -1 : 1;
    return [...map.entries()].sort(([a], [b]) => sortDir * a.localeCompare(b));
  }, [filteredAppointments, timeframe]);

  useEffect(() => {
    if (!highlightedAppointmentId || !highlightedRef.current) return;
    highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [grouped.length, highlightedAppointmentId, timeframe]);

  useEffect(() => {
    if (!accessToken || !canManage) return;
    let active = true;

    async function loadRescheduleRequests() {
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
        if (active) setRescheduleRequests(body.requests ?? []);
      } catch {
        if (active) setRescheduleRequests([]);
      }
    }

    void loadRescheduleRequests();
    return () => {
      active = false;
    };
  }, [accessToken, canManage]);

  const activeDraftDoctorId = primaryDoctor?.slug ?? draft?.doctorId ?? DEFAULT_DOCTOR_ID;
  const activeDraftDate = draft?.date ?? today;
  const activeDraftType = draft?.type ?? "Clinic";
  const activeDraftSlotMinutes =
    activeDraftType === "Clinic" && isProcedureServiceTitle(draft?.service)
      ? PROCEDURE_SLOT_MINUTES
      : CONSULTATION_SLOT_MINUTES;
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: isLoadingAvailability,
  } = useAppointmentAvailability(activeDraftDoctorId, activeDraftDate, activeDraftType, activeDraftSlotMinutes);

  function beginEdit(appointment: AppointmentRecord) {
    const parsed = parseAppointmentContext(appointment.reason);
    setEditingId(appointment.id);
    setDraft({
      ...appointment,
      service: parsed.service || getDefaultServiceForType(appointment.type),
      reason: parsed.reason,
      consultKind: parsed.consultKind ?? (appointment.type === "Clinic" ? "FirstConsult" : undefined),
      doctorId: primaryDoctor?.slug ?? appointment.doctorId ?? DEFAULT_DOCTOR_ID,
    });
    setFeedback(null);
    setConfirmingDeleteId(null);
  }

  function updateDraft<K extends keyof AppointmentDraft>(field: K, value: AppointmentDraft[K]) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      if (field === "doctorId" || field === "date" || field === "type") {
        next.start = "";
        next.end = "";
      }
      if (field === "type") {
        next.service = getDefaultServiceForType(value as AppointmentType);
        next.consultKind = value === "Clinic" ? "FirstConsult" : undefined;
      }
      return next;
    });
  }

  function saveDraft() {
    if (!accessToken || !draft) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      const result = await updateAppointmentAction(accessToken, {
        id: draft.id,
        patientName: draft.patientName,
        email: draft.email,
        phone: draft.phone,
        doctorId: draft.doctorId,
        date: draft.date,
        start: draft.start,
        type: draft.type,
        reason: encodeAppointmentContext(draft.service, draft.reason, draft.type === "Clinic" ? draft.consultKind : undefined),
        // Only send the override for virtual consult appointments; the server ignores it
        // for Clinic visits, but skipping it here keeps the wire payload tidy.
        meetingLink: draft.type === "Online" ? draft.meetingLink ?? "" : undefined,
      });
      setAppointments(result.appointments);
      setFeedback(result.message);
      if (result.ok) {
        setEditingId(null);
        setDraft(null);
      }
    });
  }

  function deleteAppointment(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      const result = await deleteAppointmentAction(accessToken, appointmentId);
      setAppointments(result.appointments);
      setFeedback(result.message);
      setConfirmingDeleteId(null);
    });
  }

  function reviewRescheduleRequest(requestId: string, action: "approve" | "reject") {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      try {
        const response = await fetch(`/api/v2/appointment-reschedule-requests/${requestId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          appointments?: AppointmentRecord[];
          message?: string;
        };
        if (!response.ok) throw new Error(body.message ?? "Could not review reschedule request.");
        if (body.appointments) setAppointments(body.appointments);
        setRescheduleRequests((current) => current.filter((request) => request.id !== requestId));
        setFeedback(action === "approve" ? "Reschedule request approved." : "Reschedule request rejected.");
      } catch (reviewError) {
        setFeedback(
          reviewError instanceof Error ? reviewError.message : "Could not review reschedule request.",
        );
      }
    });
  }

  function markArrived(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      const response = await fetch(`/api/v2/appointments/${appointmentId}/check-in`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFeedback(payload.message ?? "Could not mark patient as arrived.");
        return;
      }
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointmentId ? { ...item, status: "Checked In" } : item,
        ),
      );
      setFeedback("Patient marked as arrived. Doctor can now start the consultation.");
    });
  }

  function approveAppointment(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }

    startUpdateTransition(async () => {
      const result = await approveAppointmentAction(accessToken, appointmentId);
      setAppointments(result.appointments);
      setFeedback(result.message);
    });
  }

  /**
   * Doctor (or staff) flips the appointment to InProgress. This is the gate
   * that unlocks POS billing — the cashier can't generate a bill until the
   * consultation has been started.
   */
  function startConsultation(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }
    startUpdateTransition(async () => {
      const response = await fetch(`/api/v2/appointments/${appointmentId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFeedback(payload.message ?? "Could not start the consultation.");
        return;
      }
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointmentId ? { ...item, status: "In Progress" } : item,
        ),
      );
      setFeedback("Clinic consultation started. The bill is now ready in POS.");
    });
  }

  /**
   * Mark a consultation as complete. Optional — recording a POS payment
   * also auto-completes the appointment, so the doctor can leave this for
   * the cashier on most visits.
   */
  function completeConsultation(appointmentId: string) {
    if (!accessToken) {
      setFeedback("Sign in again to continue.");
      return;
    }
    startUpdateTransition(async () => {
      const response = await fetch(`/api/v2/appointments/${appointmentId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFeedback(payload.message ?? "Could not complete the consultation.");
        return;
      }
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointmentId ? { ...item, status: "Completed" } : item,
        ),
      );
      setFeedback("Consultation marked as completed.");
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setTimeframe("all");
  }

  const hasActiveFilters =
    searchQuery.trim() !== ""
    || statusFilter !== "all"
    || typeFilter !== "all"
    || timeframe !== "today";

  return (
    <div className="space-y-6 pb-10">
      {/* Hero header */}
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_right,rgba(17,17,17,0.18),transparent_38%),linear-gradient(135deg,#fafafa_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">
              Manage Appointments
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {canManage ? "All bookings, one timeline" : "Your bookings"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Search, filter, and update appointments grouped by date. Tap a card to edit details
              or move it to a new slot.
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(17,17,17,0.30)]"
              >
                <FaPlus className="h-3 w-3" aria-hidden="true" />
                New Appointment
              </Link>
              <Link
                href="/appointments/calendar"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <FaCalendarDays className="h-3 w-3" aria-hidden="true" />
                Calendar View
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Stat dashboard */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={todaysCount}
          tone="emerald"
          icon={<FaCalendarDay className="h-4 w-4" />}
          hint={todaysCount === 0 ? "No bookings today" : "scheduled today"}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          tone="sky"
          icon={<FaCalendarPlus className="h-4 w-4" />}
          hint={upcomingCount === 0 ? "Nothing on deck" : "after today"}
        />
        <StatCard
          label="Confirmed"
          value={summary.confirmedCount}
          tone="teal"
          icon={<FaCircleCheck className="h-4 w-4" />}
          hint="confirmed + done"
        />
        <StatCard
          label="Pending"
          value={summary.pendingCount}
          tone="amber"
          icon={<FaClock className="h-4 w-4" />}
          hint={summary.pendingCount === 0 ? "No requests awaiting approval" : "awaiting approval"}
        />
      </div>

      {/* Feedback / error banners */}
      {feedback ? (
        <Banner tone="success" icon={<FaCircleCheck className="h-4 w-4" />}>
          {feedback}
        </Banner>
      ) : null}
      {error ? (
        <Banner tone="error" icon={<FaCircleXmark className="h-4 w-4" />}>
          {error}
        </Banner>
      ) : null}

      {canManage && rescheduleRequests.length > 0 ? (
        <RescheduleReviewPanel
          requests={rescheduleRequests}
          isUpdating={isUpdating}
          onApprove={(requestId) => reviewRescheduleRequest(requestId, "approve")}
          onReject={(requestId) => reviewRescheduleRequest(requestId, "reject")}
        />
      ) : null}

      {/* Filter / search bar */}
      <div className="rounded-[1.75rem] border border-neutral-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <FaMagnifyingGlass
              className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by patient name, email, phone, doctor, or reason…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <FaXmark className="h-3 w-3" aria-hidden="true" />
                  </button>
            ) : null}
            </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-slate-100 p-1">
              {(
                [
                  { key: "today", label: "Today", icon: FaCalendarDay },
                  { key: "upcoming", label: "Upcoming", icon: FaCalendarPlus },
                  { key: "past", label: "Past", icon: FaCalendarXmark },
                  { key: "all", label: "All", icon: FaListUl },
                ] as const
              ).map((tab) => {
                const isActive = timeframe === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTimeframe(tab.key)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <FaFilter className="h-2.5 w-2.5" aria-hidden="true" />
              <span>{filteredAppointments.length} of {appointments.length}</span>
            </div>
          </div>

          {/* Status + Type chips */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  tone="slate"
                >
                  All
                </FilterChip>
                <FilterChip
                  active={statusFilter === "Pending"}
                  onClick={() => setStatusFilter("Pending")}
                  tone="amber"
                  icon={<FaClock className="h-2.5 w-2.5" />}
                >
                  Pending
                </FilterChip>
                <FilterChip
                  active={statusFilter === "Confirmed"}
                  onClick={() => setStatusFilter("Confirmed")}
                  tone="emerald"
                  icon={<FaCircleCheck className="h-2.5 w-2.5" />}
                >
                  Confirmed
                </FilterChip>
                <FilterChip
                  active={statusFilter === "Checked In"}
                  onClick={() => setStatusFilter("Checked In")}
                  tone="teal"
                  icon={<FaUserCheck className="h-2.5 w-2.5" />}
                >
                  Checked In
                </FilterChip>
                <FilterChip
                  active={statusFilter === "In Progress"}
                  onClick={() => setStatusFilter("In Progress")}
                  tone="amber"
                  icon={<FaClock className="h-2.5 w-2.5" />}
                >
                  In Progress
                </FilterChip>
                <FilterChip
                  active={statusFilter === "Completed"}
                  onClick={() => setStatusFilter("Completed")}
                  tone="teal"
                  icon={<FaCircleCheck className="h-2.5 w-2.5" />}
                >
                  Completed
                </FilterChip>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Visit Type
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  active={typeFilter === "all"}
                  onClick={() => setTypeFilter("all")}
                  tone="slate"
                >
                  All
                </FilterChip>
                <FilterChip
                  active={typeFilter === "Clinic"}
                  onClick={() => setTypeFilter("Clinic")}
                  tone="emerald"
                  icon={<FaHospital className="h-2.5 w-2.5" />}
                >
                  Clinic
                </FilterChip>
                <FilterChip
                  active={typeFilter === "Online"}
                  onClick={() => setTypeFilter("Online")}
                  tone="sky"
                  icon={<FaVideo className="h-2.5 w-2.5" />}
                >
                  Virtual
                </FilterChip>
              </div>
            </div>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <FaXmark className="h-2.5 w-2.5" aria-hidden="true" />
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      {/* Appointment list */}
      {isLoading && appointments.length === 0 ? (
        <LoadingSkeleton />
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          hasAnyAppointments={appointments.length > 0}
          onClearFilters={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="space-y-7">
          {grouped.map(([date, items]) => (
            <section key={date} className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
                    {dateBucketLabel(date)}
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    {formatDisplayDate(date)}
                  </h2>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                  {items.length} {items.length === 1 ? "booking" : "bookings"}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((appointment) => {
                  const doctor = doctors.find((item) => item.id === appointment.doctorId)
                    ?? (appointment.doctorId ? getDoctorById(appointment.doctorId) : null);
                  const isEditing = editingId === appointment.id && draft !== null;
                  const isConfirmingDelete = confirmingDeleteId === appointment.id;
                  const isHighlighted = appointment.id === highlightedAppointmentId;

                  return (
                    <article
                      key={appointment.id}
                      ref={isHighlighted ? highlightedRef : null}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
                        isHighlighted
                          ? "border-neutral-400 shadow-[0_18px_36px_rgba(17,17,17,0.16)] ring-2 ring-neutral-300"
                          : isEditing
                          ? "border-neutral-400 shadow-[0_18px_36px_rgba(17,17,17,0.16)] ring-2 ring-neutral-200"
                          : "border-slate-200 hover:border-neutral-200 hover:shadow-md"
                      }`}
                    >
                      {/* Card head */}
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:p-5">
                        {/* Time anchor on the left */}
                        <TimeAnchor
                          start={appointment.start}
                          end={appointment.end}
                          type={appointment.type}
                        />

                        {/* Patient + meta */}
                        <div className="flex flex-1 min-w-0 gap-3">
                          <Avatar name={appointment.patientName} type={appointment.type} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-base font-bold text-slate-900">
                                {appointment.patientName}
                              </h3>
                              <TypeBadge type={appointment.type} />
                              <StatusBadge status={appointment.status} />
                              <QueueBadge queueNumber={appointment.queueNumber} />
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <FaUser className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
                                {doctor?.name ?? "Assigned doctor"}
                              </span>
                              {appointment.email ? (
                                <span className="inline-flex items-center gap-1">
                                  <FaEnvelope className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
                                  <span className="truncate max-w-[18ch] sm:max-w-none">{appointment.email}</span>
                                </span>
                              ) : null}
                              {appointment.phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <FaPhone className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
                                  {appointment.phone}
                                </span>
                              ) : null}
                            </div>

                            {appointment.reason ? (
                              <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-600">Service:</span> {getAppointmentPrimaryLabel(appointment.reason, appointment.type)}
                                {getAppointmentSecondaryReason(appointment.reason)
                                  ? ` • ${getAppointmentSecondaryReason(appointment.reason)}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">
                          {appointment.meetingLink ? (
                            <a
                              href={appointment.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
                            >
                              <FaVideo className="h-3 w-3" aria-hidden="true" />
                              Join Meeting
                              <FaUpRightFromSquare className="h-2.5 w-2.5" aria-hidden="true" />
                            </a>
                          ) : null}
                          {canManage && !isEditing && !isConfirmingDelete ? (
                            <>
                              {appointment.type === "Clinic"
                                && appointment.status === "Pending" ? (
                                <button
                                  type="button"
                                  onClick={() => approveAppointment(appointment.id)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(5,150,105,0.24)] transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                                  Approve
                                </button>
                              ) : null}
                              {appointment.type === "Clinic"
                                && appointment.status === "Confirmed"
                                && appointment.date === today ? (
                                <button
                                  type="button"
                                  onClick={() => markArrived(appointment.id)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#111111,#111111)] px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(17,17,17,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FaPersonWalkingArrowRight className="h-3 w-3" aria-hidden="true" />
                                  Mark Arrived
                                </button>
                              ) : null}
                              {/* Vitals: available for any Clinic appointment from
                                  Confirmed onward (so the secretary can capture
                                  at check-in, and the doctor can re-take
                                  during the visit). Virtual consults skip
                                  this — vitals require a physical encounter. */}
                              {appointment.type === "Clinic"
                                && (appointment.status === "Confirmed"
                                  || appointment.status === "Checked In"
                                  || appointment.status === "In Progress") ? (
                                <button
                                  type="button"
                                  onClick={() => setVitalsApptId(appointment.id)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                                >
                                  <FaHeartPulse className="h-3 w-3" aria-hidden="true" />
                                  Vitals & History
                                </button>
                              ) : null}
                              {/* Start Consultation: clinic visits need CheckedIn first. */}
                              {appointment.type === "Clinic" && appointment.status === "Checked In" ? (
                                <button
                                  type="button"
                                  onClick={() => startConsultation(appointment.id)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#111111,#111111)] px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(17,17,17,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FaPlay className="h-3 w-3" aria-hidden="true" />
                                  Start Consultation
                                </button>
                              ) : null}
                              {appointment.status === "Confirmed"
                                || appointment.status === "Checked In"
                                || appointment.status === "In Progress" ? (
                                  <Link
                                    href="/consultations"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                                  >
                                    <FaPenToSquare className="h-3 w-3" aria-hidden="true" />
                                    Visit workspace
                                  </Link>
                                ) : null}
                              {appointment.status === "In Progress" ? (
                                <button
                                  type="button"
                                  onClick={() => completeConsultation(appointment.id)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#111111,#111111)] px-3 py-2 text-xs font-bold text-white shadow-[0_8px_18px_rgba(17,17,17,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FaFlagCheckered className="h-3 w-3" aria-hidden="true" />
                                  Complete
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => beginEdit(appointment)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
                              >
                                <FaPenToSquare className="h-3 w-3" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteId(appointment.id)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                              >
                                <FaXmark className="h-3 w-3" aria-hidden="true" />
                                Cancel
                              </button>
                            </>
                          ) : null}
                          {canManage && isConfirmingDelete ? (
                            <ConfirmCancelInline
                              isUpdating={isUpdating}
                              onAbort={() => setConfirmingDeleteId(null)}
                              onConfirm={() => deleteAppointment(appointment.id)}
                            />
                          ) : null}
                        </div>
                      </div>

                      {/* Missing meeting-link banner — only for virtual consults without a link */}
                      {appointment.type === "Online" && !appointment.meetingLink && !isEditing ? (
                        <MissingMeetingLinkBanner canManage={canManage} />
                      ) : null}

                      {/* Inline edit form */}
                      {isEditing ? (
                        <div className="space-y-5 border-t border-neutral-100 bg-linear-to-b from-neutral-50/30 to-white px-4 py-5 sm:px-6">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-700">
                                <FaUser className="h-3 w-3" aria-hidden="true" />
                                Patient Details
                              </p>
                              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                <FormField label="Name">
                                  <input
                                    value={draft.patientName}
                                    onChange={(event) => updateDraft("patientName", event.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="Patient name"
                                  />
                                </FormField>
                                <FormField label="Email">
                                  <input
                                    value={draft.email}
                                    onChange={(event) => updateDraft("email", event.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="email@example.com"
                                    type="email"
                                  />
                                </FormField>
                                <FormField label="Phone">
                                  <input
                                    value={draft.phone}
                                    onChange={(event) => updateDraft("phone", event.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="+63 9XX XXX XXXX"
                                  />
                                </FormField>
                                <FormField label="Reason">
                                  <input
                                    value={draft.reason}
                                    onChange={(event) => updateDraft("reason", event.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="Consultation reason"
                                  />
                                </FormField>
                                {draft.type === "Clinic" ? (
                                  <FormField label="Clinic Consult Type">
                                    <select
                                      value={draft.consultKind ?? "FirstConsult"}
                                      onChange={(event) => updateDraft("consultKind", event.target.value as ClinicConsultKind)}
                                      className={`${INPUT_CLASS} bg-white`}
                                    >
                                      {(["FirstConsult", "FollowUp"] as ClinicConsultKind[]).map((kind) => (
                                        <option key={kind} value={kind}>
                                          {clinicConsultKindLabel(kind)}
                                        </option>
                                      ))}
                                    </select>
                                  </FormField>
                                ) : null}
                                <FormField label="Service">
                                  <select
                                    value={draft.service}
                                    onChange={(event) => updateDraft("service", event.target.value)}
                                    className={`${INPUT_CLASS} bg-white`}
                                  >
                                    {getServiceOptionsForType(draft.type).map((service) => (
                                      <option key={service} value={service}>
                                        {service}
                                      </option>
                                    ))}
                                  </select>
                                </FormField>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-700">
                                <FaCalendarDays className="h-3 w-3" aria-hidden="true" />
                                Schedule Details
                              </p>
                              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                <FormField label="Doctor">
                                  <div className={`${INPUT_CLASS} bg-neutral-50/60 font-semibold`}>
                                    {primaryDoctor?.name ?? getDoctorById(DEFAULT_DOCTOR_ID)?.name ?? "Assigned doctor"}
                                  </div>
                                </FormField>
                                <FormField label="Visit Type">
                                  <select
                                    value={draft.type}
                                    onChange={(event) => updateDraft("type", event.target.value as AppointmentType)}
                                    className={`${INPUT_CLASS} bg-white`}
                                  >
                                    <option value="Clinic">Clinic</option>
                                    <option value="Online">Virtual Consult</option>
                                  </select>
                                </FormField>
                                <FormField label="Date">
                                  <input
                                    type="date"
                                    min={today}
                                    value={draft.date}
                                    onChange={(event) => updateDraft("date", event.target.value)}
                                    className={`${INPUT_CLASS} bg-white`}
                                  />
                                </FormField>
                                <FormField label="Quick pick">
                                  {nextAvailableSlot ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateDraft("date", nextAvailableSlot.date);
                                        updateDraft("start", nextAvailableSlot.slot.start);
                                        updateDraft("end", nextAvailableSlot.slot.end);
                                      }}
                                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-400 bg-neutral-50/60 px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
                                    >
                                      <FaCalendarCheck className="h-3 w-3" aria-hidden="true" />
                                      Use next available
                                    </button>
                                  ) : (
                                    <div className={`${INPUT_CLASS} text-slate-500`}>
                                      Pick a date to load times
                                    </div>
                                  )}
                                </FormField>
                              </div>
                              {blockedReason ? (
                                <div className="mt-3 inline-flex items-start gap-2 rounded-lg border-l-4 border-neutral-300 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700">
                                  <FaTriangleExclamation className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                  <span>{blockedReason}</span>
                                </div>
                              ) : null}

                              {draft.type === "Online" ? (
                                <div className="mt-4">
                                  <FormField label="Meeting link override (optional)">
                                    <input
                                      type="url"
                                      value={draft.meetingLink ?? ""}
                                      onChange={(event) => updateDraft("meetingLink", event.target.value)}
                                      placeholder="Leave blank to use the clinic default"
                                      className={INPUT_CLASS}
                                    />
                                  </FormField>
                                  <p className="mt-1.5 text-[11px] text-slate-500">
                                    Saves a unique meeting URL for this appointment only. Clear the field to fall back to the clinic-wide default in Settings.
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <SharedSlotPicker
                            slotStatuses={slotStatuses}
                            selectedStart={draft.start}
                            onSelect={(start) => {
                              const selected = slotStatuses.find((slot) => slot.start === start);
                              updateDraft("start", start);
                              updateDraft("end", selected?.end ?? "");
                            }}
                            disabled={isUpdating}
                            loading={isLoadingAvailability}
                          />

                          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setDraft(null); }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              <FaXmark className="h-3 w-3" aria-hidden="true" />
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={saveDraft}
                              disabled={isUpdating || !draft.start}
                              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-5 py-2 text-sm font-bold text-white shadow-[0_14px_24px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                              {isUpdating ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Vitals modal — opens when a row's "Vitals" button is clicked.
          Backdrop click + Esc close. The form handles its own fetch / save
          against /api/v2/appointments/:id/vitals. */}
      {vitalsApptId ? (
        <VitalsModal
          appointmentId={vitalsApptId}
          patientName={appointments.find((a) => a.id === vitalsApptId)?.patientName ?? ""}
          patientEmail={appointments.find((a) => a.id === vitalsApptId)?.email ?? ""}
          patientPhone={appointments.find((a) => a.id === vitalsApptId)?.phone ?? ""}
          onClose={() => setVitalsApptId(null)}
        />
      ) : null}
    </div>
  );
}

function VitalsModal({
  appointmentId,
  patientName,
  patientEmail,
  patientPhone,
  onClose,
}: {
  appointmentId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  onClose: () => void;
}) {
  // Esc closes the modal — small but expected affordance for keyboard users
  // (front-desk staff are usually keyboard-heavy).
  const { accessToken } = useRole();
  const { data: patients, setData: setPatients } = usePatients();
  useEffectEsc(onClose);
  const patientRecord =
    patients.find((patient) => patient.email === patientEmail)
    ?? patients.find(
      (patient) =>
        patient.fullName === patientName
        && (patient.phone === patientPhone || !patient.phone || !patientPhone),
    )
    ?? null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">Clinic Intake</p>
            <h3 className="text-base font-bold text-slate-900">{patientName || "Vitals & History"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 p-4">
          <VitalSignsForm appointmentId={appointmentId} onSaved={() => undefined} />
          <PatientRecordEditor
            key={patientRecord?.id ?? `${patientEmail}-${patientName}-${appointmentId}`}
            accessToken={accessToken}
            patientRecord={patientRecord}
            setPatients={setPatients}
          />
        </div>
      </div>
    </div>
  );
}

function PatientRecordEditor({
  accessToken,
  patientRecord,
  setPatients,
}: {
  accessToken: string | null;
  patientRecord: ReturnType<typeof usePatients>["data"][number] | null;
  setPatients: ReturnType<typeof usePatients>["setData"];
}) {
  const [patientRecordDraft, setPatientRecordDraft] = useState({
    familyHistory: patientRecord?.familyHistory ?? "",
    medicalHistory: patientRecord?.medicalHistory ?? "",
    allergies: patientRecord?.allergies ?? "",
    emergencyContactName: patientRecord?.emergencyContactName ?? "",
    emergencyContactPhone: patientRecord?.emergencyContactPhone ?? "",
  });
  const [recordFeedback, setRecordFeedback] = useState<string | null>(null);
  const [isSavingPatientRecord, startSavingPatientRecord] = useTransition();

  function savePatientRecord() {
    if (!accessToken) {
      setRecordFeedback("Your session expired. Please sign in again.");
      return;
    }
    if (!patientRecord) {
      setRecordFeedback("No matching patient record was found for this appointment.");
      return;
    }

    startSavingPatientRecord(async () => {
      const response = await fetch("/api/patient-records", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId: patientRecord.id,
          familyHistory: patientRecordDraft.familyHistory,
          medicalHistory: patientRecordDraft.medicalHistory,
          allergies: patientRecordDraft.allergies,
          emergencyContactName: patientRecordDraft.emergencyContactName,
          emergencyContactPhone: patientRecordDraft.emergencyContactPhone,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | { ok: true } | null;
      if (!response.ok) {
        const message =
          payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Unable to save patient record.";
        setRecordFeedback(message);
        return;
      }
      setPatients((current) =>
        current.map((patient) =>
          patient.id === patientRecord.id
            ? {
                ...patient,
                familyHistory: patientRecordDraft.familyHistory.trim(),
                medicalHistory: patientRecordDraft.medicalHistory.trim(),
                allergies: patientRecordDraft.allergies.trim(),
                emergencyContactName: patientRecordDraft.emergencyContactName.trim(),
                emergencyContactPhone: patientRecordDraft.emergencyContactPhone.trim(),
              }
            : patient,
        ),
      );
      setRecordFeedback("Patient record saved.");
    });
  }

  const patientRecordDirty =
    patientRecordDraft.familyHistory !== (patientRecord?.familyHistory ?? "")
    || patientRecordDraft.medicalHistory !== (patientRecord?.medicalHistory ?? "")
    || patientRecordDraft.allergies !== (patientRecord?.allergies ?? "")
    || patientRecordDraft.emergencyContactName !== (patientRecord?.emergencyContactName ?? "")
    || patientRecordDraft.emergencyContactPhone !== (patientRecord?.emergencyContactPhone ?? "");

  return (
    <section className="rounded-xl border border-neutral-100 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Patient Record</h4>
          <p className="text-xs text-slate-500">Shared medical background used across clinic visits.</p>
        </div>
        <button
          type="button"
          onClick={savePatientRecord}
          disabled={isSavingPatientRecord || !patientRecord || !patientRecordDirty}
          className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingPatientRecord ? "Saving..." : "Save Patient Record"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Emergency Contact Name
          <input
            value={patientRecordDraft.emergencyContactName}
            onChange={(event) => {
              setPatientRecordDraft((current) => ({ ...current, emergencyContactName: event.target.value }));
              setRecordFeedback(null);
            }}
            className="mt-2 w-full rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            placeholder="Parent, spouse, sibling, or guardian"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Emergency Contact Phone
          <input
            value={patientRecordDraft.emergencyContactPhone}
            onChange={(event) => {
              setPatientRecordDraft((current) => ({ ...current, emergencyContactPhone: event.target.value }));
              setRecordFeedback(null);
            }}
            className="mt-2 w-full rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            placeholder="+63 9XX XXX XXXX"
          />
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Medical History
        <textarea
          value={patientRecordDraft.medicalHistory}
          onChange={(event) => {
            setPatientRecordDraft((current) => ({ ...current, medicalHistory: event.target.value }));
            setRecordFeedback(null);
          }}
          rows={4}
          placeholder="Past illnesses, surgeries, maintenance medicines, pregnancy history, or other relevant background"
          className="mt-2 w-full rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Allergies
        <textarea
          value={patientRecordDraft.allergies}
          onChange={(event) => {
            setPatientRecordDraft((current) => ({ ...current, allergies: event.target.value }));
            setRecordFeedback(null);
          }}
          rows={3}
          placeholder="Drug allergies, food allergies, latex, or no known allergies"
          className="mt-2 w-full rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Family History
        <textarea
          value={patientRecordDraft.familyHistory}
          onChange={(event) => {
            setPatientRecordDraft((current) => ({ ...current, familyHistory: event.target.value }));
            setRecordFeedback(null);
          }}
          rows={4}
          placeholder="Hypertension, diabetes, stroke, asthma, cancer, or other conditions reported in the family"
          className="mt-2 w-full rounded-xl border border-neutral-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
        />
      </label>
      {recordFeedback ? <p className="mt-2 text-xs font-semibold text-neutral-700">{recordFeedback}</p> : null}
      {!patientRecord ? (
        <p className="mt-2 text-xs text-neutral-700">
          This appointment did not match a patient record, so shared patient information cannot be saved here yet.
        </p>
      ) : null}
    </section>
  );
}

// Tiny helper hook — wires Esc-to-close so the modal feels native. Kept
// inline (not extracted) because no other component needs it yet.
function useEffectEsc(handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200";

// ─── Sub-components ───────────────────────────────────────────────────────────

function RescheduleReviewPanel({
  requests,
  isUpdating,
  onApprove,
  onReject,
}: {
  requests: RescheduleRequestView[];
  isUpdating: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Doctor / Staff Approval
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-900">
            Reschedule requests
          </h2>
        </div>
        <span className="self-start rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700 sm:self-auto">
          {requests.length} pending
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                    {request.appointmentType}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                    Pending review
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  {request.patientName}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Current: {formatDisplayDate(request.currentDate)} - {formatRange(request.currentStart, request.currentEnd)}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Requested: {formatDisplayDate(request.requestedDate)} - {formatRange(request.requestedStart, request.requestedEnd)}
                </p>
                {request.reason ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {request.reason}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onReject(request.id)}
                  disabled={isUpdating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaXmark className="h-3 w-3" aria-hidden="true" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(request.id)}
                  disabled={isUpdating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                  Approve
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "teal" | "amber";
  icon: ReactNode;
  hint?: string;
}) {
  const toneMap = {
    emerald: {
      iconBg: "bg-emerald-100 text-emerald-700",
      number: "text-emerald-700",
    },
    sky: {
      iconBg: "bg-sky-100 text-sky-700",
      number: "text-sky-700",
    },
    teal: {
      iconBg: "bg-teal-100 text-teal-700",
      number: "text-teal-700",
    },
    amber: {
      iconBg: "bg-amber-100 text-amber-700",
      number: "text-amber-700",
    },
  } as const;
  const t = toneMap[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${t.iconBg}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${t.number}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
  tone,
  icon,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  tone: "slate" | "emerald" | "sky" | "amber" | "teal";
  icon?: ReactNode;
}) {
  const activeMap = {
    slate: "bg-slate-900 text-white border-slate-900",
    emerald: "bg-emerald-600 text-white border-emerald-600",
    sky: "bg-sky-600 text-white border-sky-600",
    amber: "bg-amber-500 text-white border-amber-500",
    teal: "bg-teal-600 text-white border-teal-600",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? activeMap[tone]
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function TimeAnchor({
  start,
  end,
  type,
}: {
  start: string;
  end: string;
  type: AppointmentType;
}) {
  const accent =
    type === "Online"
      ? "from-sky-500 to-blue-600 text-white"
      : "from-teal-500 to-emerald-600 text-white";
  return (
    <div className={`shrink-0 rounded-xl bg-linear-to-br ${accent} px-3 py-2 sm:w-32 sm:px-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
        {type === "Online" ? "Virtual" : "Clinic"}
      </p>
      <p className="mt-1 text-base font-black leading-tight sm:text-lg">{start}</p>
      <p className="text-[11px] font-medium opacity-90">to {end}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-75">
        {formatRange(start, end).split(" · ")[1] ?? ""}
      </p>
    </div>
  );
}

function Avatar({ name, type }: { name: string; type: AppointmentType }) {
  const ring = type === "Online" ? "ring-sky-200" : "ring-teal-200";
  const bg = type === "Online" ? "bg-sky-100 text-sky-700" : "bg-teal-100 text-teal-700";
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${ring} ${bg}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function TypeBadge({ type }: { type: AppointmentType }) {
  if (type === "Online") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
        <FaVideo className="h-2.5 w-2.5" aria-hidden="true" />
        Virtual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
      <FaHospital className="h-2.5 w-2.5" aria-hidden="true" />
      Clinic
    </span>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  if (status === "Pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
        <FaClock className="h-2.5 w-2.5" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (status === "Checked In") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
        <FaUserCheck className="h-2.5 w-2.5" aria-hidden="true" />
        Checked In
      </span>
    );
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
        <FaClock className="h-2.5 w-2.5" aria-hidden="true" />
        In Progress
      </span>
    );
  }
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <FaCircleCheck className="h-2.5 w-2.5" aria-hidden="true" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
      <FaCircleCheck className="h-2.5 w-2.5" aria-hidden="true" />
      Confirmed
    </span>
  );
}

function QueueBadge({ queueNumber }: { queueNumber: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
      Queue #{queueNumber}
    </span>
  );
}

function ConfirmCancelInline({
  isUpdating,
  onAbort,
  onConfirm,
}: {
  isUpdating: boolean;
  onAbort: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="inline-flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-800">
        <FaTriangleExclamation className="h-2.5 w-2.5" aria-hidden="true" />
        Cancel this appointment?
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onAbort}
          className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isUpdating}
        className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUpdating ? "Cancelling…" : "Confirm cancel"}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function MissingMeetingLinkBanner({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-neutral-200 bg-neutral-50 px-4 py-2.5 sm:px-5">
      <FaTriangleExclamation
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500"
        aria-hidden="true"
      />
      <div className="text-xs text-neutral-800">
        <p className="font-semibold">No meeting link yet for this virtual consult.</p>
        {canManage ? (
          <p className="mt-0.5">
            Set a clinic-wide default in{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-neutral-900">
              Settings / Virtual Consult
            </Link>
            , or click <span className="font-semibold">Edit</span> on this card to set a unique link for this patient.
          </p>
        ) : (
          <p className="mt-0.5">The clinic will share the meeting link with you shortly.</p>
        )}
      </div>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "success" | "error" | "info";
  icon: ReactNode;
  children: ReactNode;
}) {
  const map = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  } as const;
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${map[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function EmptyState({
  hasAnyAppointments,
  onClearFilters,
}: {
  hasAnyAppointments: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-neutral-200 bg-white p-10 text-center shadow-sm">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-50 text-neutral-500">
        <FaInbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {hasAnyAppointments ? "No appointments match your filters" : "No appointments yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {hasAnyAppointments
          ? "Try adjusting the search, status, or visit type — or reset the filters to see everything."
          : "Once a patient or staff member books an appointment it will show up here."}
      </p>
      <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2">
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <FaXmark className="h-3 w-3" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5"
        >
          <FaPlus className="h-3 w-3" aria-hidden="true" />
          Book new appointment
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-linear-to-r from-slate-100 via-white to-slate-100"
        />
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function dateBucketLabel(date: string): string {
  if (date === today) return "Today";

  const todayDate = new Date(`${today}T00:00:00`);
  const targetDate = new Date(`${date}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / dayMs);

  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return "This week";
  if (diffDays > 7 && diffDays <= 30) return "This month";
  if (diffDays > 30) return "Future";
  if (diffDays < -1 && diffDays >= -7) return "Last week";
  return "Past";
}

