"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import {
  FaAddressBook,
  FaArrowUpRightFromSquare,
  FaCalendarDay,
  FaCircleCheck,
  FaCircleInfo,
  FaEye,
  FaEyeSlash,
  FaFileMedical,
  FaFileWaveform,
  FaFloppyDisk,
  FaLaptopMedical,
  FaListCheck,
  FaNotesMedical,
  FaPenToSquare,
  FaPhone,
  FaPlus,
  FaPrescriptionBottleMedical,
  FaStethoscope,
  FaTrash,
  FaUserDoctor,
  FaUserGroup,
  FaVideo,
  FaXmark,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useConsultationNotes, usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel, getAppointmentSecondaryReason } from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
} from "@/src/lib/appointments";
import type { ConsultationNote, ConsultationProgress, PatientRecordItem } from "@/src/lib/clinic";
import { calculatePatientAge } from "@/src/lib/patient-registration";

type DraftState = {
  diagnosis: string;
  note: string;
  prescription: string;
  status: ConsultationProgress;
  visibleToPatient: boolean;
};

type PrescriptionItemDraft = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type CreatedPrescription = {
  id: string;
  prescriptionNo: string;
};

type QueueFilter = "all" | "ready" | "live" | "completed";
type ConsultationTab = "record" | "chart";
type BadgeTone = "sky" | "emerald" | "amber" | "rose" | "slate";

const emptyDraft: DraftState = {
  diagnosis: "",
  note: "",
  prescription: "",
  status: "Ready",
  visibleToPatient: false,
};

