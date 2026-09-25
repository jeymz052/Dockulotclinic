"use client";

import Link from "next/link";
import { type ReactNode, Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaAddressBook,
  FaArrowLeft,
  FaArrowUpRightFromSquare,
  FaCalendarDay,
  FaCircleCheck,
  FaCertificate,
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
  FaFlaskVial,
  FaXmark,
  FaEnvelope,
  FaPrint,
  FaDownload,
  FaCommentDots,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useConsultationNotes, usePatients } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  getAppointmentPrimaryLabel,
  getAppointmentSecondaryReason,
  hasAppointmentAddOn,
} from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatRange,
  getDoctorById,
  type AppointmentRecord,
} from "@/src/lib/appointments";
import type { ConsultationNote, ConsultationProgress, PatientRecordItem } from "@/src/lib/clinic";
import { calculatePatientAge } from "@/src/lib/patient-registration";
import {
  type PrescriptionItemDraft,
  createEmptyPrescriptionItem,
} from "@/src/lib/ppd-medicines";
import { PpdPrescriptionBuilder } from "@/src/components/consultations/PpdPrescriptionBuilder";

type DraftState = {
  diagnosis: string;
  subjective: string;
  objective: string;
  note: string;
  prescription: string;
  status: ConsultationProgress;
  visibleToPatient: boolean;
};

type CreatedPrescription = {
  id: string;
  prescriptionNo: string;
};

type CreatedMedicalCertificate = {
  id: string;
  certificateNo: string;
  fileName: string;
};

type CreatedLaboratoryRequest = {
  id: string;
  requestNo: string;
  fileName: string;
};

type CreatedMdReferral = {
  id: string;
  referralNo: string;
  fileName: string;
};

type QueueFilter = "all" | "ready" | "live" | "completed";
type ConsultationTab = "record" | "chart";
type BadgeTone = "sky" | "emerald" | "amber" | "rose" | "slate";

function parseSoapNote(note: string) {
  if (!note) return { subjective: "", objective: "" };

  const subjectiveMatch = note.match(/(?:^|\n)Subjective:\s*([\s\S]*?)(?=(?:\n(?:Objective|Assessment|Plan):)|$)/i);
  const objectiveMatch = note.match(/(?:^|\n)Objective:\s*([\s\S]*?)(?=(?:\n(?:Subjective|Assessment|Plan):)|$)/i);

  if (subjectiveMatch || objectiveMatch) {
    return {
      subjective: subjectiveMatch ? subjectiveMatch[1].trim() : "",
      objective: objectiveMatch ? objectiveMatch[1].trim() : "",
    };
  }

  return {
    subjective: note.trim(),
    objective: "",
  };
}

function formatSoapNote(subjective: string, objective: string): string {
  const parts: string[] = [];
  if (subjective.trim()) {
    parts.push(`Subjective:\n${subjective.trim()}`);
  }
  if (objective.trim()) {
    parts.push(`Objective:\n${objective.trim()}`);
  }
  return parts.join("\n\n");
}

const emptyDraft: DraftState = {
  diagnosis: "",
  subjective: "",
  objective: "",
  note: "",
  prescription: "",
  status: "Ready",
  visibleToPatient: false,
};

