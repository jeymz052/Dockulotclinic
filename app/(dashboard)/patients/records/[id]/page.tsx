"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaCalendarDays, FaCheck, FaClockRotateLeft, FaFloppyDisk, FaNotesMedical } from "react-icons/fa6";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import { calculatePatientAge, formatPatientFullName } from "@/src/lib/patient-registration";
import { resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  MedicalDocumentsBrowser,
  type MedicalDocumentItem,
} from "@/src/components/medical-documents/MedicalDocumentsBrowser";

type Data = { patients: PatientRecordItem[]; visits: PatientVisitRecord[]; message?: string };
type Consent = {
  id: string;
  appointment_id: string | null;
  procedure_name: string;
  patient_name: string;
  patient_signature: string;
  witness_name: string | null;
  witness_signature: string | null;
  witness_signed_at: string | null;
  physician_name: string | null;
  physician_signature: string | null;
  physician_signed_at: string | null;
  consent_form_url: string;
  consent_snapshot: Record<string, unknown>;
  aftercare_acknowledged: boolean;
  aftercare_guide_title: string | null;
  aftercare_image_url: string | null;
  signed_at: string;
};
type PatientFile = {
  id: string;
  patient_id?: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  document_metadata?: {
    certificate_no?: string;
    complaints?: string;
    diagnosis?: string;
    recommendation?: string;
    note?: string | null;
    doctor_id?: string | null;
    doctor_name?: string | null;
    doctor_specialty?: string | null;
    doctor_license_no?: string | null;
    patient_name?: string | null;
    patient_dob?: string | null;
    patient_gender?: string | null;
  } | null;
  created_at: string;
};
type PrescriptionItem = {
  id?: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  sort_order?: number | null;
};
type Prescription = {
  id: string;
  prescription_no: string;
  patient_id: string;
  doctor_id: string;
  general_instructions: string | null;
  follow_up_date: string | null;
  released_to_patient: boolean;
  created_at: string;
  prescription_items?: PrescriptionItem[];
  diagnoses?: { diagnosis_text: string; treatment_plan: string | null; follow_up_date: string | null } | null;
  doctors?: { specialty?: string | null; license_no?: string | null; profiles?: { full_name?: string | null } | null } | null;
  doctor_signature_data_url?: string | null;
  patients?: {
    dob?: string | null;
    gender?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  } | null;
};
type Tab = "Personal" | "Contact" | "Other" | "Medical Records";
type Notice = { tone: "success" | "error"; text: string };

const TABS: Tab[] = ["Personal", "Contact", "Other", "Medical Records"];
const fieldClass = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200";

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US");
}