const emptyPrescriptionItem: PrescriptionItemDraft = {
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export default function OnlineConsultationPage() {
  const { accessToken, role } = useRole();
  const { appointments, setAppointments } = useAppointments();
  const { doctors } = useDoctors();
  const { data: notes, setData: setNotes, isLoading, error } = useConsultationNotes();
  const { data: patients } = usePatients();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ConsultationTab>("record");
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemDraft[]>([{ ...emptyPrescriptionItem }]);
  const [prescriptionInstructions, setPrescriptionInstructions] = useState("");
  const [prescriptionFollowUpDate, setPrescriptionFollowUpDate] = useState("");
  const [releasePrescription, setReleasePrescription] = useState(true);
  const [prescriptionFeedback, setPrescriptionFeedback] = useState<string | null>(null);
  const [createdPrescription, setCreatedPrescription] = useState<CreatedPrescription | null>(null);
  const [isSaving, startTransition] = useTransition();

  const eligibleAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) =>
          ["Confirmed", "In Progress", "Completed"].includes(appointment.status),
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

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return eligibleAppointments.filter((appointment) => {
      const note = notes.find((item) => item.appointmentId === appointment.id);
      const status = note?.status ?? appointment.status;
      const matchesFilter =
        queueFilter === "all"
        || (queueFilter === "ready" && (status === "Ready" || status === "Confirmed"))
        || (queueFilter === "live" && status === "In Progress")
        || (queueFilter === "completed" && status === "Completed");

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        appointment.patientName,
        appointment.email,
        appointment.phone,
        appointment.reason,
        getDoctorById(appointment.doctorId)?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [eligibleAppointments, notes, queueFilter, searchQuery]);

  const activeAppointment = eligibleAppointments.find(
    (appointment) => appointment.id === activeAppointmentId,
  ) ?? null;
  const activeNote = activeAppointment
    ? notes.find((note) => note.appointmentId === activeAppointment.id) ?? null
    : null;
  const activePatientRecord = activeAppointment
    ? findPatientRecord(patients, activeAppointment)
    : null;

  const readyCount = eligibleAppointments.filter((appointment) => {
    const note = notes.find((item) => item.appointmentId === appointment.id);
    const status = note?.status ?? appointment.status;
    return status === "Ready" || status === "Confirmed";
  }).length;
  const onlineReadyCount = eligibleAppointments.filter(
    (appointment) => appointment.type === "Online" && appointment.status === "Confirmed",
  ).length;
  const inProgressCount = eligibleAppointments.filter((appointment) => {
    const note = notes.find((item) => item.appointmentId === appointment.id);
    return (note?.status ?? appointment.status) === "In Progress";
  }).length;
  const completedCount = notes.filter((note) => note.status === "Completed").length;

  if (role === "PATIENT") {
    return (
      <PatientConsultationLobby appointments={appointments} notes={notes} isLoading={isLoading} error={error} />
    );
  }

  function selectConsultation(appointment: AppointmentRecord, tab: ConsultationTab = "record") {
    const existing = notes.find((note) => note.appointmentId === appointment.id);
    const inferredStatus: ConsultationProgress =
      existing?.status
      ?? (appointment.status === "Completed"
        ? "Completed"
        : appointment.status === "In Progress"
          ? "In Progress"
          : "Ready");

    setActiveAppointmentId(appointment.id);
    setActiveTab(tab);
    setDraft({
      diagnosis: existing?.diagnosis ?? "",
      note: existing?.note ?? "",
      prescription: existing?.prescription ?? "",
      status: inferredStatus,
      visibleToPatient: existing?.visibleToPatient ?? false,
    });
    setPrescriptionItems([{ ...emptyPrescriptionItem }]);
    setPrescriptionInstructions(existing?.prescription ?? "");
    setPrescriptionFollowUpDate("");
    setReleasePrescription(true);
    setPrescriptionFeedback(null);
    setCreatedPrescription(null);
    setFeedback(null);
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

      const payload = (await response.json()) as { data: ConsultationNote[] };
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

  function updatePrescriptionItem(index: number, field: keyof PrescriptionItemDraft, value: string) {
    setPrescriptionItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
    setPrescriptionFeedback(null);
  }

  function addPrescriptionItem() {
    setPrescriptionItems((current) => [...current, { ...emptyPrescriptionItem }]);
    setPrescriptionFeedback(null);
  }

  function removePrescriptionItem(index: number) {
    setPrescriptionItems((current) =>
      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index),
    );
    setPrescriptionFeedback(null);
  }

  function savePrescription(appointment: AppointmentRecord) {
    if (!accessToken) {
      setPrescriptionFeedback("Your session expired. Please sign in again.");
      return;
    }

    if (!activePatientRecord) {
      setPrescriptionFeedback("Match this appointment to a patient record before creating a prescription.");
      return;
    }

    const doctor = doctors.find((item) => item.slug === appointment.doctorId || item.id === appointment.doctorId);
    if (!doctor?.dbId) {
      setPrescriptionFeedback("Doctor profile is still loading. Try again in a moment.");
      return;
    }

    const diagnosis = draft.diagnosis.trim();
    if (!diagnosis) {
      setPrescriptionFeedback("Add a diagnosis before creating the prescription.");
      return;
    }

    const cleanedItems = prescriptionItems
      .map((item) => ({
        medicine_name: item.medicineName.trim(),
        dosage: item.dosage.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        instructions: item.instructions.trim(),
      }))
      .filter((item) => item.medicine_name);

    if (cleanedItems.length === 0) {
      setPrescriptionFeedback("Add at least one medicine item.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/v2/prescriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: appointment.id,
          patient_id: activePatientRecord.id,
          doctor_id: doctor.dbId,
          diagnosis_text: diagnosis,
          treatment_plan: draft.note,
          general_instructions: prescriptionInstructions,
          follow_up_date: prescriptionFollowUpDate || null,
          released_to_patient: releasePrescription,
          items: cleanedItems,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        prescription?: { id?: string; prescription_no?: string };
      };

      if (!response.ok) {
        setPrescriptionFeedback(payload.message ?? "Unable to create prescription.");
        return;
      }

      setDraft((current) => ({
        ...current,
        prescription: prescriptionInstructions || current.prescription,
        visibleToPatient: current.visibleToPatient || releasePrescription,
      }));
      setPrescriptionItems([{ ...emptyPrescriptionItem }]);
      setPrescriptionInstructions("");
      setPrescriptionFollowUpDate("");
      setCreatedPrescription(
        payload.prescription?.prescription_no && payload.prescription?.id
          ? {
              id: payload.prescription.id,
              prescriptionNo: payload.prescription.prescription_no,
            }
          : null,
      );
      setPrescriptionFeedback(
        payload.prescription?.prescription_no
          ? `Prescription ${payload.prescription.prescription_no} created.`
          : "Prescription created.",
      );
    });
  }

  async function fetchPrescriptionPdf(prescription: CreatedPrescription) {
    if (!accessToken) {
      setPrescriptionFeedback("Your session expired. Please sign in again.");
      return null;
    }

    const response = await fetch(`/api/v2/prescriptions/${prescription.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setPrescriptionFeedback("Unable to open prescription PDF.");
      return null;
    }

    return response.blob();
  }

  async function downloadCreatedPrescription(prescription: CreatedPrescription) {
    const blob = await fetchPrescriptionPdf(prescription);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${prescription.prescriptionNo}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function printCreatedPrescription(prescription: CreatedPrescription) {
    const blob = await fetchPrescriptionPdf(prescription);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setPrescriptionFeedback("Pop-up blocked. Please allow pop-ups to print the prescription.");
      window.URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.print();
      setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  return (
    <div className="pb-8">
      <div className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Consultations
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
            Visit workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Move from queue to patient record, charting, and prescription updates without leaving the visit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shortcut href="/consultations/history" label="History" />
          <Shortcut href="/appointments/my" label="Appointments" />
          <Shortcut href="/schedules" label="Schedules" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Ready"
          value={readyCount.toString()}
          hint={`${onlineReadyCount} virtual`}
          tone="sky"
          icon={<FaListCheck className="h-4 w-4" />}
        />
        <Metric
          label="In progress"
          value={inProgressCount.toString()}
          hint="Active visits"
          tone="amber"
          icon={<FaStethoscope className="h-4 w-4" />}
        />
        <Metric
          label="Notes done"
          value={completedCount.toString()}
          hint="Completed charts"
          tone="emerald"
          icon={<FaCircleCheck className="h-4 w-4" />}
        />
        <Metric
          label="Queue"
          value={eligibleAppointments.length.toString()}
          hint="Confirmed visits"
          tone="slate"
          icon={<FaUserGroup className="h-4 w-4" />}
        />
      </div>

      {feedback ? <Banner tone="info">{feedback}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {isLoading ? <Banner tone="info">Loading consultation notes...</Banner> : null}

      <div className="mt-5 grid min-h-[42rem] gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="min-h-0 rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Queue
                </p>
                <h2 className="mt-1 text-lg font-bold text-neutral-950">Select a visit</h2>
              </div>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                {filteredAppointments.length}
              </span>
            </div>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="mt-4 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
              placeholder="Search patient, contact, reason"
            />
            <div className="mt-3 grid grid-cols-4 rounded-md border border-neutral-200 bg-neutral-50 p-1">
              <FilterButton active={queueFilter === "all"} onClick={() => setQueueFilter("all")}>
                All
              </FilterButton>
              <FilterButton active={queueFilter === "ready"} onClick={() => setQueueFilter("ready")}>
                Ready
              </FilterButton>
              <FilterButton active={queueFilter === "live"} onClick={() => setQueueFilter("live")}>
                Live
              </FilterButton>
              <FilterButton active={queueFilter === "completed"} onClick={() => setQueueFilter("completed")}>
                Done
              </FilterButton>
            </div>
          </div>

          <div className="max-h-[40rem] space-y-2 overflow-y-auto p-3">
            {filteredAppointments.length === 0 ? (
              <EmptyQueue message="No consultations match this view." />
            ) : (
              filteredAppointments.map((appointment, index) => {
                const note = notes.find((item) => item.appointmentId === appointment.id);
                const isActive = activeAppointmentId === appointment.id;
                return (
                  <QueueVisitCard
                    key={appointment.id}
                    appointment={appointment}
                    note={note}
                    isActive={isActive}
                    label={appointment.status === "In Progress" ? "Live" : index === 0 ? "Next" : `#${appointment.queueNumber}`}
                    onSelect={() => selectConsultation(appointment)}
                  />
                );
              })
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-neutral-200 bg-white shadow-sm">
          {activeAppointment ? (
            <div className="flex h-full min-h-0 flex-col">
              <VisitHeader
                appointment={activeAppointment}
                patientRecord={activePatientRecord}
                onClose={() => setActiveAppointmentId(null)}
              />

              <div className="border-b border-neutral-200 px-4 sm:px-5">
                <div className="flex gap-1 overflow-x-auto py-3">
                  <TabButton
                    active={activeTab === "record"}
                    icon={<FaAddressBook className="h-4 w-4" />}
                    label="Patient record"
                    onClick={() => setActiveTab("record")}
                  />
                  <TabButton
                    active={activeTab === "chart"}
                    icon={<FaPenToSquare className="h-4 w-4" />}
                    label="Charting"
                    onClick={() => setActiveTab("chart")}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {activeTab === "record" ? (
                  <PatientRecordSnapshot
                    appointment={activeAppointment}
                    patientRecord={activePatientRecord}
                  />
                ) : null}

                {activeTab === "chart" ? (
                  <div className="mx-auto max-w-6xl space-y-5">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                        <SectionHeading
                          icon={<FaStethoscope className="h-4 w-4" />}
                          title="Assessment"
                          description="Start with the clinical impression, then keep the chart details together below."
                        />
                        <div className="mt-4 space-y-4">
                          <TextAreaField
                            label="Diagnosis"
                            value={draft.diagnosis}
                            minHeight="min-h-40"
                            onChange={(value) => setDraft((current) => ({ ...current, diagnosis: value }))}
                            placeholder="Clinical diagnosis, impression, or assessment"
                          />
                          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={draft.visibleToPatient}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  visibleToPatient: event.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-400"
                            />
                            <span className="inline-flex items-center gap-2">
                              {draft.visibleToPatient ? (
                                <FaEye className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                              ) : (
                                <FaEyeSlash className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                              )}
                              Visible in patient portal
                            </span>
                          </label>
                          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                            Keep the assessment short and specific. The final chart status is set at the bottom of this page.
                          </div>
                        </div>
                      </section>

                      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                        <SectionHeading
                          icon={<FaNotesMedical className="h-4 w-4" />}
                          title="Consultation note"
                          description="Document symptoms, decisions, and the follow-up plan in one place."
                        />
                        <div className="mt-4 space-y-4">
                          <TextAreaField
                            label="Consultation notes"
                            value={draft.note}
                            minHeight="min-h-56"
                            onChange={(value) => setDraft((current) => ({ ...current, note: value }))}
                            placeholder="Assessment, progress, symptoms, recommendations, and patient instructions"
                          />
                          <TextAreaField
                            label="Care plan summary"
                            value={draft.prescription}
                            minHeight="min-h-32"
                            onChange={(value) => setDraft((current) => ({ ...current, prescription: value }))}
                            placeholder="Tests, referrals, aftercare, lifestyle plan, or follow-up summary"
                          />
                        </div>
                      </section>
                    </div>

                    <PrescriptionBuilder
                      items={prescriptionItems}
                      instructions={prescriptionInstructions}
                      followUpDate={prescriptionFollowUpDate}
                      releaseToPatient={releasePrescription}
                      feedback={prescriptionFeedback}
                      createdPrescription={createdPrescription}
                      disabled={isSaving}
                      patientMatched={Boolean(activePatientRecord)}
                      onItemChange={updatePrescriptionItem}
                      onAddItem={addPrescriptionItem}
                      onRemoveItem={removePrescriptionItem}
                      onInstructionsChange={(value) => {
                        setPrescriptionInstructions(value);
                        setPrescriptionFeedback(null);
                      }}
                      onFollowUpDateChange={(value) => {
                        setPrescriptionFollowUpDate(value);
                        setPrescriptionFeedback(null);
                      }}
                      onReleaseChange={(value) => {
                        setReleasePrescription(value);
                        setPrescriptionFeedback(null);
                      }}
                      onSave={() => savePrescription(activeAppointment)}
                      onDownloadCreated={() =>
                        createdPrescription
                          ? void downloadCreatedPrescription(createdPrescription)
                          : undefined
                      }
                      onPrintCreated={() =>
                        createdPrescription
                          ? void printCreatedPrescription(createdPrescription)
                          : undefined
                      }
                    />

                    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                          <p className="text-sm font-bold text-neutral-950">Save and close out</p>
                          <p className="mt-1 text-sm text-neutral-600">
                            Save the note first, then set the chart status as the final step so it is harder to miss.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveConsultation(activeAppointment)}
                          disabled={isSaving}
                          className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                        >
                          <FaFloppyDisk className="h-4 w-4" aria-hidden="true" />
                          {isSaving ? "Saving..." : "Save note"}
                        </button>
                      </div>
                      <div className="mt-5 border-t border-neutral-200 pt-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-bold text-neutral-950">Chart status</p>
                            <p className="mt-1 text-sm text-neutral-600">
                              Set this last, after the assessment, note, and prescription are ready.
                            </p>
                          </div>
                          <StatusControl
                            value={draft.status}
                            onChange={(status) => setDraft((current) => ({ ...current, status }))}
                          />
                        </div>
                        {activeNote?.updatedAt ? (
                          <p className="mt-4 text-xs text-neutral-500">
                            Last saved {new Date(activeNote.updatedAt).toLocaleString("en-US")}
                          </p>
                        ) : null}
                      </div>
                    </section>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyWorkspace />
          )}
        </section>
      </div>
    </div>
  );
}

