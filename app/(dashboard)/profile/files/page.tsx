"use client";

import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { PatientRecordItem } from "@/src/lib/clinic";
import { resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import {
  MedicalDocumentsBrowser,
  type MedicalDocumentItem,
} from "@/src/components/medical-documents/MedicalDocumentsBrowser";

type PatientFile = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  document_metadata: {
    certificate_no?: string;
    complaints?: string;
    diagnosis?: string;
    recommendation?: string;
    note?: string | null;
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
  diagnoses?: {
    diagnosis_text: string;
    treatment_plan: string | null;
    follow_up_date: string | null;
  } | null;
  doctors?: {
    specialty?: string | null;
    license_no?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
  doctor_signature_data_url?: string | null;
  patients?: {
    dob?: string | null;
    gender?: string | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  } | null;
};

type ProcedureConsent = {
  id: string;
  patient_id: string;
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

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

const FALLBACK_CONSENT_POINTS = [
  "The procedure, purpose, expected benefits, possible risks, side effects, complications, and possible alternatives were explained in a language I understand.",
  "I understand that results vary and that no exact result, cosmetic outcome, or medical response can be guaranteed.",
  "I understand that no medical or aesthetic procedure is completely risk-free, even when proper care is provided.",
  "I had the opportunity to ask questions and confirm that my questions were answered before signing.",
  "I voluntarily authorize Doc Kulot, Family Medicine Specialist and Aesthetic Medicine, to perform the selected procedure.",
];

export default function MedicalDocumentsPage() {
  const { accessToken, role } = useRole();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [consents, setConsents] = useState<ProcedureConsent[]>([]);
  const [patients, setPatients] = useState<PatientRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [filesRes, prescriptionsRes, consentsRes, patientsRes] = await Promise.all([
          fetch("/api/v2/patient-files", { cache: "no-store", headers }),
          fetch("/api/v2/prescriptions", { cache: "no-store", headers }),
          fetch("/api/v2/procedure-consents", { cache: "no-store", headers }),
          role === "PATIENT" ? Promise.resolve(null) : fetch("/api/patient-records", { cache: "no-store", headers }),
        ]);

        const filesPayload = (await filesRes.json().catch(() => ({}))) as { files?: PatientFile[]; message?: string };
        const prescriptionsPayload = (await prescriptionsRes.json().catch(() => ({}))) as { prescriptions?: Prescription[]; message?: string };
        const consentsPayload = (await consentsRes.json().catch(() => ({}))) as { consents?: ProcedureConsent[]; message?: string };
        const patientsPayload = patientsRes ? (await patientsRes.json().catch(() => ({}))) as { patients?: PatientRecordItem[] } : null;

        if (!filesRes.ok) throw new Error(filesPayload.message ?? "Unable to load medical files.");
        if (!prescriptionsRes.ok) throw new Error(prescriptionsPayload.message ?? "Unable to load prescriptions.");
        if (!consentsRes.ok) throw new Error(consentsPayload.message ?? "Unable to load consent records.");

        if (!active) return;
        setFiles(filesPayload.files ?? []);
        setPrescriptions(
          (prescriptionsPayload.prescriptions ?? []).map((item) => ({
            ...item,
            prescription_items: [...(item.prescription_items ?? [])].sort(
              (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
            ),
          })),
        );
        setConsents(consentsPayload.consents ?? []);
        setPatients(patientsPayload?.patients?.filter((patient) => patient.status === "Active") ?? []);
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load medical documents.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const documentItems = useMemo<MedicalDocumentItem[]>(() => {
    const isPatient = role === "PATIENT";

    const prescriptionItems = prescriptions.map<MedicalDocumentItem>((prescription) => {
      const doctorName = prescription.doctors?.profiles?.full_name ?? "Doctor not recorded";
      const patientName = prescription.patients?.profiles?.full_name ?? "Patient not recorded";
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
        patientId: prescription.patient_id,
        category: "Prescriptions",
        kind: "Prescription",
        title: prescription.prescription_no,
        subtitle: isPatient ? doctorName : patientName,
        dateLabel: formatDate(prescription.created_at),
        sortDate: parseTime(prescription.created_at),
        summary,
        details: [
          { label: "Patient", value: patientName },
          { label: "Doctor", value: doctorName },
          { label: "Follow-up", value: prescription.follow_up_date || "Not set" },
          { label: "Status", value: prescription.released_to_patient ? "Released" : "Pending release" },
        ],
        prescriptionNo: prescription.prescription_no,
        prescriptionPatientName: patientName,
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

    const certificateItems = files
      .filter((file) => file.file_type === "Medical Certificate")
      .map<MedicalDocumentItem>((file) => {
        const docDoctorName = file.document_metadata?.doctor_name || "Dr. Fatimah Al-Zahra T. Ditti";
        return {
          id: file.id,
          patientId: file.patient_id,
          category: "Certificates",
          kind: "Medical Certificate",
          title: file.file_name,
          subtitle: isPatient ? "Released certificate" : "Patient certificate",
          dateLabel: formatDate(file.created_at),
          sortDate: parseTime(file.created_at),
          summary: file.document_metadata?.complaints || "Medical certificate issued by the clinic.",
          note: file.document_metadata?.recommendation || file.document_metadata?.note || null,
          details: [
            { label: "Patient", value: file.document_metadata?.patient_name ?? (isPatient ? "You" : "Patient record") },
            { label: "Diagnosis", value: file.document_metadata?.diagnosis ?? "Not recorded" },
            { label: "Recommendation", value: file.document_metadata?.recommendation ?? "Not recorded" },
          ],
          prescriptionPatientName: file.document_metadata?.patient_name ?? null,
          prescriptionPatientDob: file.document_metadata?.patient_dob ?? null,
          prescriptionPatientGender: file.document_metadata?.patient_gender ?? null,
          prescriptionDoctorName: docDoctorName,
          prescriptionDoctorSpecialty: file.document_metadata?.doctor_specialty,
          prescriptionDoctorLicenseNo: file.document_metadata?.doctor_license_no,
          prescriptionCreatedAt: file.created_at,
          previewType: "pdf",
          previewUrl: `/api/v2/medical-certificates/${file.id}/pdf`,
          openUrl: `/api/v2/medical-certificates/${file.id}/pdf`,
          downloadUrl: `/api/v2/medical-certificates/${file.id}/pdf`,
          fileName: file.file_name,
          badge: "Certificate",
        };
      });

    const referralItems = files
      .filter((file) => file.file_type === "MD Referral")
      .map<MedicalDocumentItem>((file) => {
        const meta = (file.document_metadata as Record<string, unknown> | null) || {};
        const docDoctorName = (meta.doctor_name as string) || "Dr. Fatimah Al-Zahra T. Ditti";
        const patientName = (meta.patient_name as string) ?? (isPatient ? "You" : "Patient record");
        const referralNo = (meta.referral_no as string) || file.file_name.replace(/\.pdf$/i, "");
        const referredSpecialty = (meta.referred_specialty as string) || "Internal Medicine";
        const referredDoctor = (meta.referred_doctor as string) || null;
        const reason = (meta.reason_for_referral as string) || (meta.note as string) || "Clinical consultation and management.";

        return {
          id: file.id,
          patientId: file.patient_id,
          category: "Referrals",
          kind: "MD Referral",
          title: referralNo,
          subtitle: isPatient
            ? `Referred to ${referredDoctor ? `${referredDoctor} (${referredSpecialty})` : referredSpecialty}`
            : `Referral for ${patientName}`,
          dateLabel: formatDate(file.created_at),
          sortDate: parseTime(file.created_at),
          summary: reason,
          note: (meta.note as string) || null,
          details: [
            { label: "Patient", value: patientName },
            { label: "Referred Specialty", value: referredSpecialty },
            ...(referredDoctor ? [{ label: "Referred Doctor", value: referredDoctor }] : []),
            { label: "Referring Doctor", value: docDoctorName },
          ],
          prescriptionPatientName: (meta.patient_name as string) ?? null,
          prescriptionPatientDob: (meta.patient_dob as string) ?? null,
          prescriptionPatientGender: (meta.patient_gender as string) ?? null,
          prescriptionDoctorName: docDoctorName,
          prescriptionDoctorSpecialty: (meta.doctor_specialty as string) || "Family Medicine",
          prescriptionDoctorLicenseNo: (meta.doctor_license_no as string) || "0141185",
          prescriptionCreatedAt: file.created_at,
          referralNo,
          referralSpecialty: referredSpecialty,
          referredDoctorName: referredDoctor,
          referralReason: reason,
          previewType: "pdf",
          previewUrl: `/api/v2/md-referrals/${file.id}/pdf`,
          openUrl: `/api/v2/md-referrals/${file.id}/pdf`,
          downloadUrl: `/api/v2/md-referrals/${file.id}/pdf`,
          fileName: file.file_name,
          badge: "MD Referral",
        };
      });

    const consentItems = consents.map<MedicalDocumentItem>((consent) => {
      const snapshot = consent.consent_snapshot ?? {};
      const consentPoints = asStringArray(snapshot.consentBullets);
      const consentSummary = readSnapshotText(snapshot, "consentSummary") || "Procedure consent signed for the selected treatment.";
      const pdfUrl = `/api/v2/procedure-consents/${consent.id}/pdf`;

      return {
        id: consent.id,
        patientId: consent.patient_id,
        category: "Consent Forms",
        kind: "Signed Consent Form",
        title: consent.procedure_name,
        subtitle: isPatient ? consent.patient_name : consent.patient_name,
        dateLabel: formatDate(consent.signed_at),
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
          { label: "Signed", value: formatDate(consent.signed_at) },
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

    const aftercareItems = consents
      .filter((consent) => consent.aftercare_acknowledged || Boolean(resolveAftercareGuideForService(consent.procedure_name)))
      .map<MedicalDocumentItem>((consent) => {
        const guide = resolveAftercareGuideForService(consent.procedure_name);
        const summary = guide?.summary || consent.aftercare_guide_title || "Aftercare instructions provided by the clinic.";
        const bullets = guide?.bullets ?? [];
        const aftercarePdfUrl = `/api/v2/procedure-consents/${consent.id}/aftercare-pdf`;
        return {
          id: `aftercare-${consent.id}`,
          patientId: consent.patient_id,
          category: "Aftercare",
          kind: "Post-procedure aftercare",
          title: consent.aftercare_guide_title || consent.procedure_name,
          subtitle: consent.patient_name,
          dateLabel: formatDate(consent.signed_at),
          sortDate: parseTime(consent.signed_at),
          summary,
          note: consent.aftercare_acknowledged
            ? "Real aftercare instructions acknowledged by the patient."
            : "Real aftercare instructions linked to the procedure.",
          details: [
            { label: "Patient", value: consent.patient_name },
            { label: "Procedure", value: consent.procedure_name },
          ],
          bullets,
          previewType: "text",
          previewUrl: aftercarePdfUrl,
          openUrl: aftercarePdfUrl,
          downloadUrl: aftercarePdfUrl,
          fileName: `${(consent.aftercare_guide_title || consent.procedure_name).replace(/[^\w.-]+/g, "_")}_Aftercare_Instructions.pdf`,
          badge: consent.aftercare_acknowledged ? "Acknowledged" : "Pending",
        };
      });

    const laboratoryItems = files
      .filter((file) => file.file_type === "Laboratory Request" || file.file_type === "Lab Request")
      .map<MedicalDocumentItem>((file) => {
        const meta = file.document_metadata as Record<string, unknown> | null;
        const docDoctorName = (meta?.doctor_name as string) || "Dr. Fatimah Al-Zahra T. Ditti";
        const patientName = (meta?.patient_name as string) ?? (isPatient ? "You" : "Patient record");
        const requestNo = (meta?.request_no as string) || file.file_name.replace(/\.pdf$/i, "");
        const allTests = Array.isArray(meta?.selected_tests) ? (meta.selected_tests as string[]) : [];
        const ultrasound = meta?.ultrasound as string | undefined;
        const xray = meta?.xray as string | undefined;
        const ctScan = meta?.ct_scan as string | undefined;
        const others = meta?.others as string | undefined;
        
        const summaryParts: string[] = [];
        if (allTests.length > 0) summaryParts.push(`${allTests.length} tests selected (${allTests.slice(0, 3).join(", ")}${allTests.length > 3 ? "..." : ""})`);
        if (ultrasound) summaryParts.push(`US: ${ultrasound}`);
        if (xray) summaryParts.push(`X-Ray: ${xray}`);
        if (ctScan) summaryParts.push(`CT: ${ctScan}`);
        if (others) summaryParts.push(`Others: ${others}`);

        return {
          id: file.id,
          patientId: file.patient_id,
          category: "Lab Requests",
          kind: "Laboratory Request",
          title: requestNo,
          subtitle: isPatient ? "Laboratory & Diagnostic Request" : patientName,
          dateLabel: formatDate(file.created_at),
          sortDate: parseTime(file.created_at),
          summary: summaryParts.join(" • ") || "Laboratory request issued by FamMed Clinic.",
          note: others || (meta?.notes as string) || null,
          details: [
            { label: "Patient", value: patientName },
            { label: "Doctor", value: docDoctorName },
            { label: "Tests count", value: allTests.length.toString() },
            { label: "Status", value: "Released" },
          ],
          labRequestNo: requestNo,
          labPatientName: patientName,
          labPatientDob: (meta?.patient_dob as string) ?? null,
          labPatientGender: (meta?.patient_gender as string) ?? null,
          labPatientAddress: (meta?.patient_address as string) ?? null,
          labDoctorName: docDoctorName,
          labDoctorSpecialty: (meta?.doctor_specialty as string) ?? null,
          labDoctorLicenseNo: (meta?.doctor_license_no as string) ?? null,
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
          previewType: "pdf",
          previewUrl: `/api/v2/laboratory-requests/${file.id}/pdf`,
          openUrl: `/api/v2/laboratory-requests/${file.id}/pdf`,
          downloadUrl: `/api/v2/laboratory-requests/${file.id}/pdf`,
          fileName: file.file_name,
          badge: "Lab Request",
        };
      });

    return [...prescriptionItems, ...certificateItems, ...referralItems, ...laboratoryItems, ...consentItems, ...aftercareItems].sort(
      (left, right) => Number(right.sortDate ?? 0) - Number(left.sortDate ?? 0),
    );
  }, [files, prescriptions, consents, role]);

  const isPatient = role === "PATIENT";
  const title = isPatient ? "Your medical documents" : "Clinic medical documents";
  const description = isPatient
    ? "Browse your released prescriptions, medical certificates, signed consent forms, and aftercare in one place."
    : "Browse all patient medical documents released by the clinic, including prescriptions, medical certificates, consent forms, and aftercare.";

  return (
    <div className="space-y-6 pb-8">
      {error ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{error}</div> : null}

      <MedicalDocumentsBrowser
        kicker={isPatient ? "Patient Portal" : "Clinic Workspace"}
        title={title}
        description={description}
        items={documentItems}
        patients={patients.map((patient) => {
          const pName = patient.fullName?.trim().toLowerCase() || "";
          const pDocs = documentItems.filter(
            (item) =>
              item.patientId === patient.id ||
              (pName && (
                item.prescriptionPatientName?.trim().toLowerCase() === pName ||
                item.consentPatientName?.trim().toLowerCase() === pName ||
                item.labPatientName?.trim().toLowerCase() === pName ||
                item.details?.some((d) => d.label.toLowerCase() === "patient" && d.value.trim().toLowerCase() === pName)
              )),
          );
          return {
            id: patient.id,
            name: patient.fullName,
            documentCount: pDocs.length,
            latestDateLabel: pDocs[0]?.dateLabel,
          };
        })}
        loading={isLoading}
        emptyTitle="No medical documents available yet"
        emptyDescription={isPatient ? "Files and records will appear here once the clinic releases them to your portal." : "No documents have been recorded yet."}
        note={isPatient ? "Patient-visible records only." : "Clinic-wide record browser for patient documents."}
      />
    </div>
  );
}