function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isPdfUrl(value: string) {
  return /^data:application\/pdf/i.test(value) || /\.pdf(\?|#|$)/i.test(value);
}

function isImageUrl(value: string) {
  return /^data:image\//i.test(value) || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(value);
}

const FALLBACK_CONSENT_POINTS = [
  "The procedure, purpose, expected benefits, possible risks, side effects, complications, and possible alternatives were explained in a language I understand.",
  "I understand that results vary and that no exact result, cosmetic outcome, or medical response can be guaranteed.",
  "I understand that no medical or aesthetic procedure is completely risk-free, even when proper care is provided.",
  "I had the opportunity to ask questions and confirm that my questions were answered before signing.",
  "I voluntarily authorize Doc Kulot, Family Medicine Specialist and Aesthetic Medicine, to perform the selected procedure.",
];

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useRole();
  const [patient, setPatient] = useState<PatientRecordItem | null>(null);
  const [draft, setDraft] = useState<PatientRecordItem | null>(null);
  const [visits, setVisits] = useState<PatientVisitRecord[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [tab, setTab] = useState<Tab>("Personal");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (authLoading || !accessToken || !id) return;
    let active = true;

    async function load() {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [recordsResponse, consentResponse, filesResponse, prescriptionsResponse] = await Promise.all([
          fetch("/api/patient-records", { cache: "no-store", headers }),
          fetch(`/api/v2/procedure-consents?patient_id=${encodeURIComponent(id)}`, { cache: "no-store", headers }),
          fetch(`/api/v2/patient-files?patient_id=${encodeURIComponent(id)}`, { cache: "no-store", headers }),
          fetch(`/api/v2/prescriptions?patient_id=${encodeURIComponent(id)}`, { cache: "no-store", headers }),
        ]);

        const records = (await recordsResponse.json().catch(() => null)) as Data | null;
        if (!recordsResponse.ok || !records) throw new Error(records?.message ?? "Unable to load patient profile.");
        const found = records.patients.find((item) => item.id === id);
        if (!found) throw new Error("Patient record was not found.");

        const consentData = (await consentResponse.json().catch(() => null)) as { consents?: Consent[] } | null;
        const fileData = (await filesResponse.json().catch(() => null)) as { files?: PatientFile[] } | null;
        const prescriptionData = (await prescriptionsResponse.json().catch(() => null)) as { prescriptions?: Prescription[] } | null;

        if (!active) return;
        setPatient(found);
        setDraft(found);
        setVisits(records.visits.filter((visit) => visit.patientId === id));
        setConsents(consentResponse.ok ? consentData?.consents ?? [] : []);
        setFiles(filesResponse.ok ? fileData?.files ?? [] : []);
        setPrescriptions(
          prescriptionsResponse.ok
            ? (prescriptionData?.prescriptions ?? []).map((item) => ({
              ...item,
              prescription_items: [...(item.prescription_items ?? [])].sort(
                (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
              ),
            }))
            : [],
        );
      } catch (error) {
        if (active) {
          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load patient profile." });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const history = useMemo(
    () => [...visits].sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)),
    [visits],
  );
  const age = calculatePatientAge(patient?.dateOfBirth ?? "");

  function update<K extends keyof PatientRecordItem>(field: K, value: PatientRecordItem[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function save() {
    if (!accessToken || !draft) return;
    const updated = { ...draft, fullName: formatPatientFullName(draft) };
    startSave(async () => {
      try {
        const response = await fetch("/api/patients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(updated),
        });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Unable to save patient profile.");
        setPatient(updated);
        setDraft(updated);
        setNotice({ tone: "success", text: "Patient profile updated successfully." });
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save patient profile." });
      }
    });
  }

  const medicalDocuments = useMemo<MedicalDocumentItem[]>(() => {
    const prescriptionItems = prescriptions.map<MedicalDocumentItem>((prescription) => {
      const doctorName = prescription.doctors?.profiles?.full_name ?? "Doctor not recorded";
      const summary =
        prescription.diagnoses?.diagnosis_text
        ?? prescription.general_instructions
        ?? "No diagnosis recorded.";
      const bullets = (prescription.prescription_items ?? [])
        .map((item) => {
          const parts = [item.medicine_name, item.dosage, item.frequency, item.duration].filter(
            (part): part is string => Boolean(part && part.trim()),
          );
          return parts.join(" • ");
        })
        .filter((item) => item.trim().length > 0);

      return {
        id: prescription.id,
        category: "Prescriptions",
        kind: "Prescription",
        title: prescription.prescription_no,
        subtitle: doctorName,
        dateLabel: formatDisplayDate(prescription.created_at.slice(0, 10)),
        sortDate: parseTime(prescription.created_at),
        summary,
        details: [
          { label: "Patient", value: prescription.patients?.profiles?.full_name ?? "Patient not recorded" },
          { label: "Doctor", value: doctorName },
          { label: "Follow-up", value: prescription.follow_up_date || "Not set" },
          { label: "Status", value: prescription.released_to_patient ? "Released" : "Pending release" },
        ],
        prescriptionNo: prescription.prescription_no,
        prescriptionPatientName: prescription.patients?.profiles?.full_name ?? "Patient not recorded",
        prescriptionPatientDob: prescription.patients?.dob ?? null,
        prescriptionPatientGender: prescription.patients?.gender ?? null,
        prescriptionDoctorName: doctorName,
        prescriptionDoctorSpecialty: prescription.doctors?.specialty ?? null,
        prescriptionDoctorLicenseNo: prescription.doctors?.license_no ?? null,
        prescriptionDoctorSignatureDataUrl: prescription.doctor_signature_data_url ?? null,
        prescriptionCreatedAt: prescription.created_at,
        prescriptionGeneralInstructions: prescription.general_instructions,
        prescriptionFollowUpDate: prescription.follow_up_date,
        prescriptionItems: prescription.prescription_items ?? [],
        bullets,
        previewType: "pdf",
        previewUrl: `/api/v2/prescriptions/${prescription.id}/pdf`,
        openUrl: `/api/v2/prescriptions/${prescription.id}/pdf`,
        downloadUrl: `/api/v2/prescriptions/${prescription.id}/pdf`,
        fileName: `${prescription.prescription_no}.pdf`,
        badge: prescription.released_to_patient ? "Released" : "Draft",
      };
    });

    const aftercareItems = consents
      .filter((consent) => consent.aftercare_acknowledged || Boolean(resolveAftercareGuideForService(consent.procedure_name)))
      .map<MedicalDocumentItem>((consent) => {
        const guide = resolveAftercareGuideForService(consent.procedure_name);
        const aftercarePdfUrl = `/api/v2/procedure-consents/${consent.id}/aftercare-pdf`;
        return {
          id: `aftercare-${consent.id}`,
          category: "Aftercare",
          kind: "Post-procedure aftercare",
          title: consent.aftercare_guide_title || consent.procedure_name,
          subtitle: consent.patient_name,
          dateLabel: formatDisplayDate(consent.signed_at.slice(0, 10)),
          sortDate: parseTime(consent.signed_at),
          summary: guide?.summary || consent.aftercare_guide_title || "Aftercare instructions provided by the clinic.",
          note: consent.aftercare_acknowledged
            ? "Real aftercare instructions acknowledged by the patient."
            : "Real aftercare instructions linked to the procedure.",
          details: [
            { label: "Patient", value: consent.patient_name },
            { label: "Procedure", value: consent.procedure_name },
          ],
          bullets: guide?.bullets ?? [],
          previewType: "text",
          previewUrl: aftercarePdfUrl,
          openUrl: aftercarePdfUrl,
          downloadUrl: aftercarePdfUrl,
          fileName: `${(consent.aftercare_guide_title || consent.procedure_name).replace(/[^\w.-]+/g, "_")}_Aftercare_Instructions.pdf`,
          badge: consent.aftercare_acknowledged ? "Acknowledged" : "Pending",
        };
      });

    const consentItems = consents.map<MedicalDocumentItem>((consent) => {
      const snapshot = consent.consent_snapshot ?? {};
      const consentPoints = asStringArray(snapshot.consentBullets);
      const consentSummary = readSnapshotText(snapshot, "consentSummary") || "Procedure consent signed for the selected treatment.";
      const pdfUrl = `/api/v2/procedure-consents/${consent.id}/pdf`;

      return {
        id: consent.id,
        patientId: id,
        category: "Consent Forms",
        kind: "Signed Consent Form",
        title: consent.procedure_name,
        subtitle: consent.patient_name,
        dateLabel: formatDisplayDate(consent.signed_at.slice(0, 10)),
        sortDate: parseTime(consent.signed_at),
        summary: consentSummary,
        consentPatientName: consent.patient_name,
        consentProcedureName: consent.procedure_name,
        consentSignedAt: consent.signed_at,
        consentSnapshot: snapshot,
        consentPatientSignature: consent.patient_signature,
        consentWitnessName: consent.witness_name,
        consentWitnessSignature: consent.witness_signature,
        consentWitnessSignedAt: consent.witness_signed_at,
        consentPhysicianName: consent.physician_name,
        consentPhysicianSignature: consent.physician_signature,
        consentPhysicianSignedAt: consent.physician_signed_at,
        consentAftercareAcknowledged: consent.aftercare_acknowledged,
        consentAftercareGuideTitle: consent.aftercare_guide_title,
        details: [
          { label: "Patient", value: consent.patient_name },
          { label: "Signed", value: formatDisplayDate(consent.signed_at.slice(0, 10)) },
          { label: "Aftercare", value: consent.aftercare_acknowledged ? "Acknowledged" : "Pending" },
        ],
        bullets: consentPoints.length ? consentPoints : FALLBACK_CONSENT_POINTS,
        previewType: "pdf",
        previewUrl: pdfUrl,
        openUrl: pdfUrl,
        downloadUrl: pdfUrl,
        fileName: `${consent.procedure_name.replace(/[^\w.-]+/g, "_")}_Consent_Form.pdf`,
        badge: consent.aftercare_acknowledged ? "Aftercare acknowledged" : "Aftercare pending",
      };
    });

    const fileItems = files.map<MedicalDocumentItem>((file) => {
      const isMedCert = file.file_type === "Medical Certificate";
      const isLabRequest = file.file_type === "Laboratory Request" || file.file_type === "Lab Request";
      const isReferral = file.file_type === "MD Referral" || file.file_type === "Doctor Referral";
      const category = isMedCert ? "Certificates" : isLabRequest ? "Lab Requests" : isReferral ? "Referrals" : "Files";
      const previewUrl = isMedCert
        ? `/api/v2/medical-certificates/${file.id}/pdf`
        : isLabRequest
          ? `/api/v2/laboratory-requests/${file.id}/pdf`
          : isReferral
            ? `/api/v2/md-referrals/${file.id}/pdf`
            : file.file_url;
      const previewType = (isMedCert || isLabRequest || isReferral)
        ? "pdf"
        : isPdfUrl(file.file_url)
          ? "pdf"
          : isImageUrl(file.file_url)
            ? "image"
            : "link";

      const docPatientName = file.document_metadata?.patient_name || patient?.fullName || "Patient";
      const docPatientDob = file.document_metadata?.patient_dob || patient?.dateOfBirth || null;
      const docPatientGender = file.document_metadata?.patient_gender || patient?.gender || null;
      const docDoctorName = file.document_metadata?.doctor_name || "Dr. Fatimah Al-Zahra T. Ditti";

      const meta = file.document_metadata as Record<string, unknown> | null;
      const allTests = Array.isArray(meta?.selected_tests) ? (meta.selected_tests as string[]) : [];
      const ultrasound = meta?.ultrasound as string | undefined;
      const xray = meta?.xray as string | undefined;
      const ctScan = meta?.ct_scan as string | undefined;
      const others = meta?.others as string | undefined;

      const summary = isMedCert
        ? (file.document_metadata?.complaints || "Medical certificate issued by the clinic.")
        : isLabRequest
          ? [
              allTests.length > 0 ? `${allTests.length} tests selected` : null,
              ultrasound ? `US: ${ultrasound}` : null,
              xray ? `X-Ray: ${xray}` : null,
              ctScan ? `CT: ${ctScan}` : null,
              others ? `Others: ${others}` : null,
            ].filter(Boolean).join(" • ") || "Laboratory request issued by the clinic."
          : isReferral
            ? ((meta?.reason_for_referral as string) || (meta?.note as string) || "MD Referral issued by the clinic.")
            : "Uploaded document from the clinic.";

      return {
        id: file.id,
        patientId: id,
        category,
        kind: isLabRequest ? "Laboratory Request" : isReferral ? "MD Referral" : (file.file_type || "Medical file"),
        title: isLabRequest ? ((meta?.request_no as string) || file.file_name) : isReferral ? ((meta?.referral_no as string) || file.file_name) : file.file_name,
        subtitle: isMedCert ? "Patient certificate" : isLabRequest ? "Laboratory & Diagnostic Request" : isReferral ? `Referred to ${(meta?.referred_specialty as string) || "Specialist"}` : (file.file_type || "Released medical file"),
        dateLabel: formatDisplayDate(file.created_at.slice(0, 10)),
        sortDate: parseTime(file.created_at),
        summary,
        note: isMedCert
          ? (file.document_metadata?.recommendation || file.document_metadata?.note || null)
          : isLabRequest
            ? (others || (meta?.notes as string) || null)
            : isReferral
              ? ((meta?.note as string) || null)
              : null,
        details: isMedCert
          ? [
              { label: "Patient", value: docPatientName },
              { label: "Diagnosis", value: file.document_metadata?.diagnosis || "Not recorded" },
              { label: "Recommendation", value: file.document_metadata?.recommendation || "Not recorded" },
            ]
          : isLabRequest
            ? [
                { label: "Patient", value: docPatientName },
                { label: "Doctor", value: docDoctorName },
                { label: "Tests count", value: allTests.length.toString() },
                { label: "Status", value: "Released" },
              ]
            : isReferral
              ? [
                  { label: "Patient", value: docPatientName },
                  { label: "Specialty", value: (meta?.referred_specialty as string) || "Internal Medicine" },
                  ...((meta?.referred_doctor as string) ? [{ label: "Doctor", value: meta?.referred_doctor as string }] : []),
                  { label: "Referring Doctor", value: docDoctorName },
                ]
              : undefined,
        prescriptionPatientName: (isMedCert || isLabRequest || isReferral) ? docPatientName : undefined,
        prescriptionPatientDob: (isMedCert || isLabRequest || isReferral) ? docPatientDob : undefined,
        prescriptionPatientGender: (isMedCert || isLabRequest || isReferral) ? docPatientGender : undefined,
        prescriptionDoctorName: (isMedCert || isLabRequest || isReferral) ? docDoctorName : undefined,
        prescriptionDoctorSpecialty: (isMedCert || isLabRequest || isReferral) ? (file.document_metadata?.doctor_specialty as string) : undefined,
        prescriptionDoctorLicenseNo: (isMedCert || isLabRequest || isReferral) ? (file.document_metadata?.doctor_license_no as string) : undefined,
        prescriptionCreatedAt: file.created_at,
        referralNo: isReferral ? ((meta?.referral_no as string) || file.file_name.replace(/\.pdf$/i, "")) : undefined,
        referralSpecialty: isReferral ? ((meta?.referred_specialty as string) || "Internal Medicine") : undefined,
        referredDoctorName: isReferral ? ((meta?.referred_doctor as string) || null) : undefined,
        referralReason: isReferral ? ((meta?.reason_for_referral as string) || null) : undefined,
        labRequestNo: isLabRequest ? ((meta?.request_no as string) || file.file_name.replace(/\.pdf$/i, "")) : undefined,
        labPatientName: isLabRequest ? docPatientName : undefined,
        labPatientDob: isLabRequest ? docPatientDob : undefined,
        labPatientGender: isLabRequest ? docPatientGender : undefined,
        labPatientAddress: isLabRequest ? (meta?.patient_address as string) : undefined,
        labDoctorName: isLabRequest ? docDoctorName : undefined,
        labDoctorSpecialty: isLabRequest ? (meta?.doctor_specialty as string) : undefined,
        labDoctorLicenseNo: isLabRequest ? (meta?.doctor_license_no as string) : undefined,
        labCreatedAt: file.created_at,
        labSelectedTests: allTests,
        labBloodChemistry: Array.isArray(meta?.blood_chemistry) ? (meta.blood_chemistry as string[]) : [],
        labHematology: Array.isArray(meta?.hematology) ? (meta.hematology as string[]) : [],
        labImmunoSerology: Array.isArray(meta?.immuno_serology) ? (meta.immuno_serology as string[]) : [],
        labClinicalMicroscopy: Array.isArray(meta?.clinical_microscopy) ? (meta.clinical_microscopy as string[]) : [],
        labUltrasound: ultrasound ?? null,
        labXray: xray ?? null,
        labCtScan: ctScan ?? null,
        labOthers: others ?? null,
        labNotes: (meta?.notes as string) ?? null,
        previewType,
        previewUrl,
        openUrl: previewUrl,
        downloadUrl: previewUrl,
        fileName: file.file_name,
        badge: isMedCert ? "Certificate" : isLabRequest ? "Lab Request" : (file.file_type ?? "File"),
      };
    });

    return [...prescriptionItems, ...aftercareItems, ...consentItems, ...fileItems].sort(
      (left, right) => Number(right.sortDate ?? 0) - Number(left.sortDate ?? 0),
    );
  }, [consents, files, id, patient?.dateOfBirth, patient?.fullName, patient?.gender, prescriptions]);

  if (loading) {
    return <Loading />;
  }

  if (!patient || !draft) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">
        {notice?.text ?? "Patient record was not found."}
      </div>
    );
  }

  const isExisting = patient.patientCategory === "Existing";
  const latestConsent = consents[0] ?? null;
  const completedVisits = visits.filter((visit) => visit.status === "Completed").length;

  return (
    <div className="space-y-5 pb-8">
      <button
        type="button"
        onClick={() => router.push("/patients/records")}
        className="inline-flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-neutral-950"
      >
        <FaArrowLeft className="h-4 w-4" />
        Patient records
      </button>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-lg font-black text-white">
              {initials(patient)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Patient chart</p>
              <h1 className="mt-1 truncate text-2xl font-black text-neutral-950">{patient.fullName}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {patient.patientNumber} · {patient.gender || "Sex not recorded"}
                {age != null ? ` · ${age} years old` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isExisting ? "neutral" : "blue"}>{isExisting ? "Existing patient" : "New patient"}</Badge>
            <Badge tone={latestConsent ? "success" : "warning"}>{latestConsent ? "Procedure consent signed" : "No procedure consent"}</Badge>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              <FaFloppyDisk className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div className="grid border-t border-neutral-200 sm:grid-cols-3">
          <Stat label="Completed visits" value={completedVisits} icon={<FaCalendarDays />} />
          <Stat label="Procedure consent" value={latestConsent ? "Signed" : "None"} icon={<FaCheck />} />
          <Stat label="Last visit" value={history[0] ? formatDisplayDate(history[0].date) : "None"} icon={<FaClockRotateLeft />} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-5 py-3">
          <button
            type="button"
            onClick={() => router.push("/appointments")}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            <FaCalendarDays className="h-4 w-4" />
            Book appointment
          </button>
          <button
            type="button"
            onClick={() => router.push("/consultations")}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            <FaNotesMedical className="h-4 w-4" />
            Open consultations
          </button>
        </div>

        <nav className="flex overflow-x-auto border-t border-neutral-200 px-3" aria-label="Patient profile sections">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${
                tab === item ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </section>

      {tab === "Personal" ? <Personal draft={draft} onChange={update} /> : null}
      {tab === "Contact" ? <Contact draft={draft} onChange={update} /> : null}
      {tab === "Other" ? <Other draft={draft} onChange={update} /> : null}
      {tab === "Medical Records" ? (
        <div className="space-y-5">
          <MedicalDocumentsBrowser
            title="Patient medical documents"
            description="Staff can review this patient's prescriptions, medical certificates, consent forms, uploaded files, and aftercare guides in one place."
            items={medicalDocuments}
            loading={false}
            emptyTitle="No medical documents yet"
            emptyDescription="This patient has not been issued any released documents yet."
          />
          <Timeline visits={history} />
        </div>
      ) : null}

      {notice ? <Toast notice={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  );
}

type DraftProps = {
  draft: PatientRecordItem;
  onChange: <K extends keyof PatientRecordItem>(field: K, value: PatientRecordItem[K]) => void;
};

function Personal({ draft, onChange }: DraftProps) {
  return (
    <Panel title="Personal information" subtitle="Core patient details used in booking and the medical chart.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReadOnly label="Patient number" value={draft.patientNumber} />
        <Field label="First name"><input value={draft.firstName} onChange={(event) => onChange("firstName", event.target.value)} className={fieldClass} /></Field>
        <Field label="Middle name / initial"><input value={draft.middleName} onChange={(event) => onChange("middleName", event.target.value)} className={fieldClass} /></Field>
        <Field label="Family name"><input value={draft.lastName} onChange={(event) => onChange("lastName", event.target.value)} className={fieldClass} /></Field>
        <Field label="Suffix"><input value={draft.suffixName} onChange={(event) => onChange("suffixName", event.target.value)} className={fieldClass} /></Field>
        <Field label="Birth date"><input type="date" value={draft.dateOfBirth} onChange={(event) => onChange("dateOfBirth", event.target.value)} className={fieldClass} /></Field>
        <Field label="Sex"><select value={draft.gender} onChange={(event) => onChange("gender", event.target.value)} className={fieldClass}><option value="">Select sex</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></Field>
        <Field label="Civil status"><select value={draft.civilStatus} onChange={(event) => onChange("civilStatus", event.target.value)} className={fieldClass}><option value="">Select civil status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select></Field>
        <ReadOnly label="Patient type" value={draft.patientCategory === "Existing" ? "Existing patient" : "New patient"} />
      </div>
    </Panel>
  );
}

function Contact({ draft, onChange }: DraftProps) {
  return (
    <Panel title="Contact information" subtitle="Details used for reminders and clinic coordination.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mobile number"><input value={draft.phone} onChange={(event) => onChange("phone", event.target.value)} className={fieldClass} /></Field>
        <Field label="Email address"><input type="email" value={draft.email} onChange={(event) => onChange("email", event.target.value)} className={fieldClass} /></Field>
        <div className="md:col-span-2"><Field label="Address"><input value={draft.address} onChange={(event) => onChange("address", event.target.value)} className={fieldClass} /></Field></div>
        <Field label="Emergency contact name"><input value={draft.emergencyContactName} onChange={(event) => onChange("emergencyContactName", event.target.value)} className={fieldClass} /></Field>
        <Field label="Emergency contact number"><input value={draft.emergencyContactPhone} onChange={(event) => onChange("emergencyContactPhone", event.target.value)} className={fieldClass} /></Field>
      </div>
    </Panel>
  );
}

function Other({ draft, onChange }: DraftProps) {
  return (
    <Panel title="Other information" subtitle="Supporting details for a complete clinical profile.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Religion"><input value={draft.religion} onChange={(event) => onChange("religion", event.target.value)} className={fieldClass} /></Field>
        <Field label="Occupation"><input value={draft.occupation} onChange={(event) => onChange("occupation", event.target.value)} className={fieldClass} /></Field>
        <Field label="Guardian (for pediatric patients)"><input value={draft.guardianName} onChange={(event) => onChange("guardianName", event.target.value)} className={fieldClass} /></Field>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Known allergies"><textarea value={draft.allergies} onChange={(event) => onChange("allergies", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field>
        <Field label="Medical history"><textarea value={draft.medicalHistory} onChange={(event) => onChange("medicalHistory", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field>
        <div className="md:col-span-2"><Field label="Family history"><textarea value={draft.familyHistory} onChange={(event) => onChange("familyHistory", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field></div>
      </div>
    </Panel>
  );
}

function Timeline({ visits }: { visits: PatientVisitRecord[] }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <FaClockRotateLeft className="h-4 w-4 text-neutral-500" />
        <div>
          <h2 className="font-black text-neutral-950">Medical record timeline</h2>
          <p className="mt-1 text-sm text-neutral-500">Appointment-linked SOAP notes, diagnoses, and prescriptions.</p>
        </div>
      </div>
      <div className="mt-6 space-y-5">
        {visits.length ? visits.map((visit) => <Visit key={visit.appointmentId} visit={visit} />) : <div className="border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">No consultation records yet.</div>}
      </div>
    </section>
  );
}

function Visit({ visit }: { visit: PatientVisitRecord }) {
  const doctor = getDoctorById(visit.doctorId);
  return (
    <article className="grid gap-3 border-b border-neutral-100 pb-5 last:border-b-0 last:pb-0 md:grid-cols-[9rem_minmax(0,1fr)]">
      <div>
        <p className="font-bold text-neutral-950">{formatDisplayDate(visit.date)}</p>
        <p className="mt-1 text-xs text-neutral-500">{formatRange(visit.start, visit.end)}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{visit.type}</Badge>
          <span className="text-xs font-medium text-neutral-500">{doctor?.name ?? "Assigned doctor"}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-neutral-900">{visit.consultation?.diagnosis || visit.reason || "No diagnosis recorded."}</p>
        {visit.consultation?.note ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-700">{visit.consultation.note}</p> : null}
        {visit.consultation?.prescription ? (
          <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <strong>Prescription: </strong>
            {visit.consultation.prescription}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="font-black text-neutral-950">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-bold text-neutral-700">
      <span>{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-neutral-700">{label}</p>
      <p className="mt-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600">{value}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "neutral" | "blue" | "success" | "warning"; children: ReactNode }) {
  const colors = {
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  return <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${colors}`}>{children}</span>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">{icon}</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</p>
        <p className="mt-1 text-sm font-bold text-neutral-800">{value}</p>
      </div>
    </div>
  );
}

function initials(patient: PatientRecordItem) {
  return (
    [patient.firstName, patient.lastName]
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "P"
  );
}

function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const success = notice.tone === "success";
  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border p-4 shadow-xl ${
        success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
        <FaCheck className="h-3 w-3" />
      </span>
      <p className="flex-1 text-sm font-semibold leading-5">{notice.text}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="text-neutral-500 hover:text-neutral-950">
        ×
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-5 w-32 rounded bg-neutral-200" />
      <div className="h-52 rounded-lg border border-neutral-200 bg-white" />
      <div className="h-80 rounded-lg border border-neutral-200 bg-white" />
    </div>
  );
}