function PatientConsultationLobby({
  appointments,
  notes,
  isLoading,
  error,
}: {
  appointments: AppointmentRecord[];
  notes: ConsultationNote[];
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

  const activeAppointment = activeAppointmentId === "none"
    ? null
    : eligible.find((appointment) => appointment.id === activeAppointmentId) ?? eligible[0] ?? null;
  const activeNote = activeAppointment
    ? notes.find((note) => note.appointmentId === activeAppointment.id) ?? null
    : null;
  const upcomingCount = eligible.filter((appointment) => appointment.status !== "Completed").length;

  return (
    <div className="pb-8">
      <div className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Consultations
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
            Virtual consultation hub
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Join your online appointment and review notes shared by the clinic after the visit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shortcut href="/consultations/history" label="History" />
          <Shortcut href="/appointments/my" label="Appointments" />
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {isLoading ? <Banner tone="info">Loading consultation notes...</Banner> : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Upcoming"
          value={upcomingCount.toString()}
          hint="Virtual visits"
          tone="sky"
          icon={<FaVideo className="h-4 w-4" />}
        />
        <Metric
          label="Completed"
          value={notes.filter((note) => note.status === "Completed").length.toString()}
          hint="Shared notes"
          tone="emerald"
          icon={<FaCircleCheck className="h-4 w-4" />}
        />
        <Metric
          label="Total"
          value={eligible.length.toString()}
          hint="Online consults"
          tone="slate"
          icon={<FaLaptopMedical className="h-4 w-4" />}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Sessions
            </p>
            <h2 className="mt-1 text-lg font-bold text-neutral-950">Your online consultations</h2>
          </div>
          <div className="max-h-[36rem] space-y-2 overflow-y-auto p-3">
            {eligible.length === 0 ? (
              <EmptyQueue message="No virtual consultations found yet." />
            ) : (
              eligible.map((appointment) => {
                const note = notes.find((item) => item.appointmentId === appointment.id);
                const isActive = activeAppointment?.id === appointment.id;
                return (
                  <QueueVisitCard
                    key={appointment.id}
                    appointment={appointment}
                    note={note}
                    isActive={isActive}
                    label={appointment.status}
                    onSelect={() => setActiveAppointmentId(appointment.id)}
                    patientView
                  />
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          {activeAppointment ? (
            <div>
              <div className="flex flex-col gap-4 border-b border-neutral-200 bg-neutral-50 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="sky">Virtual</Badge>
                    <Badge tone={statusTone(activeNote?.status ?? activeAppointment.status)}>
                      {activeNote?.status ?? activeAppointment.status}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-neutral-950">
                    {formatDisplayDate(activeAppointment.date)}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-600">
                    {formatRange(activeAppointment.start, activeAppointment.end)} with{" "}
                    {getDoctorById(activeAppointment.doctorId)?.name ?? "Assigned doctor"}
                  </p>
                  <p className="mt-2 text-sm text-neutral-500">
                    {formatReason(activeAppointment)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAppointmentId("none")}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50"
                >
                  <FaXmark className="h-4 w-4" aria-hidden="true" />
                  Close
                </button>
              </div>

              <div className="p-4 sm:p-5">
                <MeetingLinkPanel appointment={activeAppointment} variant="patient" />
                {activeNote ? (
                  <div className="space-y-5">
                    <ReadOnlyNoteBlock title="Diagnosis" value={activeNote.diagnosis || "No diagnosis recorded."} />
                    <ReadOnlyNoteBlock title="Consultation notes" value={activeNote.note || "No consultation note recorded."} />
                    <ReadOnlyNoteBlock title="Prescription / plan" value={activeNote.prescription || "No prescription recorded."} />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
                      <Badge tone={activeNote.visibleToPatient ? "emerald" : "slate"}>
                        {activeNote.visibleToPatient ? "Visible in portal" : "Clinic only"}
                      </Badge>
                      <p className="text-xs text-neutral-500">
                        Updated {new Date(activeNote.updatedAt).toLocaleString("en-US")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
                    <FaFileWaveform className="mx-auto h-7 w-7 text-neutral-400" aria-hidden="true" />
                    <h2 className="mt-4 text-lg font-bold text-neutral-950">No shared notes yet</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                      Notes and prescriptions will appear here when the clinic shares them with your portal.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyWorkspace compact />
          )}
        </section>
      </div>
    </div>
  );
}

function VisitHeader({
  appointment,
  patientRecord,
  onClose,
}: {
  appointment: AppointmentRecord;
  patientRecord: PatientRecordItem | null;
  onClose: () => void;
}) {
  const meetingLink = appointment.meetingLink?.trim() ?? "";
  return (
    <div className="border-b border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={appointment.type === "Online" ? "sky" : "emerald"}>
              {formatAppointmentType(appointment.type)}
            </Badge>
            {patientRecord ? <Badge tone="slate">{patientRecord.patientNumber}</Badge> : null}
          </div>
          <h2 className="mt-3 truncate text-2xl font-black text-neutral-950">
            {appointment.patientName}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {getDoctorById(appointment.doctorId)?.name ?? "Assigned doctor"} -{" "}
            {formatDisplayDate(appointment.date)} - {formatRange(appointment.start, appointment.end)}
          </p>
          <p className="mt-2 max-w-3xl text-sm text-neutral-500">{formatReason(appointment)}</p>
        </div>
        <div className="flex w-full max-w-xl flex-col gap-3">
          {meetingLink ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Meeting link
                </p>
                <Badge tone="sky">{getMeetingPlatformLabel(meetingLink)}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700">
                Open the video room from the consultation workspace, then keep this visit open while you chart.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  <FaVideo className="h-4 w-4" aria-hidden="true" />
                  Launch meeting
                </a>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50"
                >
                  <FaArrowUpRightFromSquare className="h-4 w-4" aria-hidden="true" />
                  Open link
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
              No meeting link has been assigned yet. If Settings already has the clinic link saved, refresh the page or reopen the appointment after confirming.
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50"
            >
              <FaXmark className="h-4 w-4" aria-hidden="true" />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetingLinkPanel({
  appointment,
  variant,
}: {
  appointment: AppointmentRecord;
  variant: "doctor" | "patient";
}) {
  const meetingLink = appointment.meetingLink?.trim() ?? "";

  if (!meetingLink) {
    return (
      <div className="mb-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        {variant === "doctor"
          ? "No meeting link is set yet. The clinic default in Settings will be used once the appointment syncs."
          : "No meeting link is ready yet. The clinic will show the link here as soon as it is available."}
      </div>
    );
  }

  const platform = getMeetingPlatformLabel(meetingLink);
  return (
    <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Virtual consult
        </p>
        <Badge tone="sky">{platform}</Badge>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            {variant === "doctor" ? "Launch the meeting from here" : "Join your consult when the clinic is ready"}
          </p>
          <p className="text-sm leading-6 text-neutral-600">
            {variant === "doctor"
              ? "Share this link with the patient if needed, then keep the workspace open while charting."
              : "Use the same link the clinic prepared in Settings for this virtual consult."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <FaVideo className="h-4 w-4" aria-hidden="true" />
            Join meeting
          </a>
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50"
          >
            <FaArrowUpRightFromSquare className="h-4 w-4" aria-hidden="true" />
            Open link
          </a>
        </div>
      </div>
    </div>
  );
}

function QueueVisitCard({
  appointment,
  note,
  isActive,
  label,
  onSelect,
  patientView = false,
}: {
  appointment: AppointmentRecord;
  note: ConsultationNote | undefined;
  isActive: boolean;
  label: string;
  onSelect: () => void;
  patientView?: boolean;
}) {
  const status = note?.status ?? appointment.status;
  const doctor = getDoctorById(appointment.doctorId);

  return (
    <article
      className={`rounded-lg border p-3 transition ${
        isActive
          ? "border-neutral-900 bg-neutral-50 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-400"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold text-neutral-950">{appointment.patientName}</p>
              <QueueFlag label={label} tone={statusTone(status)} />
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              {formatDisplayDate(appointment.date)} - {formatRange(appointment.start, appointment.end)}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-500">
              {patientView ? doctor?.name ?? "Assigned doctor" : formatReason(appointment)}
            </p>
          </div>
          <Badge tone={appointment.type === "Online" ? "sky" : "emerald"}>
            {formatAppointmentType(appointment.type)}
          </Badge>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-neutral-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          <FaNotesMedical className="h-3.5 w-3.5" aria-hidden="true" />
          {patientView ? (isActive ? "Viewing" : "Details") : "Open"}
        </button>
        {appointment.meetingLink ? (
          <a
            href={appointment.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50"
            aria-label="Open meeting"
          >
            <FaArrowUpRightFromSquare className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function PatientRecordSnapshot({
  appointment,
  patientRecord,
}: {
  appointment: AppointmentRecord;
  patientRecord: PatientRecordItem | null;
}) {
  const patientName = patientRecord?.fullName || appointment.patientName;
  const patientNumber = patientRecord?.patientNumber || "No patient number";
  const birthDate = patientRecord?.dateOfBirth ? formatDisplayDate(patientRecord.dateOfBirth) : "Not recorded";
  const recordStatus = patientRecord?.status || "Not recorded";
  const patientType = patientRecord?.patientCategory || "Not recorded";
  const openHref = patientRecord ? `/patients/records/${patientRecord.id}` : "/patients/records";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">View only</Badge>
              <Badge tone={patientRecord ? "emerald" : "rose"}>
                {patientRecord ? "Linked record" : "No linked record"}
              </Badge>
            </div>
            <h2 className="mt-3 truncate text-2xl font-black text-neutral-950">{patientName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              This is a read-only glimpse of the patient record. Open the full patient record page to edit details.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="slate">{patientNumber}</Badge>
              <Badge tone="sky">{birthDate}</Badge>
              <Badge tone="amber">{recordStatus}</Badge>
              <Badge tone="emerald">{patientType}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Shortcut href={openHref} label={patientRecord ? "Open full record" : "Open patient records"} />
          </div>
        </div>
      </section>

      {!patientRecord ? (
        <Banner tone="error">
          No matching patient record was found for this appointment. Check the patient name, email, or phone in patient records.
        </Banner>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5">
            <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <SectionHeading
                icon={<FaAddressBook className="h-4 w-4" />}
                title="Identity and contact"
                description="Core fields from the patient records page."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ReadOnlyField label="Patient number" value={patientRecord.patientNumber || "Not recorded"} />
                <ReadOnlyField label="Full name" value={patientRecord.fullName || "Not recorded"} />
                <ReadOnlyField label="Birth date" value={birthDate} />
                <ReadOnlyField label="Gender" value={patientRecord.gender || "Not recorded"} />
                <ReadOnlyField label="Civil status" value={patientRecord.civilStatus || "Not recorded"} />
                <ReadOnlyField label="Patient type" value={patientType} />
                <div className="xl:col-span-3">
                  <ReadOnlyField label="Address" value={patientRecord.address || "Not recorded"} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <SectionHeading
                icon={<FaUserGroup className="h-4 w-4" />}
                title="Contact and emergency"
                description="Reference information for clinic coordination and aftercare."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Mobile number" value={patientRecord.phone || "Not recorded"} />
                <ReadOnlyField label="Email address" value={patientRecord.email || "Not recorded"} />
                <ReadOnlyField label="Emergency contact name" value={patientRecord.emergencyContactName || "Not recorded"} />
                <ReadOnlyField label="Emergency contact phone" value={patientRecord.emergencyContactPhone || "Not recorded"} />
                <ReadOnlyField label="Guardian" value={patientRecord.guardianName || "Not recorded"} />
                <ReadOnlyField label="Occupation" value={patientRecord.occupation || "Not recorded"} />
                <div className="md:col-span-2">
                  <ReadOnlyField label="Religion" value={patientRecord.religion || "Not recorded"} />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <SectionHeading
                icon={<FaFileMedical className="h-4 w-4" />}
                title="Medical background"
                description="Long-form background that should stay readable without editing it here."
              />
              <div className="mt-4 space-y-4">
                <ReadOnlyNoteBlock
                  title="Allergies"
                  value={patientRecord.allergies || "No allergies recorded."}
                />
                <ReadOnlyNoteBlock
                  title="Medical history"
                  value={patientRecord.medicalHistory || "No medical history recorded."}
                />
                <ReadOnlyNoteBlock
                  title="Family history"
                  value={patientRecord.familyHistory || "No family history recorded."}
                />
                <ReadOnlyNoteBlock
                  title="Doctor notes"
                  value={patientRecord.doctorNotes || "No doctor notes recorded."}
                />
              </div>
            </section>

            <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <SectionHeading
                icon={<FaFileWaveform className="h-4 w-4" />}
                title="Visit context"
                description="Pair the patient snapshot with the current appointment details."
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Appointment date" value={formatDisplayDate(appointment.date)} />
                <ReadOnlyField label="Visit time" value={formatRange(appointment.start, appointment.end)} />
                <div className="sm:col-span-2">
                  <ReadOnlyField
                    label="Doctor"
                    value={getDoctorById(appointment.doctorId)?.name ?? "Assigned doctor"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <ReadOnlyNoteBlock title="Reason for visit" value={formatReason(appointment)} compact />
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function PrescriptionBuilder({
  items,
  instructions,
  followUpDate,
  releaseToPatient,
  feedback,
  createdPrescription,
  disabled,
  patientMatched,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onInstructionsChange,
  onFollowUpDateChange,
  onReleaseChange,
  onSave,
  onDownloadCreated,
  onPrintCreated,
}: {
  items: PrescriptionItemDraft[];
  instructions: string;
  followUpDate: string;
  releaseToPatient: boolean;
  feedback: string | null;
  createdPrescription: CreatedPrescription | null;
  disabled: boolean;
  patientMatched: boolean;
  onItemChange: (index: number, field: keyof PrescriptionItemDraft, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onInstructionsChange: (value: string) => void;
  onFollowUpDateChange: (value: string) => void;
  onReleaseChange: (value: boolean) => void;
  onSave: () => void;
  onDownloadCreated: () => void;
  onPrintCreated: () => void;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          icon={<FaPrescriptionBottleMedical className="h-4 w-4" />}
          title="Prescription"
          description="Build the medicine list first, then add the note, follow-up, and release step."
        />
        <button
          type="button"
          onClick={onAddItem}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaPlus className="h-3 w-3" aria-hidden="true" />
          Add medicine
        </button>
      </div>

      {!patientMatched ? (
        <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          Match this visit to a patient record before saving a prescription.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div key={`consult-rx-${index}`} className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                Rx item {index + 1}
              </p>
              <button
                type="button"
                onClick={() => onRemoveItem(index)}
                disabled={disabled || items.length === 1}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaTrash className="h-3 w-3" aria-hidden="true" />
                Remove
              </button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <InputField
                label="Medicine"
                value={item.medicineName}
                placeholder="Tirzepatide"
                onChange={(value) => onItemChange(index, "medicineName", value)}
              />
              <InputField
                label="Dosage / formulation"
                value={item.dosage}
                placeholder="5 mg/0.6 mL solution for injection #1"
                onChange={(value) => onItemChange(index, "dosage", value)}
              />
              <InputField
                label="Sig / frequency"
                value={item.frequency}
                placeholder="0.6 mL, once a week"
                onChange={(value) => onItemChange(index, "frequency", value)}
              />
              <InputField
                label="Duration / quantity"
                value={item.duration}
                placeholder="Use as instructed"
                onChange={(value) => onItemChange(index, "duration", value)}
              />
            </div>
            <TextAreaField
              label="Item instructions"
              value={item.instructions}
              minHeight="min-h-24"
              placeholder="Additional medicine-specific reminders"
              onChange={(value) => onItemChange(index, "instructions", value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <TextAreaField
          label="Prescription note"
          value={instructions}
          minHeight="min-h-28"
          placeholder="Insulin syringe x 4 mm - 4 pieces"
          onChange={onInstructionsChange}
        />
        <InputField
          label="Follow-up date"
          value={followUpDate}
          placeholder="YYYY-MM-DD"
          onChange={onFollowUpDateChange}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={releaseToPatient}
            onChange={(event) => onReleaseChange(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-400"
          />
          Send to patient portal
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || !patientMatched}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          <FaPrescriptionBottleMedical className="h-4 w-4" aria-hidden="true" />
          {disabled ? "Saving..." : "Create prescription"}
        </button>
      </div>
      {feedback ? <p className="mt-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}
      {createdPrescription ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {createdPrescription.prescriptionNo} is ready.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownloadCreated}
              className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={onPrintCreated}
              className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800"
            >
              Print
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatusControl({
  value,
  onChange,
}: {
  value: ConsultationProgress;
  onChange: (value: ConsultationProgress) => void;
}) {
  const statuses: ConsultationProgress[] = ["Ready", "In Progress", "Completed"];
  return (
    <div className="grid rounded-md border border-neutral-200 bg-white p-1 sm:grid-cols-3">
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={`rounded px-3 py-2 text-sm font-semibold transition ${
            value === status
              ? "bg-neutral-950 text-white shadow-sm"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
          }`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-neutral-950 text-white"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1.5 text-xs font-semibold transition ${
        active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-neutral-950">
        <span className="text-neutral-500">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  minHeight,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  minHeight: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-neutral-800">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100 ${minHeight}`}
        placeholder={placeholder}
      />
    </label>
  );
}

function InputField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-neutral-800">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
        placeholder={placeholder}
      />
    </label>
  );
}

function ReadOnlyNoteBlock({
  title,
  value,
  compact = false,
}: {
  title: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "" : "border-b border-neutral-200 pb-5 last:border-b-0 last:pb-0"}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800">{value}</p>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-neutral-950">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: BadgeTone;
  icon: ReactNode;
}) {
  const styles = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    slate: "bg-neutral-100 text-neutral-700 border-neutral-200",
  } as const;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-neutral-950">{value}</p>
          <p className="mt-1 text-xs text-neutral-500">{hint}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-md border ${styles[tone]}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: BadgeTone;
}) {
  const styles = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-neutral-100 text-neutral-700",
  } as const;

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function QueueFlag({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  const styles = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    slate: "bg-neutral-100 text-neutral-700",
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] ${styles[tone]}`}>
      {label}
    </span>
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
    info: "border-sky-200 bg-sky-50 text-sky-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
  } as const;
  return <div className={`mb-3 rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function EmptyQueue({ message = "No consultations ready yet." }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center">
      <FaNotesMedical className="mx-auto h-6 w-6 text-neutral-400" aria-hidden="true" />
      <p className="mt-3 text-sm text-neutral-500">{message}</p>
    </div>
  );
}

function EmptyWorkspace({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${compact ? "min-h-[22rem]" : "min-h-[42rem]"}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
        <FaFileWaveform className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-black text-neutral-950">Choose a consultation</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-500">
        Select a visit from the queue to open patient record and charting tools.
      </p>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

function statusTone(status: ConsultationProgress | AppointmentRecord["status"]): BadgeTone {
  if (status === "Completed") return "emerald";
  if (status === "In Progress") return "amber";
  if (status === "Pending") return "rose";
  return "sky";
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

function formatAppointmentType(type: AppointmentRecord["type"]) {
  return type === "Online" ? "Virtual" : type;
}

function getMeetingPlatformLabel(link: string) {
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (host.includes("meet.google") || host.includes("google.com")) return "Google Meet";
    if (host.includes("zoom")) return "Zoom";
  } catch {
    // fall through
  }
  return "Video call";
}

function formatReason(appointment: AppointmentRecord) {
  if (!appointment.reason) return "No consultation reason recorded.";

  const secondary = getAppointmentSecondaryReason(appointment.reason);
  return [
    getAppointmentPrimaryLabel(appointment.reason, appointment.type),
    secondary,
  ]
    .filter(Boolean)
    .join(" - ");
}