const emptyPrescriptionItem: PrescriptionItemDraft = createEmptyPrescriptionItem();

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
  // Per-appointment prescription draft persistence (survives switching patients)
  const prescriptionDraftMap = useRef<Map<string, { items: PrescriptionItemDraft[]; instructions: string; followUpDate: string }>>(new Map());
  const [medicalCertificateFeedback, setMedicalCertificateFeedback] = useState<string | null>(null);
  const [createdMedicalCertificate, setCreatedMedicalCertificate] = useState<CreatedMedicalCertificate | null>(null);
  const [selectedBloodChem, setSelectedBloodChem] = useState<string[]>([]);
  const [selectedHematology, setSelectedHematology] = useState<string[]>([]);
  const [selectedImmuno, setSelectedImmuno] = useState<string[]>([]);
  const [selectedMicroscopy, setSelectedMicroscopy] = useState<string[]>([]);
  const [labUltrasound, setLabUltrasound] = useState("");
  const [labXray, setLabXray] = useState("");
  const [labCtScan, setLabCtScan] = useState("");
  const [labOthers, setLabOthers] = useState("");
  const [releaseLabRequest, setReleaseLabRequest] = useState(true);
  const [labFeedback, setLabFeedback] = useState<string | null>(null);
  const [createdLabRequest, setCreatedLabRequest] = useState<CreatedLaboratoryRequest | null>(null);
  const [referralSpecialty, setReferralSpecialty] = useState("Internal Medicine");
  const [referralDoctorName, setReferralDoctorName] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [releaseReferral, setReleaseReferral] = useState(true);
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null);
  const [createdReferral, setCreatedReferral] = useState<CreatedMdReferral | null>(null);
  const [chartStep, setChartStep] = useState(1);
  const [medCertComplaints, setMedCertComplaints] = useState("");
  const [medCertDiagnosis, setMedCertDiagnosis] = useState("");
  const [medCertRecommendation, setMedCertRecommendation] = useState("");
  const [releaseMedCert, setReleaseMedCert] = useState(true);
  const [isSaving, startTransition] = useTransition();

  const eligibleAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) =>
          ["Confirmed", "In Progress", "Completed"].includes(appointment.status),
        )
        .sort((left, right) => {
          // Newest date/time first so the doctor sees the latest appointments at the top
          const byDateTime = `${right.date} ${right.start}`.localeCompare(
            `${left.date} ${left.start}`,
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
  const activeAppointmentIsVirtual = activeAppointment?.type === "Online";
  const activeAppointmentHasMedicalCertificateAddon = Boolean(
    activeAppointment && hasAppointmentAddOn(activeAppointment.reason, "Medical Certificate"),
  );
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

    const parsedNote = parseSoapNote(existing?.note ?? "");

    // Save current draft before switching appointments
    if (activeAppointmentId && activeAppointmentId !== appointment.id) {
      prescriptionDraftMap.current.set(activeAppointmentId, {
        items: prescriptionItems,
        instructions: prescriptionInstructions,
        followUpDate: prescriptionFollowUpDate,
      });
    }

    // Restore draft for the incoming appointment (if any)
    const savedDraft = prescriptionDraftMap.current.get(appointment.id);

    setActiveAppointmentId(appointment.id);
    setActiveTab(tab);
    setDraft({
      diagnosis: existing?.diagnosis ?? "",
      subjective: parsedNote.subjective,
      objective: parsedNote.objective,
      note: existing?.note ?? "",
      prescription: existing?.prescription ?? "",
      status: inferredStatus,
      visibleToPatient: existing?.visibleToPatient ?? false,
    });
    setPrescriptionItems(savedDraft?.items ?? [{ ...emptyPrescriptionItem }]);
    setPrescriptionInstructions(savedDraft?.instructions ?? existing?.prescription ?? "");
    setPrescriptionFollowUpDate(savedDraft?.followUpDate ?? "");
    setReleasePrescription(true);
    setPrescriptionFeedback(null);
    setCreatedPrescription(null);
    setMedicalCertificateFeedback(null);
    setCreatedMedicalCertificate(null);
    setSelectedBloodChem([]);
    setSelectedHematology([]);
    setSelectedImmuno([]);
    setSelectedMicroscopy([]);
    setLabUltrasound("");
    setLabXray("");
    setLabCtScan("");
    setLabOthers("");
    setReleaseLabRequest(true);
    setLabFeedback(null);
    setCreatedLabRequest(null);
    setChartStep(1);
    setMedCertComplaints(formatReason(appointment));
    setMedCertDiagnosis(existing?.diagnosis ?? "");
    setMedCertRecommendation(existing?.prescription ?? existing?.note ?? "");
    setReleaseMedCert(true);
    setReferralSpecialty("Internal Medicine");
    setReferralDoctorName("");
    setReferralReason("");
    setReleaseReferral(true);
    setReferralFeedback(null);
    setCreatedReferral(null);
    setFeedback(null);
  }

  function saveConsultation(appointment: AppointmentRecord) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const existing = notes.find((note) => note.appointmentId === appointment.id);
      const combinedNote = formatSoapNote(draft.subjective, draft.objective) || draft.note;
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
          note: combinedNote,
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

    if (appointment.type !== "Online") {
      setPrescriptionFeedback("Prescriptions are only available for virtual consultations.");
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
      .filter((item) => (item.genericName?.trim() || item.medicineName?.trim()))
      .map((item) => {
        const generic = (item.genericName || item.medicineName || "").trim();
        const brand = (item.brand || "").trim();
        const medicine_name = brand ? `${generic}\n${brand}` : generic;
        const dosage = (item.strengthForm || item.dosage || "").trim();
        const qty = (item.quantity || item.duration || "").trim();
        const dose = (item.dose || "1 Tablet").trim();
        const freq = (item.frequency || "once a day").trim();
        const dur = (item.duration || "5 days").trim();
        const sigParts: string[] = [];
        if (dose) sigParts.push(dose);
        if (freq) sigParts.push(freq);
        const sigBase = sigParts.join(", ");
        const sig = dur && !sigBase.toLowerCase().includes(dur.toLowerCase())
          ? `${sigBase} for ${dur}`
          : sigBase;

        return {
          medicine_name,
          dosage,
          frequency: sig || item.frequency || "",
          duration: qty,
          instructions: (item.instructions || "").trim() || null,
        };
      });

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
          treatment_plan: formatSoapNote(draft.subjective, draft.objective) || draft.note,
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
      // Clear the saved draft for this appointment now that it's been submitted
      if (activeAppointmentId) prescriptionDraftMap.current.delete(activeAppointmentId);
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

  async function emailCreatedPrescription(prescription: CreatedPrescription) {
    if (!accessToken) {
      setPrescriptionFeedback("Your session expired. Please sign in again.");
      return;
    }
    setPrescriptionFeedback("Emailing prescription to patient...");
    try {
      const res = await fetch("/api/v2/medical-documents/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          documentId: prescription.id,
          kind: "Prescription",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to email prescription.");
      setPrescriptionFeedback(data?.message || "Prescription emailed to patient successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to email prescription.";
      setPrescriptionFeedback(msg);
    }
  }

  function saveMdReferral(appointment: AppointmentRecord) {
    if (!accessToken) {
      setReferralFeedback("Your session expired. Please sign in again.");
      return;
    }

    if (appointment.type !== "Online") {
      setReferralFeedback("MD Referrals are only available for virtual consultations.");
      return;
    }

    if (!activePatientRecord) {
      setReferralFeedback("Match this visit to a patient record before creating an MD referral.");
      return;
    }

    const doctor = doctors.find((item) => item.slug === appointment.doctorId || item.id === appointment.doctorId);
    if (!doctor?.dbId) {
      setReferralFeedback("Doctor profile is still loading. Try again in a moment.");
      return;
    }

    const reason = referralReason.trim();
    if (!reason) {
      setReferralFeedback("Please enter a reason for referral before proceeding.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/v2/md-referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: appointment.id,
          patient_id: activePatientRecord.id,
          doctor_id: doctor.dbId,
          referred_specialty: referralSpecialty.trim() || "Internal Medicine",
          referred_doctor: referralDoctorName.trim() || null,
          reason_for_referral: reason,
          note: (formatSoapNote(draft.subjective, draft.objective) || draft.note).trim() || null,
          released_to_patient: releaseReferral,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        md_referral?: { id?: string; referral_no?: string; file_name?: string };
      };

      if (!response.ok) {
        setReferralFeedback(payload.message ?? "Unable to create MD referral.");
        return;
      }

      setCreatedReferral(
        payload.md_referral?.id && payload.md_referral?.referral_no && payload.md_referral?.file_name
          ? {
              id: payload.md_referral.id,
              referralNo: payload.md_referral.referral_no,
              fileName: payload.md_referral.file_name,
            }
          : null,
      );
      setReferralFeedback(
        payload.md_referral?.referral_no
          ? `MD Referral ${payload.md_referral.referral_no} created.`
          : "MD Referral created.",
      );
    });
  }

  async function fetchMdReferralPdf(referral: CreatedMdReferral) {
    if (!accessToken) {
      setReferralFeedback("Your session expired. Please sign in again.");
      return null;
    }

    const response = await fetch(`/api/v2/md-referrals/${referral.id}/pdf`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setReferralFeedback(payload.message ?? "Unable to fetch MD referral PDF.");
      return null;
    }

    return response.blob();
  }

  async function downloadCreatedMdReferral(referral: CreatedMdReferral) {
    const blob = await fetchMdReferralPdf(referral);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = referral.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
  }

  async function printCreatedMdReferral(referral: CreatedMdReferral) {
    const blob = await fetchMdReferralPdf(referral);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setReferralFeedback("Pop-up blocked. Please allow pop-ups to print the MD referral.");
      window.URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.print();
      setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  async function emailCreatedMdReferral(referral: CreatedMdReferral) {
    if (!accessToken) {
      setReferralFeedback("Your session expired. Please sign in again.");
      return;
    }
    setReferralFeedback("Emailing MD referral to patient...");
    try {
      const res = await fetch("/api/v2/medical-documents/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          documentId: referral.id,
          kind: "MD Referral",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to email MD referral.");
      setReferralFeedback(data?.message || "MD referral emailed to patient successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to email MD referral.";
      setReferralFeedback(msg);
    }
  }

  function saveMedicalCertificate(appointment: AppointmentRecord) {
    if (!accessToken) {
      setMedicalCertificateFeedback("Your session expired. Please sign in again.");
      return;
    }

    if (appointment.type !== "Online") {
      setMedicalCertificateFeedback("Medical certificates are only available for virtual consultations.");
      return;
    }

    if (!activeAppointmentHasMedicalCertificateAddon) {
      setMedicalCertificateFeedback("This virtual consultation does not include the medical certificate add-on.");
      return;
    }

    if (!activePatientRecord) {
      setMedicalCertificateFeedback("Match this visit to a patient record before creating a medical certificate.");
      return;
    }

    const doctor = doctors.find((item) => item.slug === appointment.doctorId || item.id === appointment.doctorId);
    if (!doctor?.dbId) {
      setMedicalCertificateFeedback("Doctor profile is still loading. Try again in a moment.");
      return;
    }

    const complaints = medCertComplaints.trim();
    const diagnosis = medCertDiagnosis.trim();
    const recommendation = medCertRecommendation.trim();
    if (!diagnosis) {
      setMedicalCertificateFeedback("Add a diagnosis before creating the medical certificate.");
      return;
    }
    if (!recommendation) {
      setMedicalCertificateFeedback("Add a recommendation or care plan before creating the medical certificate.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/v2/medical-certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: appointment.id,
          patient_id: activePatientRecord.id,
          doctor_id: doctor.dbId,
          complaints: complaints || formatReason(appointment),
          diagnosis,
          recommendation,
          note: (formatSoapNote(draft.subjective, draft.objective) || draft.note).trim() || null,
          released_to_patient: releaseMedCert,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        medical_certificate?: { id?: string; certificate_no?: string; file_name?: string };
      };

      if (!response.ok) {
        setMedicalCertificateFeedback(payload.message ?? "Unable to create medical certificate.");
        return;
      }

      setCreatedMedicalCertificate(
        payload.medical_certificate?.id && payload.medical_certificate?.certificate_no && payload.medical_certificate?.file_name
          ? {
              id: payload.medical_certificate.id,
              certificateNo: payload.medical_certificate.certificate_no,
              fileName: payload.medical_certificate.file_name,
            }
          : null,
      );
      setMedicalCertificateFeedback(
        payload.medical_certificate?.certificate_no
          ? `Medical certificate ${payload.medical_certificate.certificate_no} created.`
          : "Medical certificate created.",
      );
    });
  }

  async function fetchMedicalCertificatePdf(certificate: CreatedMedicalCertificate) {
    if (!accessToken) {
      setMedicalCertificateFeedback("Your session expired. Please sign in again.");
      return null;
    }

    const response = await fetch(`/api/v2/medical-certificates/${certificate.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setMedicalCertificateFeedback("Unable to open medical certificate PDF.");
      return null;
    }

    return response.blob();
  }

  async function downloadCreatedMedicalCertificate(certificate: CreatedMedicalCertificate) {
    const blob = await fetchMedicalCertificatePdf(certificate);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = certificate.fileName || `${certificate.certificateNo}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function printCreatedMedicalCertificate(certificate: CreatedMedicalCertificate) {
    const blob = await fetchMedicalCertificatePdf(certificate);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setMedicalCertificateFeedback("Pop-up blocked. Please allow pop-ups to print the medical certificate.");
      window.URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.print();
      setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  async function emailCreatedMedicalCertificate(certificate: CreatedMedicalCertificate) {
    if (!accessToken) {
      setMedicalCertificateFeedback("Your session expired. Please sign in again.");
      return;
    }
    setMedicalCertificateFeedback("Emailing medical certificate to patient...");
    try {
      const res = await fetch("/api/v2/medical-documents/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          documentId: certificate.id,
          kind: "Medical Certificate",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to email medical certificate.");
      setMedicalCertificateFeedback(data?.message || "Medical certificate emailed to patient successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to email medical certificate.";
      setMedicalCertificateFeedback(msg);
    }
  }

  function saveLaboratoryRequest(appointment: AppointmentRecord) {
    if (!accessToken) {
      setLabFeedback("Your session expired. Please sign in again.");
      return;
    }

    if (!activePatientRecord) {
      setLabFeedback("Match this visit to a patient record before creating a laboratory request.");
      return;
    }

    const doctor = doctors.find((item) => item.slug === appointment.doctorId || item.id === appointment.doctorId);
    const doctorDbId = doctor?.dbId || undefined;

    const allSelected = [
      ...selectedBloodChem,
      ...selectedHematology,
      ...selectedImmuno,
      ...selectedMicroscopy,
    ];

    if (allSelected.length === 0 && !labUltrasound.trim() && !labXray.trim() && !labCtScan.trim() && !labOthers.trim()) {
      setLabFeedback("Please select at least one test or specify imaging/diagnostics.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/v2/laboratory-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: appointment.id,
          patient_id: activePatientRecord.id,
          doctor_id: doctorDbId,
          blood_chemistry: selectedBloodChem,
          hematology: selectedHematology,
          immuno_serology: selectedImmuno,
          clinical_microscopy: selectedMicroscopy,
          selected_tests: allSelected,
          ultrasound: labUltrasound.trim() || null,
          xray: labXray.trim() || null,
          ct_scan: labCtScan.trim() || null,
          others: labOthers.trim() || null,
          released_to_patient: releaseLabRequest,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        laboratory_request?: { id?: string; request_no?: string; file_name?: string };
      };

      if (!response.ok) {
        setLabFeedback(payload.message ?? "Unable to create laboratory request.");
        return;
      }

      setCreatedLabRequest(
        payload.laboratory_request?.id && payload.laboratory_request?.request_no
          ? {
              id: payload.laboratory_request.id,
              requestNo: payload.laboratory_request.request_no,
              fileName: payload.laboratory_request.file_name ?? `${payload.laboratory_request.request_no}.pdf`,
            }
          : null,
      );
      setLabFeedback(
        payload.laboratory_request?.request_no
          ? `Laboratory request ${payload.laboratory_request.request_no} created.`
          : "Laboratory request created.",
      );
    });
  }

  async function fetchLabRequestPdf(req: CreatedLaboratoryRequest) {
    if (!accessToken) {
      setLabFeedback("Your session expired. Please sign in again.");
      return null;
    }

    const response = await fetch(`/api/v2/laboratory-requests/${req.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setLabFeedback("Unable to open laboratory request PDF.");
      return null;
    }

    return response.blob();
  }

  async function downloadCreatedLabRequest(req: CreatedLaboratoryRequest) {
    const blob = await fetchLabRequestPdf(req);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = req.fileName || `${req.requestNo}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function printCreatedLabRequest(labRequest: CreatedLaboratoryRequest) {
    const blob = await fetchLabRequestPdf(labRequest);
    if (!blob) return;

    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setLabFeedback("Pop-up blocked. Please allow pop-ups to print the laboratory request.");
      window.URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.print();
      setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  async function emailCreatedLaboratoryRequest(labRequest: CreatedLaboratoryRequest) {
    if (!accessToken) {
      setLabFeedback("Your session expired. Please sign in again.");
      return;
    }
    setLabFeedback("Emailing laboratory request to patient...");
    try {
      const res = await fetch("/api/v2/medical-documents/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          documentId: labRequest.id,
          kind: "Laboratory Request",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to email laboratory request.");
      setLabFeedback(data?.message || "Laboratory request emailed to patient successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to email laboratory request.";
      setLabFeedback(msg);
    }
  }

  return (
    <div className="pb-8">
      <div className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Clinical Workspace
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

              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5">
                {activeTab === "record" ? (
                  <PatientRecordSnapshot
                    appointment={activeAppointment}
                    patientRecord={activePatientRecord}
                  />
                ) : null}

                {activeTab === "chart" ? (
                  <div className="mx-auto max-w-3xl space-y-5">

                    {/* ── Step Progress Nav ── */}
                    <ChartStepNav
                      step={chartStep}
                      isVirtual={activeAppointmentIsVirtual}
                      hasMedCertAddon={activeAppointmentHasMedicalCertificateAddon}
                      noteSaved={Boolean(activeNote)}
                      prescriptionCreated={Boolean(createdPrescription)}
                      referralCreated={Boolean(createdReferral)}
                      medCertCreated={Boolean(createdMedicalCertificate)}
                      labCreated={Boolean(createdLabRequest)}
                      onStepClick={setChartStep}
                    />

                    {/* ── Step 1: Assessment & Notes ── */}
                    {chartStep === 1 && (
                      <div className="space-y-5">
                        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                          <SectionHeading
                            icon={<FaStethoscope className="h-4 w-4" />}
                            title="Assessment & Consultation Note"
                            description={activeAppointmentIsVirtual
                              ? "Record the clinical assessment, subjective & objective notes, and plan. Values auto-fill Prescription, MedCert, and Lab Request steps."
                              : "Record the clinical assessment, subjective & objective notes, and plan. For clinic visits, prescriptions and requests are handled in person with physical forms."}
                          />
                          <div className="mt-4 space-y-4">
                            <TextAreaField
                              label="Clinical Assessment"
                              value={draft.diagnosis}
                              minHeight="min-h-24"
                              onChange={(value) => {
                                setDraft((current) => ({ ...current, diagnosis: value }));
                                setMedCertDiagnosis(value);
                              }}
                              placeholder="e.g. Hypertensive urgency, Acute viral pharyngitis, Dysmenorrhea"
                            />

                            <TextAreaField
                              label="Subjective"
                              value={draft.subjective}
                              minHeight="min-h-24"
                              onChange={(value) =>
                                setDraft((current) => ({
                                  ...current,
                                  subjective: value,
                                  note: formatSoapNote(value, current.objective),
                                }))
                              }
                              placeholder="Patient complaints, symptoms, history of present illness..."
                            />

                            <TextAreaField
                              label="Objective"
                              value={draft.objective}
                              minHeight="min-h-24"
                              onChange={(value) =>
                                setDraft((current) => ({
                                  ...current,
                                  objective: value,
                                  note: formatSoapNote(current.subjective, value),
                                }))
                              }
                              placeholder="Vital signs, physical examination findings, diagnostic observations..."
                            />

                            <TextAreaField
                              label="Plan and Recommendation"
                              value={draft.prescription}
                              minHeight="min-h-24"
                              onChange={(value) => {
                                setDraft((current) => ({ ...current, prescription: value }));
                                setMedCertRecommendation(
                                  value || formatSoapNote(draft.subjective, draft.objective) || draft.note,
                                );
                              }}
                              placeholder="Treatment plan, medications, referrals, lifestyle advice, follow-up schedule..."
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
                          </div>
                        </section>

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4">
                          <button
                            type="button"
                            onClick={() => saveConsultation(activeAppointment)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                          >
                            <FaFloppyDisk className="h-4 w-4" aria-hidden="true" />
                            {isSaving ? "Saving..." : "Save note"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartStep(activeAppointmentIsVirtual ? 2 : 6)}
                            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            {activeAppointmentIsVirtual ? "Next: Prescription →" : "Next: Finalize →"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Steps 2–4: Virtual only ── */}
                    {activeAppointmentIsVirtual && chartStep === 2 && (
                      <div className="space-y-5">
                        {activeAppointmentIsVirtual ? (
                          <PpdPrescriptionBuilder
                            items={prescriptionItems}
                            instructions={prescriptionInstructions}
                            followUpDate={prescriptionFollowUpDate}
                            releaseToPatient={releasePrescription}
                            feedback={prescriptionFeedback}
                            createdPrescription={createdPrescription}
                            disabled={isSaving}
                            patientMatched={Boolean(activePatientRecord)}
                            patientRecord={activePatientRecord}
                            appointment={activeAppointment}
                            doctorName={doctors.find((d) => d.slug === activeAppointment.doctorId || d.id === activeAppointment.doctorId)?.name ?? "Dr. Fatimah Al-Zahra T. Ditti"}
                            doctorSpecialty={doctors.find((d) => d.slug === activeAppointment.doctorId || d.id === activeAppointment.doctorId)?.specialty ?? "Family Medicine"}
                            onItemsChange={setPrescriptionItems}
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
                            onDiscard={() => {
                              setPrescriptionItems([createEmptyPrescriptionItem()]);
                              setPrescriptionInstructions("");
                              setPrescriptionFollowUpDate("");
                              setPrescriptionFeedback(null);
                            }}
                            onDownloadCreated={() =>
                              createdPrescription ? void downloadCreatedPrescription(createdPrescription) : undefined
                            }
                            onPrintCreated={() =>
                              createdPrescription ? void printCreatedPrescription(createdPrescription) : undefined
                            }
                            onEmailCreated={() =>
                              createdPrescription ? void emailCreatedPrescription(createdPrescription) : undefined
                            }
                            onProceedNextStep={() => setChartStep(3)}
                          />
                        ) : (
                          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                            <SectionHeading
                              icon={<FaPrescriptionBottleMedical className="h-4 w-4" />}
                              title="Prescription"
                              description="Virtual consultations can generate electronic prescriptions here."
                            />
                            <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-700">
                              Doc Kulot handles clinic-visit prescriptions in person using physical hard copies. No electronic prescription is created for clinic appointments.
                            </div>
                          </section>
                        )}
                        <StepNavButtons onBack={() => setChartStep(1)} onNext={() => setChartStep(3)} nextLabel="Next: MD Referral →" />
                      </div>
                    )}

                    {/* ── Step 3: MD Referral (virtual only) ── */}
                    {activeAppointmentIsVirtual && chartStep === 3 && (
                      <div className="space-y-5">
                        <MDReferralBuilder
                          patientMatched={Boolean(activePatientRecord)}
                          specialty={referralSpecialty}
                          onSpecialtyChange={setReferralSpecialty}
                          doctorName={referralDoctorName}
                          onDoctorNameChange={setReferralDoctorName}
                          reason={referralReason}
                          onReasonChange={setReferralReason}
                          releaseToPatient={releaseReferral}
                          onReleaseChange={setReleaseReferral}
                          feedback={referralFeedback}
                          createdReferral={createdReferral}
                          disabled={isSaving}
                          onBack={() => setChartStep(2)}
                          onDiscard={() => {
                            setReferralSpecialty("Internal Medicine");
                            setReferralDoctorName("");
                            setReferralReason("");
                            setReferralFeedback(null);
                          }}
                          onSave={() => saveMdReferral(activeAppointment)}
                          onDownloadCreated={() =>
                            createdReferral ? void downloadCreatedMdReferral(createdReferral) : undefined
                          }
                          onPrintCreated={() =>
                            createdReferral ? void printCreatedMdReferral(createdReferral) : undefined
                          }
                          onEmailCreated={() =>
                            createdReferral ? void emailCreatedMdReferral(createdReferral) : undefined
                          }
                        />
                        <StepNavButtons onBack={() => setChartStep(2)} onNext={() => setChartStep(4)} nextLabel="Next: Medical Certificate →" />
                      </div>
                    )}

                    {/* ── Step 4: Medical Certificate (virtual only) ── */}
                    {activeAppointmentIsVirtual && chartStep === 4 && (
                      <div className="space-y-5">
                        {activeAppointmentIsVirtual ? (
                          activeAppointmentHasMedicalCertificateAddon ? (
                            <MedicalCertificateBuilder
                              patientMatched={Boolean(activePatientRecord)}
                              complaints={medCertComplaints}
                              onComplaintsChange={setMedCertComplaints}
                              diagnosis={medCertDiagnosis}
                              onDiagnosisChange={setMedCertDiagnosis}
                              recommendation={medCertRecommendation}
                              onRecommendationChange={setMedCertRecommendation}
                              releaseToPatient={releaseMedCert}
                              onReleaseChange={setReleaseMedCert}
                              feedback={medicalCertificateFeedback}
                              createdCertificate={createdMedicalCertificate}
                              disabled={isSaving}
                              onSave={() => saveMedicalCertificate(activeAppointment)}
                              onDownloadCreated={() =>
                                createdMedicalCertificate ? void downloadCreatedMedicalCertificate(createdMedicalCertificate) : undefined
                              }
                              onPrintCreated={() =>
                                createdMedicalCertificate ? void printCreatedMedicalCertificate(createdMedicalCertificate) : undefined
                              }
                              onEmailCreated={() =>
                                createdMedicalCertificate ? void emailCreatedMedicalCertificate(createdMedicalCertificate) : undefined
                              }
                            />
                          ) : (
                            <section className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-5 shadow-sm">
                              <div className="flex items-start gap-3">
                                <FaCertificate className="mt-0.5 h-4 w-4 text-amber-700" />
                                <div>
                                  <p className="text-sm font-bold text-amber-900">Medical certificate add-on not selected</p>
                                  <p className="mt-1 text-sm leading-6 text-amber-800">
                                    This virtual consult does not include the medical certificate add-on. The certificate builder is only available when the patient selects it during booking.
                                  </p>
                                </div>
                              </div>
                            </section>
                          )
                        ) : (
                          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                            <SectionHeading
                              icon={<FaCertificate className="h-4 w-4" />}
                              title="Medical Certificate"
                              description="Virtual consultations with the add-on can generate digital certificates here."
                            />
                            <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-700">
                              Doc Kulot uses physical hard-copy medical certificates for clinic visits. Digital certificates are only issued for virtual consultations with the add-on.
                            </div>
                          </section>
                        )}
                        <StepNavButtons onBack={() => setChartStep(3)} onNext={() => setChartStep(5)} nextLabel="Next: Lab Request →" />
                      </div>
                    )}

                    {/* ── Step 5: Lab / Diagnostics Request (virtual only) ── */}
                    {activeAppointmentIsVirtual && chartStep === 5 && (
                      <div className="space-y-5">
                        {activeAppointmentIsVirtual ? (
                          <LaboratoryRequestBuilder
                            patientMatched={Boolean(activePatientRecord)}
                            selectedBloodChem={selectedBloodChem}
                            selectedHematology={selectedHematology}
                            selectedImmuno={selectedImmuno}
                            selectedMicroscopy={selectedMicroscopy}
                            ultrasound={labUltrasound}
                            xray={labXray}
                            ctScan={labCtScan}
                            others={labOthers}
                            releaseToPatient={releaseLabRequest}
                            feedback={labFeedback}
                            createdLabRequest={createdLabRequest}
                            disabled={isSaving}
                            onToggleBloodChem={(item) =>
                              setSelectedBloodChem((curr) =>
                                curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item],
                              )
                            }
                            onToggleHematology={(item) =>
                              setSelectedHematology((curr) =>
                                curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item],
                              )
                            }
                            onToggleImmuno={(item) =>
                              setSelectedImmuno((curr) =>
                                curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item],
                              )
                            }
                            onToggleMicroscopy={(item) =>
                              setSelectedMicroscopy((curr) =>
                                curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item],
                              )
                            }
                            onSetUltrasound={(val) => { setLabUltrasound(val); setLabFeedback(null); }}
                            onSetXray={(val) => { setLabXray(val); setLabFeedback(null); }}
                            onSetCtScan={(val) => { setLabCtScan(val); setLabFeedback(null); }}
                            onSetOthers={(val) => { setLabOthers(val); setLabFeedback(null); }}
                            onReleaseChange={(val) => { setReleaseLabRequest(val); setLabFeedback(null); }}
                            onApplyPreset={(preset) => {
                              if (preset === "routine") {
                                setSelectedBloodChem((c) => Array.from(new Set([...c, "Fasting Blood Sugar", "Lipid Profile", "Blood Uric Acid", "Creatinine"])));
                                setSelectedHematology((c) => Array.from(new Set([...c, "Complete Blood Count"])));
                                setSelectedMicroscopy((c) => Array.from(new Set([...c, "Urinalysis"])));
                              } else if (preset === "liver_renal") {
                                setSelectedBloodChem((c) => Array.from(new Set([...c, "SGOT (AST)", "SGPT (ALT)", "BUN", "Creatinine", "Electrolytes", "Total protein"])));
                              } else if (preset === "fever_infection") {
                                setSelectedHematology((c) => Array.from(new Set([...c, "Complete Blood Count"])));
                                setSelectedMicroscopy((c) => Array.from(new Set([...c, "Urinalysis"])));
                                setSelectedImmuno((c) => Array.from(new Set([...c, "Typhoid", "Dengue"])));
                              } else if (preset === "clear") {
                                setSelectedBloodChem([]);
                                setSelectedHematology([]);
                                setSelectedImmuno([]);
                                setSelectedMicroscopy([]);
                                setLabUltrasound("");
                                setLabXray("");
                                setLabCtScan("");
                                setLabOthers("");
                              }
                              setLabFeedback(null);
                            }}
                            onSave={() => saveLaboratoryRequest(activeAppointment)}
                            onDownloadCreated={() =>
                              createdLabRequest ? void downloadCreatedLabRequest(createdLabRequest) : undefined
                            }
                            onPrintCreated={() =>
                              createdLabRequest ? void printCreatedLabRequest(createdLabRequest) : undefined
                            }
                            onEmailCreated={() =>
                              createdLabRequest ? void emailCreatedLaboratoryRequest(createdLabRequest) : undefined
                            }
                          />
                        ) : (
                          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                            <SectionHeading
                              icon={<FaFlaskVial className="h-4 w-4" />}
                              title="Laboratory / Diagnostics Request"
                              description="Virtual consultations can generate digital laboratory requests here."
                            />
                            <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-700">
                              Doc Kulot uses physical hard-copy laboratory request forms for clinic visits. The digital lab request builder is only available for virtual consultations.
                            </div>
                          </section>
                        )}
                        <StepNavButtons onBack={() => setChartStep(4)} onNext={() => setChartStep(6)} nextLabel="Next: Finalize →" />
                      </div>
                    )}

                    {/* ── Step 6: Save & Finalize ── */}
                    {chartStep === 6 && (
                      <div className="space-y-5">
                        {/* Session summary */}
                        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                          <SectionHeading
                            icon={<FaCircleCheck className="h-4 w-4" />}
                            title="Session summary"
                            description="Review what was completed during this consultation before closing out."
                          />
                          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                            {activeAppointmentIsVirtual ? (
                              <>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Prescription</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {createdPrescription ? `✓ ${createdPrescription.prescriptionNo}` : "Not created"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">MD Referral</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {createdReferral ? `✓ ${createdReferral.referralNo}` : "Not created"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Medical Certificate</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {createdMedicalCertificate
                                      ? `✓ ${createdMedicalCertificate.certificateNo}`
                                      : activeAppointmentHasMedicalCertificateAddon
                                        ? "Not created"
                                        : "No add-on selected"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Lab Request</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {createdLabRequest ? `✓ ${createdLabRequest.requestNo}` : "Not created"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 sm:col-span-2">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Assessment & Notes</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {activeNote ? `✓ ${draft.diagnosis ? draft.diagnosis.slice(0, 35) + (draft.diagnosis.length > 35 ? "..." : "") : "Saved"}` : "Pending save"}
                                  </dd>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Clinical Assessment</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {draft.diagnosis ? `✓ ${draft.diagnosis.slice(0, 40)}${draft.diagnosis.length > 40 ? "..." : ""}` : "No assessment recorded"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Subjective & Objective Notes</dt>
                                  <dd className="mt-1 text-sm font-semibold text-neutral-900">
                                    {draft.subjective || draft.objective || draft.note || draft.prescription ? "✓ Documented" : "No notes recorded"}
                                  </dd>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 sm:col-span-2">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Physical Hard Copies (Clinic Visit)</dt>
                                  <dd className="mt-1 text-xs leading-5 text-neutral-600">
                                    Prescriptions, lab request forms, and medical certificates are issued in person using physical clinic stationery.
                                  </dd>
                                </div>
                              </>
                            )}
                          </dl>
                        </section>

                        {/* Chart status */}
                        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                          <SectionHeading
                            icon={<FaFileWaveform className="h-4 w-4" />}
                            title="Chart status"
                            description="Set this last — after the assessment, note, and documents are ready."
                          />
                          <div className="mt-5">
                            <StatusControl
                              value={draft.status}
                              onChange={(status) => setDraft((current) => ({ ...current, status }))}
                            />
                            {activeNote?.updatedAt ? (
                              <p className="mt-3 text-xs text-neutral-500">
                                Last saved {new Date(activeNote.updatedAt).toLocaleString("en-US")}
                              </p>
                            ) : null}
                          </div>
                        </section>

                        {/* Final save */}
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setChartStep(activeAppointmentIsVirtual ? 5 : 1)}
                            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            onClick={() => saveConsultation(activeAppointment)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                          >
                            <FaFloppyDisk className="h-4 w-4" aria-hidden="true" />
                            {isSaving ? "Saving..." : "Save & finalize chart"}
                          </button>
                        </div>

                        {/* Virtual Consultation Messenger Shortcut */}
                        {activeAppointmentIsVirtual && (
                          <section className="rounded-xl border border-neutral-900 bg-neutral-950 p-5 text-white shadow-md">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-200">
                                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                  Virtual Consultation Follow-up
                                </div>
                                <h4 className="text-base font-bold text-white">
                                  Message {activeAppointment.patientName} on Doc Kulot Messenger
                                </h4>
                                <p className="text-xs text-neutral-300">
                                  Link this visit&apos;s details (assessment, prescription, and reason) directly to the chat thread for Doc Kulot&apos;s instant reference.
                                </p>
                              </div>
                              <Link
                                href={`/messages?appointmentId=${encodeURIComponent(activeAppointment.id)}&patientEmail=${encodeURIComponent(activeAppointment.email || "")}`}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-neutral-950 shadow-sm transition hover:bg-neutral-100 active:scale-95"
                              >
                                <FaCommentDots className="h-4 w-4" />
                                <span>Message Patient →</span>
                              </Link>
                            </div>
                          </section>
                        )}
                      </div>
                    )}

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
            Patient Portal
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
            {appointment.type === "Online" && (
              <Link
                href={`/messages?appointmentId=${encodeURIComponent(appointment.id)}&patientEmail=${encodeURIComponent(appointment.email || "")}`}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                <FaCommentDots className="h-4 w-4" aria-hidden="true" />
                Message Patient
              </Link>
            )}
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

const PHILIPPINE_MEDICAL_SPECIALTIES = [
  "Internal Medicine",
  "Cardiology",
  "Pulmonology",
  "Gastroenterology",
  "Endocrinology & Diabetology",
  "Nephrology",
  "Neurology",
  "General Surgery",
  "Orthopedic Surgery",
  "Obstetrics & Gynecology (OB-GYN)",
  "Pediatrics",
  "Pediatric Cardiology",
  "Dermatology",
  "Ophthalmology",
  "Otorhinolaryngology (ENT)",
  "Psychiatry",
  "Urology",
  "Oncology",
  "Rheumatology",
  "Physical Medicine & Rehabilitation",
  "Infectious Diseases",
  "Family Medicine",
  "Allergy & Immunology",
  "Plastic & Reconstructive Surgery",
];

function MDReferralBuilder({
  patientMatched,
  specialty,
  onSpecialtyChange,
  doctorName,
  onDoctorNameChange,
  reason,
  onReasonChange,
  releaseToPatient,
  onReleaseChange,
  feedback,
  createdReferral,
  disabled,
  onDiscard,
  onSave,
  onDownloadCreated,
  onPrintCreated,
  onEmailCreated,
}: {
  patientMatched: boolean;
  specialty: string;
  onSpecialtyChange: (v: string) => void;
  doctorName: string;
  onDoctorNameChange: (v: string) => void;
  reason: string;
  onReasonChange: (v: string) => void;
  releaseToPatient: boolean;
  onReleaseChange: (v: boolean) => void;
  feedback: string | null;
  createdReferral: CreatedMdReferral | null;
  disabled: boolean;
  onBack?: () => void;
  onDiscard?: () => void;
  onSave: () => void;
  onDownloadCreated: () => void;
  onPrintCreated: () => void;
  onEmailCreated?: () => void;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          icon={<FaUserDoctor className="h-4 w-4" />}
          title="MD Referral"
          description="Specify the specialist doctor and clinical reason for referral, then generate the referral document."
        />
        {onDiscard ? (
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-rose-600"
          >
            <FaTrash className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>

      {!patientMatched ? (
        <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          Match this visit to a patient record before creating an MD referral.
        </div>
      ) : null}

      <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50/50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          Referral Details
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-neutral-800">
              Specialty / Department
              <div className="relative mt-2">
                <select
                  value={specialty}
                  onChange={(e) => onSpecialtyChange(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
                >
                  {PHILIPPINE_MEDICAL_SPECIALTIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  {!PHILIPPINE_MEDICAL_SPECIALTIES.includes(specialty) && specialty ? (
                    <option value={specialty}>{specialty}</option>
                  ) : null}
                </select>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-800">
              Referred Doctor Name (Optional)
              <input
                type="text"
                value={doctorName}
                onChange={(e) => onDoctorNameChange(e.target.value)}
                placeholder="e.g. Dr. Maria Santos"
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-neutral-800">
            Reason for Referral / Note to Doctor
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="State the clinical reason for referring the patient, symptoms, or clinical background..."
              rows={4}
              className="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={releaseToPatient}
            onChange={(e) => onReleaseChange(e.target.checked)}
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
          <FaUserDoctor className="h-4 w-4" aria-hidden="true" />
          {disabled ? "Saving..." : "Create MD Referral"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}

      {createdReferral ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {createdReferral.referralNo} is ready.
          </p>
          <div className="flex flex-wrap gap-2">
            {onEmailCreated ? (
              <button
                type="button"
                onClick={onEmailCreated}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-100/70 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-200"
              >
                <FaEnvelope className="h-3 w-3" />
                Email to Patient
              </button>
            ) : null}
            <button
              type="button"
              onClick={onPrintCreated}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-100"
            >
              <FaPrint className="h-3 w-3" />
              Print
            </button>
            <button
              type="button"
              onClick={onDownloadCreated}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-100"
            >
              <FaDownload className="h-3 w-3" />
              Download PDF
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MedicalCertificateBuilder({
  patientMatched,
  complaints,
  onComplaintsChange,
  diagnosis,
  onDiagnosisChange,
  recommendation,
  onRecommendationChange,
  releaseToPatient,
  onReleaseChange,
  feedback,
  createdCertificate,
  disabled,
  onSave,
  onDownloadCreated,
  onPrintCreated,
  onEmailCreated,
}: {
  patientMatched: boolean;
  complaints: string;
  onComplaintsChange: (v: string) => void;
  diagnosis: string;
  onDiagnosisChange: (v: string) => void;
  recommendation: string;
  onRecommendationChange: (v: string) => void;
  releaseToPatient: boolean;
  onReleaseChange: (v: boolean) => void;
  feedback: string | null;
  createdCertificate: CreatedMedicalCertificate | null;
  disabled: boolean;
  onSave: () => void;
  onDownloadCreated: () => void;
  onPrintCreated: () => void;
  onEmailCreated?: () => void;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <SectionHeading
        icon={<FaCertificate className="h-4 w-4" />}
        title="Medical Certificate"
        description="Review and edit the fields below before creating the certificate. All values are pre-filled from this consultation's chart."
      />

      {!patientMatched ? (
        <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          Match this visit to a patient record before saving a medical certificate.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <TextAreaField
          label="Chief Complaints (from appointment reason — editable)"
          value={complaints}
          minHeight="min-h-20"
          placeholder="Reason for consultation, chief complaints, presenting symptoms"
          onChange={onComplaintsChange}
        />
        <TextAreaField
          label="Diagnosis (from Assessment — editable)"
          value={diagnosis}
          minHeight="min-h-24"
          placeholder="Clinical diagnosis or impression from Step 1"
          onChange={onDiagnosisChange}
        />
        <TextAreaField
          label="Recommendation / Care Plan (from Consultation Notes — editable)"
          value={recommendation}
          minHeight="min-h-28"
          placeholder="Treatment plan, referrals, rest advice, follow-up schedule"
          onChange={onRecommendationChange}
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
          <FaCertificate className="h-4 w-4" aria-hidden="true" />
          {disabled ? "Saving..." : "Create Medical Certificate"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}
      {createdCertificate ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {createdCertificate.certificateNo} is ready.
          </p>
          <div className="flex flex-wrap gap-2">
            {onEmailCreated ? (
              <button
                type="button"
                onClick={onEmailCreated}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-100/70 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-200"
              >
                <FaEnvelope className="h-3 w-3" />
                Email to Patient
              </button>
            ) : null}
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

function ChartStepNav({
  step,
  isVirtual,
  hasMedCertAddon,
  noteSaved,
  prescriptionCreated,
  referralCreated,
  medCertCreated,
  labCreated,
  onStepClick,
}: {
  step: number;
  isVirtual: boolean;
  hasMedCertAddon: boolean;
  noteSaved: boolean;
  prescriptionCreated: boolean;
  referralCreated: boolean;
  medCertCreated: boolean;
  labCreated: boolean;
  onStepClick: (s: number) => void;
}) {
  const steps = isVirtual
    ? [
        { displayNum: 1, targetStep: 1, label: "Assessment", done: noteSaved },
        { displayNum: 2, targetStep: 2, label: "Prescription", done: prescriptionCreated },
        { displayNum: 3, targetStep: 3, label: "MD Referral", done: referralCreated },
        { displayNum: 4, targetStep: 4, label: "Med Cert", done: medCertCreated, addon: hasMedCertAddon },
        { displayNum: 5, targetStep: 5, label: "Lab Request", done: labCreated },
        { displayNum: 6, targetStep: 6, label: "Finalize", done: false },
      ]
    : [
        { displayNum: 1, targetStep: 1, label: "Assessment & Notes", done: noteSaved },
        { displayNum: 2, targetStep: 6, label: "Finalize & Save", done: false },
      ];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-1 overflow-x-auto">
        {steps.map((s, index) => {
          const isActive = step === s.targetStep;
          const isDone = s.done;
          return (
            <Fragment key={s.targetStep}>
              <button
                type="button"
                onClick={() => onStepClick(s.targetStep)}
                className={`flex shrink-0 flex-col items-center gap-1.5 rounded-lg px-4 py-2 text-center transition ${
                  isActive
                    ? "bg-neutral-950 text-white"
                    : isDone
                      ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                    isActive
                      ? "bg-white text-neutral-950"
                      : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {isDone ? "✓" : s.displayNum}
                </span>
                <span className="text-[11px] font-semibold leading-tight">
                  {s.label}
                  {s.addon === false ? (
                    <span className="ml-1 text-[10px] text-amber-600">(no add-on)</span>
                  ) : null}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div key={`divider-${s.targetStep}`} className="h-px flex-1 bg-neutral-200" />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StepNavButtons({
  onBack,
  onNext,
  nextLabel = "Next →",
}: {
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
      >
        ← Back
      </button>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}

const BLOOD_CHEM_OPTIONS = [
  "Lipid Profile",
  "Fasting Blood Sugar",
  "Blood Uric Acid",
  "SGOT (AST)",
  "SGPT (ALT)",
  "BUN",
  "Creatinine",
  "Electrolytes",
  "Total protein",
  "B1, B2",
  "HbA1c",
];

const HEMATOLOGY_OPTIONS = [
  "Complete Blood Count",
  "Blood Typing",
  "Clotting/Bleeding Time",
  "Protime",
  "APTT",
];

const IMMUNO_OPTIONS = [
  "HBsAg",
  "Hepatitis C Virus",
  "Hepatitis A Virus",
  "HIV",
  "Syphilis Test",
  "Typhoid",
  "Dengue",
  "H.Pylori",
];

const MICROSCOPY_OPTIONS = [
  "Urinalysis",
  "Fecalysis",
  "Pregnancy Test",
  "Fecal Occult Blood",
];

const ULTRASOUND_PREFILLS = [
  "Whole Abdomen",
  "Upper Abdomen",
  "KUB",
  "Pelvic",
  "OB",
  "Thyroid",
  "Breast",
  "Soft tissue",
];

const XRAY_PREFILLS = [
  "PA view",
  "AP view",
  "Lateral view",
  "Chest PA",
  "KUB",
  "Skull AP/Lat",
  "Lumbosacral",
  "Cervical",
  "Both hands",
];

function LabCheckGroup({
  title,
  options,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  disabled: boolean;
  onToggle: (item: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              disabled={disabled}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-400"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function ImagingField({
  label,
  value,
  prefills,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  prefills: string[];
  disabled: boolean;
  onChange: (val: string) => void;
}) {
  function appendPrefill(chip: string) {
    const current = value.trim();
    if (!current) {
      onChange(chip);
    } else if (!current.toLowerCase().includes(chip.toLowerCase())) {
      onChange(`${current}, ${chip}`);
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-800">
        {label}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`e.g. ${prefills[0]}`}
          className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {prefills.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled}
            onClick={() => appendPrefill(chip)}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function LaboratoryRequestBuilder({
  patientMatched,
  selectedBloodChem,
  selectedHematology,
  selectedImmuno,
  selectedMicroscopy,
  ultrasound,
  xray,
  ctScan,
  others,
  releaseToPatient,
  feedback,
  createdLabRequest,
  disabled,
  onToggleBloodChem,
  onToggleHematology,
  onToggleImmuno,
  onToggleMicroscopy,
  onSetUltrasound,
  onSetXray,
  onSetCtScan,
  onSetOthers,
  onReleaseChange,
  onApplyPreset,
  onSave,
  onDownloadCreated,
  onPrintCreated,
  onEmailCreated,
}: {
  patientMatched: boolean;
  selectedBloodChem: string[];
  selectedHematology: string[];
  selectedImmuno: string[];
  selectedMicroscopy: string[];
  ultrasound: string;
  xray: string;
  ctScan: string;
  others: string;
  releaseToPatient: boolean;
  feedback: string | null;
  createdLabRequest: CreatedLaboratoryRequest | null;
  disabled: boolean;
  onToggleBloodChem: (item: string) => void;
  onToggleHematology: (item: string) => void;
  onToggleImmuno: (item: string) => void;
  onToggleMicroscopy: (item: string) => void;
  onSetUltrasound: (val: string) => void;
  onSetXray: (val: string) => void;
  onSetCtScan: (val: string) => void;
  onSetOthers: (val: string) => void;
  onReleaseChange: (val: boolean) => void;
  onApplyPreset: (preset: "routine" | "liver_renal" | "fever_infection" | "clear") => void;
  onSave: () => void;
  onDownloadCreated: () => void;
  onPrintCreated: () => void;
  onEmailCreated?: () => void;
}) {
  const totalSelected =
    selectedBloodChem.length +
    selectedHematology.length +
    selectedImmuno.length +
    selectedMicroscopy.length;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          icon={<FaFlaskVial className="h-4 w-4" />}
          title="Laboratory / Diagnostics Request"
          description="Select tests from each category, then specify imaging and any other diagnostics below."
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onApplyPreset("routine")}
            disabled={disabled}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Routine
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset("liver_renal")}
            disabled={disabled}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Liver / Renal
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset("fever_infection")}
            disabled={disabled}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Fever / Infection
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset("clear")}
            disabled={disabled}
            className="rounded-md border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      </div>

      {!patientMatched ? (
        <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          Match this visit to a patient record before saving a laboratory request.
        </div>
      ) : null}

      {totalSelected > 0 ? (
        <div className="mt-4 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
          {totalSelected} test{totalSelected !== 1 ? "s" : ""} selected
        </div>
      ) : null}

      {/* Lab test checkboxes — 4 categories in a 2×2 grid */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <LabCheckGroup
          title="Blood Chemistry"
          options={BLOOD_CHEM_OPTIONS}
          selected={selectedBloodChem}
          disabled={disabled}
          onToggle={onToggleBloodChem}
        />
        <LabCheckGroup
          title="Hematology"
          options={HEMATOLOGY_OPTIONS}
          selected={selectedHematology}
          disabled={disabled}
          onToggle={onToggleHematology}
        />
        <LabCheckGroup
          title="Immuno / Serology"
          options={IMMUNO_OPTIONS}
          selected={selectedImmuno}
          disabled={disabled}
          onToggle={onToggleImmuno}
        />
        <LabCheckGroup
          title="Clinical Microscopy"
          options={MICROSCOPY_OPTIONS}
          selected={selectedMicroscopy}
          disabled={disabled}
          onToggle={onToggleMicroscopy}
        />
      </div>

      {/* Imaging & diagnostics */}
      <div className="mt-6 border-t border-neutral-100 pt-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          Imaging &amp; Diagnostics
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <ImagingField
            label="Ultrasound"
            value={ultrasound}
            prefills={ULTRASOUND_PREFILLS}
            disabled={disabled}
            onChange={onSetUltrasound}
          />
          <ImagingField
            label="X-Ray"
            value={xray}
            prefills={XRAY_PREFILLS}
            disabled={disabled}
            onChange={onSetXray}
          />
          <div>
            <label className="block text-sm font-semibold text-neutral-800">
              CT Scan
              <input
                value={ctScan}
                onChange={(e) => onSetCtScan(e.target.value)}
                disabled={disabled}
                placeholder="e.g. CT Scan Brain Plain"
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-800">
              Others
              <input
                value={others}
                onChange={(e) => onSetOthers(e.target.value)}
                disabled={disabled}
                placeholder="e.g. ECG, 2D Echo, Spirometry"
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-50"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Release & save row */}
      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={releaseToPatient}
            onChange={(e) => onReleaseChange(e.target.checked)}
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
          <FaFlaskVial className="h-4 w-4" aria-hidden="true" />
          {disabled ? "Saving..." : "Create lab request"}
        </button>
      </div>

      {feedback ? <p className="mt-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}
      {createdLabRequest ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-emerald-900">
            {createdLabRequest.requestNo} is ready.
          </p>
          <div className="flex flex-wrap gap-2">
            {onEmailCreated ? (
              <button
                type="button"
                onClick={onEmailCreated}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-100/70 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-200"
              >
                <FaEnvelope className="h-3 w-3" />
                Email to Patient
              </button>
            ) : null}
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

function normalizePatientName(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function normalizePatientEmail(value?: string | null) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function normalizePatientPhone(value?: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) {
    return "0" + digits.slice(2);
  }
  return digits;
}

function findPatientRecord(patients: PatientRecordItem[], appointment: AppointmentRecord) {
  const apptEmail = normalizePatientEmail(appointment.email);
  const apptName = normalizePatientName(appointment.patientName);
  const apptPhone = normalizePatientPhone(appointment.phone);

  // 1. Match by Email if provided
  if (apptEmail) {
    const byEmail = patients.find((patient) => normalizePatientEmail(patient.email) === apptEmail);
    if (byEmail) return byEmail;
  }

  // 2. Match by Full Name (case-insensitive, whitespace & dot normalized)
  if (apptName) {
    if (apptPhone) {
      const byNameAndPhone = patients.find(
        (patient) =>
          normalizePatientName(patient.fullName) === apptName &&
          normalizePatientPhone(patient.phone) === apptPhone,
      );
      if (byNameAndPhone) return byNameAndPhone;
    }

    const byName = patients.find(
      (patient) => normalizePatientName(patient.fullName) === apptName,
    );
    if (byName) return byName;
  }

  // 3. Fallback match by Phone number if non-empty
  if (apptPhone) {
    const byPhone = patients.find(
      (patient) => normalizePatientPhone(patient.phone) === apptPhone,
    );
    if (byPhone) return byPhone;
  }

  return null;
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
