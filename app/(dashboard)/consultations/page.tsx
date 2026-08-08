"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import {
  FaArrowUpRightFromSquare,
  FaCalendarDay,
  FaCircleCheck,
  FaClock,
  FaFileWaveform,
  FaHeartPulse,
  FaNotesMedical,
  FaPhone,
  FaUserDoctor,
  FaVideo,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes, usePatients } from "@/src/components/clinic/useClinicData";
import { VitalSignsForm } from "@/src/components/clinic/VitalSignsForm";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel, getAppointmentSecondaryReason } from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
} from "@/src/lib/appointments";
import type { ConsultationProgress, PatientRecordItem } from "@/src/lib/clinic";

type DraftState = {
  diagnosis: string;
  note: string;
  prescription: string;
  status: ConsultationProgress;
  visibleToPatient: boolean;
};

type OnlineConsultationRecord = {
  id: string;
  appointment_id: string;
  concern: string | null;
  symptoms: string | null;
  file_urls: Array<{ file_name?: string; file_type?: string; file_url?: string } | string>;
  platform: string | null;
  meeting_link: string | null;
  status: string;
};

type PatientRecordDraft = {
  familyHistory: string;
  medicalHistory: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export default function OnlineConsultationPage() {
  const { accessToken, role } = useRole();
  const { appointments, setAppointments } = useAppointments();
  const { data: notes, setData: setNotes, isLoading, error } = useConsultationNotes();
  const { data: patients, setData: setPatients } = usePatients();
  const [onlineConsultations, setOnlineConsultations] = useState<OnlineConsultationRecord[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    diagnosis: "",
    note: "",
    prescription: "",
    status: "Ready",
    visibleToPatient: false,
  });
  const [patientRecordDraft, setPatientRecordDraft] = useState<PatientRecordDraft>({
    familyHistory: "",
    medicalHistory: "",
    allergies: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });
  const [isSaving, startTransition] = useTransition();

  const canManage = role !== "PATIENT";

  const eligibleAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.status === "Confirmed"
            || appointment.status === "In Progress"
            || appointment.status === "Completed",
        )
        .sort((left, right) => {
          const byDateTime = `${left.date} ${left.start}`.localeCompare(
            `${right.date} ${right.start}`,
          );
          if (byDateTime !== 0) return byDateTime;
          return left.queueNumber - right.queueNumber;
        }),
    [appointments],
  );

  const activeAppointment = eligibleAppointments.find(
    (appointment) => appointment.id === activeAppointmentId,
  ) ?? null;
  const activeNote = activeAppointment
    ? notes.find((note) => note.appointmentId === activeAppointment.id) ?? null
    : null;
  const activePatientRecord = activeAppointment
    ? findPatientRecord(patients, activeAppointment)
    : null;
  const activeOnlineConsultation = activeAppointment
    ? onlineConsultations.find((item) => item.appointment_id === activeAppointment.id) ?? null
    : null;
  const patientRecordDirty =
    patientRecordDraft.familyHistory !== (activePatientRecord?.familyHistory ?? "")
    || patientRecordDraft.medicalHistory !== (activePatientRecord?.medicalHistory ?? "")
    || patientRecordDraft.allergies !== (activePatientRecord?.allergies ?? "")
    || patientRecordDraft.emergencyContactName !== (activePatientRecord?.emergencyContactName ?? "")
    || patientRecordDraft.emergencyContactPhone !== (activePatientRecord?.emergencyContactPhone ?? "");

  useEffect(() => {
    if (!accessToken || role === "PATIENT") return;
    let active = true;
    (async () => {
      const res = await fetch("/api/v2/online-consultations", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { consultations: OnlineConsultationRecord[] };
      if (active) setOnlineConsultations(payload.consultations ?? []);
    })();

    return () => {
      active = false;
    };
  }, [accessToken, role]);

  const onlineReady = appointments.filter(
    (appointment) => appointment.type === "Online" && appointment.status === "Confirmed",
  );
  const inProgressCount = appointments.filter((appointment) => appointment.status === "In Progress").length;
  const completedCount = notes.filter((note) => note.status === "Completed").length;

  if (role === "PATIENT") {
    return (
      <PatientConsultationLobby appointments={appointments} notes={notes} isLoading={isLoading} error={error} />
    );
  }

  function openConsultation(appointment: AppointmentRecord) {
    const existing = notes.find((note) => note.appointmentId === appointment.id);
    const patientRecord = findPatientRecord(patients, appointment);
    const inferredStatus: ConsultationProgress =
      existing?.status
      ?? (appointment.status === "Completed"
        ? "Completed"
        : appointment.status === "In Progress"
          ? "In Progress"
          : "Ready");
    setActiveAppointmentId(appointment.id);
    setDraft({
      diagnosis: existing?.diagnosis ?? "",
      note: existing?.note ?? "",
      prescription: existing?.prescription ?? "",
      status: inferredStatus,
      visibleToPatient: existing?.visibleToPatient ?? false,
    });
    setPatientRecordDraft({
      familyHistory: patientRecord?.familyHistory ?? "",
      medicalHistory: patientRecord?.medicalHistory ?? "",
      allergies: patientRecord?.allergies ?? "",
      emergencyContactName: patientRecord?.emergencyContactName ?? "",
      emergencyContactPhone: patientRecord?.emergencyContactPhone ?? "",
    });
    setFeedback(null);

    if (appointment.meetingLink) {
      window.open(appointment.meetingLink, "_blank", "noopener,noreferrer");
    }
  }

  function saveConsultation(appointment: AppointmentRecord) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const existing = notes.find((note) => note.appointmentId === appointment.id);
      const response = await fetch("/api/consultation-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: existing?.id,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          patientName: appointment.patientName,
          diagnosis: draft.diagnosis,
          note: draft.note,
          prescription: draft.prescription,
          status: draft.status,
          visibleToPatient: draft.visibleToPatient,
        }),
      });

      if (!response.ok) {
        setFeedback("Unable to save consultation note.");
        return;
      }

      const payload = (await response.json()) as { data: typeof notes };
      setNotes(payload.data);
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id
            ? {
                ...item,
                status:
                  draft.status === "Completed"
                    ? "Completed"
                    : draft.status === "In Progress"
                      ? "In Progress"
                      : "Confirmed",
              }
            : item,
        ),
      );
      setFeedback("Consultation note saved.");
    });
  }

  function savePatientRecord(appointment: AppointmentRecord) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    const patientRecord = findPatientRecord(patients, appointment);
    if (!patientRecord) {
      setFeedback("Unable to find the matching patient record for this consultation.");
      return;
    }

    startTransition(async () => {
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

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | { ok: true }
        | null;

      if (!response.ok) {
        const message =
          payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Unable to save patient record.";
        setFeedback(message);
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
      setFeedback("Patient record saved.");
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(17,17,17,0.14),transparent_28%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_56%,#f5f5f5_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">
              Consultations
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Start sessions and document care without losing the queue
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review who is ready, open the meeting when needed, and keep vitals, family history,
              notes, and follow-up plans in one focused workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/consultations/history" label="History" />
            <Shortcut href="/appointments/my" label="Appointments" />
            <Shortcut href="/schedules" label="Schedules" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric
          label="Ready Online"
          value={onlineReady.length.toString()}
          tone="sky"
          icon={<FaVideo className="h-4 w-4" />}
        />
        <Metric
          label="In Progress"
          value={inProgressCount.toString()}
          tone="amber"
          icon={<FaClock className="h-4 w-4" />}
        />
        <Metric
          label="Completed Notes"
          value={completedCount.toString()}
          tone="sky"
          icon={<FaCircleCheck className="h-4 w-4" />}
        />
      </div>

      {feedback ? (
        <Banner tone="info">{feedback}</Banner>
      ) : null}
      {error ? (
        <Banner tone="error">{error}</Banner>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-1 flex h-full flex-col overflow-hidden xl:h-[38rem]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Consultation Queue
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Patients ready for review</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {eligibleAppointments.length} total
            </span>
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden">
            {eligibleAppointments.length === 0 ? (
              <EmptyQueue />
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                {eligibleAppointments.map((appointment, index) => {
                const doctor = getDoctorById(appointment.doctorId);
                const note = notes.find((item) => item.appointmentId === appointment.id);
                const isActive = activeAppointmentId === appointment.id;
                const isOnlineReady = appointment.type === "Online" && Boolean(appointment.meetingLink);

                return (
                  <article
                    key={appointment.id}
                    className={`rounded-xl border p-3 transition-all animate-slide-in-left stagger-${Math.min(index + 1, 6)} ${
                      isActive
                        ? "border-neutral-400 bg-neutral-50/70 ring-2 ring-neutral-200"
                        : "border-slate-200 hover:border-neutral-200 hover:bg-neutral-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-slate-900">{appointment.patientName}</p>
                          <QueueFlag
                            label={appointment.status === "In Progress" ? "Live" : index === 0 ? "Next up" : `Queue #${appointment.queueNumber}`}
                            tone={appointment.status === "In Progress" ? "amber" : "sky"}
                          />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {doctor?.name ?? "Assigned doctor"} • {formatDisplayDate(appointment.date)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatRange(appointment.start, appointment.end)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                                      <Badge tone="sky">{appointment.type}</Badge>
                        <Badge tone={statusTone(note?.status ?? appointment.status)}>
                          {note?.status ?? appointment.status}
                        </Badge>
                      </div>
                    </div>

                    {appointment.reason ? (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {getAppointmentPrimaryLabel(appointment.reason, appointment.type)}
                        {getAppointmentSecondaryReason(appointment.reason)
                          ? ` • ${getAppointmentSecondaryReason(appointment.reason)}`
                          : ""}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openConsultation(appointment)}
                        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(17,17,17,0.20)] transition hover:-translate-y-0.5"
                      >
                        <FaNotesMedical className="h-3.5 w-3.5" aria-hidden="true" />
                        {appointment.meetingLink ? "Open Workspace" : "Write Notes"}
                      </button>
                      {appointment.meetingLink ? (
                        <a
                          href={appointment.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                            isOnlineReady
                              ? "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          <FaArrowUpRightFromSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Open Meeting
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-2 flex h-full flex-col overflow-hidden xl:h-[38rem]">
          {activeAppointment ? (
            <div className="space-y-5 overflow-y-auto flex-1">
              <div className="flex flex-col gap-4 rounded-[1.5rem] border border-neutral-100 bg-[linear-gradient(135deg,#f8f8f7_0%,#ffffff_100%)] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={activeAppointment.type === "Online" ? "sky" : "emerald"}>
                      {activeAppointment.type}
                    </Badge>
                    <Badge tone={statusTone(draft.status)}>{draft.status}</Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-slate-900">
                    {activeAppointment.patientName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {getDoctorById(activeAppointment.doctorId)?.name ?? "Assigned doctor"} •{" "}
                    {formatDisplayDate(activeAppointment.date)} •{" "}
                    {formatRange(activeAppointment.start, activeAppointment.end)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {activeAppointment.reason || "No consultation reason recorded."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeAppointment.meetingLink ? (
                    <a
                      href={activeAppointment.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                      Launch Meeting
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActiveAppointmentId(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <SummaryCard
                  icon={<FaCalendarDay className="h-4 w-4" />}
                  label="Schedule"
                  value={formatDisplayDate(activeAppointment.date)}
                  hint={formatRange(activeAppointment.start, activeAppointment.end)}
                />
                <SummaryCard
                  icon={<FaPhone className="h-4 w-4" />}
                  label="Contact"
                  value={activeAppointment.phone || activeAppointment.email || "No contact info"}
                  hint={activeAppointment.email && activeAppointment.phone ? activeAppointment.email : undefined}
                />
                <SummaryCard
                  icon={<FaUserDoctor className="h-4 w-4" />}
                  label="Patient Record"
                  value={activePatientRecord ? "Matched" : "Needs review"}
                  hint={activePatientRecord ? "Medical background can be updated here" : "No patient record match found"}
                />
              </div>

              {activeAppointment.type === "Online" ? (
                <div className="rounded-[1.5rem] border border-neutral-100 bg-neutral-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FaFileWaveform className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                      Online consultation intake
                    </p>
                    {activeOnlineConsultation?.platform ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">
                        {activeOnlineConsultation.platform}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Concern</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {activeOnlineConsultation?.concern || activeAppointment.reason || "No concern submitted."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Symptoms</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {activeOnlineConsultation?.symptoms || "No additional symptoms submitted."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-neutral-100 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Attached files / photos</p>
                      <span className="rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                        {activeOnlineConsultation?.file_urls?.length ?? 0} file{(activeOnlineConsultation?.file_urls?.length ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                    {activeOnlineConsultation?.file_urls?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeOnlineConsultation.file_urls.map((file, index) => {
                          const normalized = typeof file === "string"
                            ? { file_name: `Attachment ${index + 1}`, file_url: file, file_type: "attachment" }
                            : file;
                          return (
                            <a
                              key={`${normalized.file_url ?? "file"}-${index}`}
                              href={normalized.file_url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-100"
                            >
                              {normalized.file_name ?? `Attachment ${index + 1}`}
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No files were attached for this online consultation.</p>
                    )}
                  </div>
                </div>
              ) : null}

              {canManage ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.5rem] border border-neutral-100 bg-slate-50/70 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FaHeartPulse className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                      Vitals and visit context
                    </p>
                    <div className="mt-4">
                      <VitalSignsForm appointmentId={activeAppointment.id} />
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                    <div className="rounded-[1.5rem] border border-neutral-100 bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Emergency Contact Name
                          <input
                            value={patientRecordDraft.emergencyContactName}
                            onChange={(event) =>
                              setPatientRecordDraft((current) => ({
                                ...current,
                                emergencyContactName: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                            placeholder="Parent, spouse, sibling, or guardian"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Emergency Contact Phone
                          <input
                            value={patientRecordDraft.emergencyContactPhone}
                            onChange={(event) =>
                              setPatientRecordDraft((current) => ({
                                ...current,
                                emergencyContactPhone: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                            placeholder="+63 9XX XXX XXXX"
                          />
                        </label>
                      </div>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Medical History
                        <textarea
                          value={patientRecordDraft.medicalHistory}
                          onChange={(event) =>
                            setPatientRecordDraft((current) => ({
                              ...current,
                              medicalHistory: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-28 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Past illnesses, surgeries, maintenance medicines, pregnancy history, or other relevant medical background"
                        />
                      </label>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Allergies
                        <textarea
                          value={patientRecordDraft.allergies}
                          onChange={(event) =>
                            setPatientRecordDraft((current) => ({
                              ...current,
                              allergies: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-24 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Drug allergies, food allergies, latex, skin reactions, or no known allergies"
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Family History
                        <textarea
                          value={patientRecordDraft.familyHistory}
                          onChange={(event) =>
                            setPatientRecordDraft((current) => ({
                              ...current,
                              familyHistory: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-32 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Relevant illnesses or risks in the family, such as hypertension, diabetes, stroke, asthma, or cancer"
                        />
                        <span className="mt-2 block text-xs leading-5 text-slate-500">
                          This updates the shared patient record, while vitals remain attached to this specific visit.
                        </span>
                      </label>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Consultation Status
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              status: event.target.value as ConsultationProgress,
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-neutral-100 bg-white px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                        >
                          <option value="Ready">Ready</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </label>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => savePatientRecord(activeAppointment)}
                          disabled={isSaving || !activePatientRecord || !patientRecordDirty}
                          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? "Saving..." : "Save Patient Record"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-neutral-100 bg-white p-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Diagnosis
                        <textarea
                          value={draft.diagnosis}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, diagnosis: event.target.value }))
                          }
                          className="mt-2 min-h-24 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Clinical diagnosis, impression, or assessment"
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Consultation Notes
                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, note: event.target.value }))
                          }
                          className="mt-2 min-h-40 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Assessment, progress, symptoms, and recommendations"
                        />
                      </label>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Prescription / Plan
                        <textarea
                          value={draft.prescription}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              prescription: event.target.value,
                            }))
                          }
                          className="mt-2 min-h-28 w-full rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
                          placeholder="Medication, tests, referrals, or follow-up plan"
                        />
                      </label>

                      <label className="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 px-4 py-3 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.visibleToPatient}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              visibleToPatient: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-neutral-300 text-neutral-400 focus:ring-neutral-300"
                        />
                        Visible in patient portal
                      </label>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveConsultation(activeAppointment)}
                          disabled={isSaving}
                          className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-400"
                        >
                          {isSaving ? "Saving..." : "Save Consultation Note"}
                        </button>
                        {activeNote?.updatedAt ? (
                          <p className="self-center text-xs text-slate-500">
                            Last saved {new Date(activeNote.updatedAt).toLocaleString("en-US")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-neutral-200 bg-[linear-gradient(135deg,#f8f8f7_0%,#ffffff_100%)] p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50 text-neutral-400">
                <FaFileWaveform className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-900">Choose a consultation to begin</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                Select a patient from the queue to open the note-taking workspace, review vitals,
                update family history, and save the care plan.
              </p>
            </div>
          )}
        </section>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading consultation notes...</p> : null}
    </div>
  );
}

function findPatientRecord(patients: PatientRecordItem[], appointment: AppointmentRecord) {
  return patients.find((patient) => patient.email === appointment.email)
    ?? patients.find(
      (patient) =>
        patient.fullName === appointment.patientName
        && (patient.phone === appointment.phone || !patient.phone || !appointment.phone),
    )
    ?? null;
}

function PatientConsultationLobby({
  appointments,
  notes,
  isLoading,
  error,
}: {
  appointments: AppointmentRecord[];
  notes: Awaited<ReturnType<typeof useConsultationNotes>>["data"];
  isLoading: boolean;
  error: string | null;
}) {
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);

  const eligible = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.type === "Online"
            && ["Confirmed", "In Progress", "Completed"].includes(appointment.status),
        )
        .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`)),
    [appointments],
  );

  const activeAppointment = eligible.find((appointment) => appointment.id === activeAppointmentId) ?? null;
  const activeNote = activeAppointment
    ? notes.find((note) => note.appointmentId === activeAppointment.id) ?? null
    : null;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(17,17,17,0.14),transparent_28%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_56%,#f5f5f5_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">
              Consultations
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Join online consultations and review your visit notes
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Open your meeting link, check the consultation details, and keep your visit history in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/consultations/history" label="History" />
            <Shortcut href="/appointments/my" label="Appointments" />
          </div>
        </div>
      </section>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:h-[calc(100vh-24rem)]">
        <section className="rounded-[2rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-1 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Available Sessions
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Online appointments ready for you</h2>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {eligible.length} total
            </span>
          </div>

          <div className="mt-5 flex-1 overflow-hidden flex flex-col">
            {eligible.length === 0 ? (
              <EmptyQueue message="No online sessions found yet." />
            ) : (
              <div className="overflow-y-auto space-y-3 pr-2 flex-1">
                {eligible.map((appointment, index) => {
                  const doctor = getDoctorById(appointment.doctorId);
                  const note = notes.find((item) => item.appointmentId === appointment.id);
                  const isActive = activeAppointmentId === appointment.id;

                  return (
                    <article
                      key={appointment.id}
                      className={`rounded-[1.5rem] border p-4 transition-all animate-slide-in-left stagger-${Math.min(index + 1, 6)} ${
                        isActive
                          ? "border-neutral-400 bg-neutral-50/70 ring-2 ring-neutral-200"
                          : "border-slate-200 hover:border-neutral-200 hover:bg-neutral-50/40"
                      }`}
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-slate-900">{appointment.patientName}</p>
                          <QueueFlag label={appointment.status} tone={appointment.status === "In Progress" ? "amber" : "emerald"} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {doctor?.name ?? "Assigned doctor"} • {formatDisplayDate(appointment.date)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatRange(appointment.start, appointment.end)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge tone="sky">Online</Badge>
                        <Badge tone={statusTone(note?.status ?? appointment.status)}>
                          {note?.status ?? appointment.status}
                        </Badge>
                      </div>
                    </div>

                    {appointment.reason ? (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {getAppointmentPrimaryLabel(appointment.reason, appointment.type)}
                        {getAppointmentSecondaryReason(appointment.reason)
                          ? ` • ${getAppointmentSecondaryReason(appointment.reason)}`
                          : ""}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {appointment.meetingLink ? (
                        <a
                          href={appointment.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5"
                        >
                          <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
                          Join Consultation
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setActiveAppointmentId(isActive ? null : appointment.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                      >
                        Details
                      </button>
                    </div>
                  </article>
                );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-neutral-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-2 flex flex-col overflow-hidden">
          {activeAppointment ? (
            <div className="space-y-5 overflow-y-auto flex-1">
              <div className="flex flex-col gap-4 rounded-[1.5rem] border border-neutral-100 bg-[linear-gradient(135deg,#f8f8f7_0%,#ffffff_100%)] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sky">Online</Badge>
                    <Badge tone={statusTone(activeNote?.status ?? activeAppointment.status)}>
                      {activeNote?.status ?? activeAppointment.status}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-slate-900">
                    {activeAppointment.patientName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {getDoctorById(activeAppointment.doctorId)?.name ?? "Assigned doctor"} • {formatDisplayDate(activeAppointment.date)} • {formatRange(activeAppointment.start, activeAppointment.end)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {activeAppointment.reason || "No consultation reason recorded."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeAppointment.meetingLink ? (
                    <a
                      href={activeAppointment.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      <FaArrowUpRightFromSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      Open Meeting
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActiveAppointmentId(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              {activeNote ? (
                <div className="rounded-[1.5rem] border border-neutral-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Diagnosis</p>
                  <p className="mt-2 text-sm text-slate-600">{activeNote.diagnosis || "No diagnosis recorded."}</p>
                  <p className="text-sm font-semibold text-slate-900">Consultation Notes</p>
                  <p className="mt-2 text-sm text-slate-600">{activeNote.note}</p>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Prescription / Plan</p>
                  <p className="mt-2 text-sm text-slate-600">{activeNote.prescription || "No prescription recorded."}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {activeNote.visibleToPatient ? "Visible in patient portal" : "Hidden from patient portal"}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Updated {new Date(activeNote.updatedAt).toLocaleString("en-US")}
                  </p>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                  No consultation notes saved for this visit yet.
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-neutral-200 bg-[linear-gradient(135deg,#f8f8f7_0%,#ffffff_100%)] p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50 text-neutral-400">
                <FaFileWaveform className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-900">Choose a consultation to begin</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                Select an appointment to open the meeting link and review the consultation notes.
              </p>
            </div>
          )}
        </section>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading consultation notes...</p> : null}
    </div>
  );
}

function statusTone(
  status: ConsultationProgress | AppointmentRecord["status"],
): "sky" | "emerald" | "amber" {
  if (status === "Completed") return "emerald";
  if (status === "In Progress") return "amber";
  return "sky";
}

function EmptyQueue({ message = "No consultations ready yet." }: { message?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <FaNotesMedical className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm text-slate-500">{message}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber";
  icon: ReactNode;
}) {
  const styles = {
    sky: "bg-neutral-50 text-neutral-700 border-neutral-100",
    emerald: "bg-neutral-50 text-neutral-700 border-neutral-100",
    amber: "bg-neutral-50 text-neutral-700 border-neutral-100",
  } as const;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm hover-lift">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${styles[tone]}`}>
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "sky" | "emerald" | "amber";
}) {
  const styles = {
    sky: "bg-neutral-100 text-neutral-700",
    emerald: "bg-neutral-100 text-neutral-700",
    amber: "bg-neutral-100 text-neutral-700",
  } as const;

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function QueueFlag({
  label,
  tone,
}: {
  label: string;
  tone: "sky" | "emerald" | "amber";
}) {
  const styles = {
    sky: "bg-neutral-100 text-neutral-700",
    emerald: "bg-neutral-100 text-neutral-700",
    amber: "bg-neutral-100 text-neutral-700",
  } as const;

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${styles[tone]}`}>{label}</span>;
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-neutral-700 shadow-sm">
        {icon}
      </span>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Banner({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "info" | "error";
}) {
  const styles = {
    info: "border-slate-200 bg-slate-50 text-slate-700",
    error: "border-neutral-200 bg-neutral-50 text-neutral-700",
  } as const;
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-100 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

