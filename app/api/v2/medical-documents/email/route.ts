import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { sendEmail } from "@/src/lib/services/notifier";
import {
  createPrescriptionPdf,
  getPrescriptionPdfFilename,
  type PrescriptionPdfRow,
} from "@/src/lib/services/prescription-pdf";
import {
  createMedicalCertificatePdf,
  getMedicalCertificatePdfFilename,
  type MedicalCertificatePdfRow,
} from "@/src/lib/services/medical-certificate-pdf";
import {
  createProcedureConsentPdf,
  createProcedureAftercarePdf,
  getProcedureConsentPdfFilename,
  getProcedureAftercarePdfFilename,
  type ProcedureConsentPdfRow,
  type ProcedureAftercarePdfRow,
} from "@/src/lib/services/procedure-consent-pdf";
import {
  createLaboratoryRequestPdf,
  getLaboratoryRequestPdfFilename,
  type LaboratoryRequestPdfRow,
} from "@/src/lib/services/laboratory-request-pdf";
import {
  createMdReferralPdf,
  getMdReferralPdfFilename,
  type MdReferralPdfRow,
} from "@/src/lib/services/md-referral-pdf";

type EmailDocumentBody = {
  documentId: string;
  kind?: string;
  patientId?: string;
};

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const role = actor.profile.role;
    if (role !== "doctor" && role !== "super_admin" && role !== "admin") {
      throw new HttpError(403, "Only doctors and administrators can email medical documents to patients.");
    }

    const body = (await req.json().catch(() => null)) as EmailDocumentBody | null;
    if (!body?.documentId) {
      throw new HttpError(400, "Document ID is required.");
    }

    const supabase = getSupabaseAdmin();
    const settings = await readSystemSettings();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
    const portalUrl = appUrl ? `${appUrl}/profile/files` : "/profile/files";

    const { documentId, kind } = body;

    // 1. PRESCRIPTION
    if (kind === "Prescription") {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          "*, appointments(appointment_type), diagnoses(diagnosis_text, treatment_plan, follow_up_date), prescription_items(*), patients(dob, gender, profiles(full_name, email)), doctors(specialty, license_no, profiles(full_name))",
        )
        .eq("id", documentId)
        .maybeSingle<
          PrescriptionPdfRow & {
            patients?: { profiles?: { full_name?: string | null; email?: string | null } | null } | null;
            doctors?: { profiles?: { full_name?: string | null } | null } | null;
          }
        >();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Prescription not found.");

      const patientEmail = data.patients?.profiles?.email?.trim();
      if (!patientEmail) {
        throw new HttpError(400, "Patient email address is not recorded in the profile.");
      }

      const pdf = createPrescriptionPdf({ ...data, doctor_signature_data_url: settings.doctorSignatureDataUrl });
      const filename = getPrescriptionPdfFilename(data.prescription_no);

      await sendEmail({
        to: patientEmail,
        subject: `Prescription Copy: ${data.prescription_no}`,
        body: [
          `Hello ${data.patients?.profiles?.full_name ?? "Patient"},`,
          "",
          `Your prescription (${data.prescription_no}) from ${data.doctors?.profiles?.full_name ?? "Doc Kulot"} has been prepared.`,
          "A copy of the PDF document is attached to this email for your convenience.",
          "",
          `You can also view, download, or print it from your patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Prescription successfully emailed to ${patientEmail}.` });
    }

    // 2. POST-PROCEDURE AFTERCARE
    if (kind === "Post-procedure aftercare" || documentId.startsWith("aftercare-")) {
      const consentId = documentId.replace(/^aftercare-/, "");
      const { data, error } = await supabase
        .from("patient_procedure_consents")
        .select("id, patient_id, procedure_name, patient_name, aftercare_guide_title, aftercare_acknowledged, signed_at")
        .eq("id", consentId)
        .maybeSingle<ProcedureAftercarePdfRow>();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Procedure aftercare instructions not found.");

      // Fetch patient email
      const { data: patientData } = await supabase
        .from("patients")
        .select("profiles(email, full_name)")
        .eq("id", data.patient_id || "")
        .maybeSingle<{ profiles?: { email?: string | null; full_name?: string | null } | null }>();

      const patientEmail = patientData?.profiles?.email?.trim();
      if (!patientEmail) {
        throw new HttpError(400, "Patient email address is not recorded in the profile.");
      }

      const pdf = createProcedureAftercarePdf({
        ...data,
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      });
      const filename = getProcedureAftercarePdfFilename(data.procedure_name);

      await sendEmail({
        to: patientEmail,
        subject: `Post-Procedure Aftercare Instructions: ${data.procedure_name}`,
        body: [
          `Hello ${data.patient_name || patientData?.profiles?.full_name || "Patient"},`,
          "",
          `Here are your official post-procedure aftercare instructions for ${data.procedure_name} from Doc Kulot.`,
          "Please follow all recovery recommendations closely. A PDF copy is attached for reference.",
          "",
          `You can also access your clinic documents through the patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Aftercare instructions successfully emailed to ${patientEmail}.` });
    }

    // 3. SIGNED PROCEDURE CONSENT
    if (kind === "Signed Consent Form" || kind === "Consent Forms") {
      const { data, error } = await supabase
        .from("patient_procedure_consents")
        .select(
          "id, patient_id, appointment_id, reservation_id, procedure_name, patient_name, patient_signature, witness_name, witness_signature, witness_signed_at, physician_name, physician_signature, physician_signed_at, consent_snapshot, aftercare_acknowledged, aftercare_guide_title, signed_at",
        )
        .eq("id", documentId)
        .maybeSingle<ProcedureConsentPdfRow>();
      if (error) throw error;
      if (!data) throw new HttpError(404, "Procedure consent record not found.");

      const { data: patientData } = await supabase
        .from("patients")
        .select("profiles(email, full_name)")
        .eq("id", data.patient_id || "")
        .maybeSingle<{ profiles?: { email?: string | null; full_name?: string | null } | null }>();

      const patientEmail = patientData?.profiles?.email?.trim();
      if (!patientEmail) {
        throw new HttpError(400, "Patient email address is not recorded in the profile.");
      }

      const pdf = createProcedureConsentPdf({
        ...data,
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      });
      const filename = getProcedureConsentPdfFilename(data.procedure_name);

      await sendEmail({
        to: patientEmail,
        subject: `Signed Procedure Consent Copy: ${data.procedure_name}`,
        body: [
          `Hello ${data.patient_name || patientData?.profiles?.full_name || "Patient"},`,
          "",
          `A copy of your signed procedure consent form for ${data.procedure_name} is attached.`,
          "",
          `You can also review all signed documents in your patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Consent form successfully emailed to ${patientEmail}.` });
    }

    // 4. PATIENT FILES (Medical Certificate, Lab Request, Generic Files)
    const { data: fileData, error: fileError } = await supabase
      .from("patient_files")
      .select("id, patient_id, appointment_id, file_name, file_url, file_type, document_metadata, created_at")
      .eq("id", documentId)
      .maybeSingle<{
        id: string;
        patient_id: string;
        appointment_id: string | null;
        file_name: string;
        file_url: string;
        file_type: string | null;
        document_metadata: Record<string, unknown> | null;
        created_at: string;
      }>();
    if (fileError) throw fileError;
    if (!fileData) throw new HttpError(404, "Medical document file not found.");

    const { data: patientData } = await supabase
      .from("patients")
      .select("dob, gender, profiles(email, full_name)")
      .eq("id", fileData.patient_id)
      .maybeSingle<{
        dob?: string | null;
        gender?: string | null;
        profiles?: { email?: string | null; full_name?: string | null } | null;
      }>();

    const patientEmail = patientData?.profiles?.email?.trim();
    if (!patientEmail) {
      throw new HttpError(400, "Patient email address is not recorded in the profile.");
    }

    const fileType = fileData.file_type || "";

    // 4A. MEDICAL CERTIFICATE
    if (fileType === "Medical Certificate" || kind === "Medical Certificate") {
      const meta = fileData.document_metadata || {};
      const certificateNo = (meta.certificate_no as string) || "MC-CERT";
      const certRow: MedicalCertificatePdfRow = {
        certificate_no: certificateNo,
        created_at: fileData.created_at,
        complaints: (meta.complaints as string) || null,
        diagnosis: (meta.diagnosis as string) || null,
        recommendation: (meta.recommendation as string) || null,
        note: (meta.note as string) || null,
        released_to_patient: true,
        patients: {
          dob: (meta.patient_dob as string) || patientData?.dob || null,
          gender: (meta.patient_gender as string) || patientData?.gender || null,
          profiles: {
            full_name: (meta.patient_name as string) || patientData?.profiles?.full_name || "Patient",
          },
        },
        doctors: {
          specialty: (meta.doctor_specialty as string) || "Family Medicine Specialist | Aesthetic Medicine",
          license_no: (meta.doctor_license_no as string) || "0141185",
          profiles: {
            full_name: (meta.doctor_name as string) || "Dr. Fatimah Al-Zahra T. Ditti",
          },
        },
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      };

      const pdf = createMedicalCertificatePdf(certRow);
      const filename = getMedicalCertificatePdfFilename(certificateNo);

      await sendEmail({
        to: patientEmail,
        subject: `Medical Certificate: ${certificateNo}`,
        body: [
          `Hello ${patientData?.profiles?.full_name ?? "Patient"},`,
          "",
          `Your medical certificate (${certificateNo}) from Doc Kulot has been issued.`,
          "A copy of the PDF document is attached to this email.",
          "",
          `You can also view and download it directly from your patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Medical certificate successfully emailed to ${patientEmail}.` });
    }

    // 4B. LABORATORY REQUEST
    if (fileType === "Laboratory Request" || fileType === "Lab Request" || kind === "Laboratory Request") {
      const meta = fileData.document_metadata || {};
      const requestNo = (meta.request_no as string) || fileData.file_name.replace(/\.pdf$/i, "") || "LR-REQ";
      const labRow: LaboratoryRequestPdfRow = {
        request_no: requestNo,
        created_at: fileData.created_at,
        selected_tests: Array.isArray(meta.selected_tests) ? (meta.selected_tests as string[]) : [],
        blood_chemistry: Array.isArray(meta.blood_chemistry) ? (meta.blood_chemistry as string[]) : [],
        hematology: Array.isArray(meta.hematology) ? (meta.hematology as string[]) : [],
        immuno_serology: Array.isArray(meta.immuno_serology) ? (meta.immuno_serology as string[]) : [],
        clinical_microscopy: Array.isArray(meta.clinical_microscopy) ? (meta.clinical_microscopy as string[]) : [],
        ultrasound: (meta.ultrasound as string) || null,
        xray: (meta.xray as string) || null,
        ct_scan: (meta.ct_scan as string) || null,
        others: (meta.others as string) || null,
        notes: (meta.notes as string) || null,
        released_to_patient: true,
        patients: {
          dob: (meta.patient_dob as string) || patientData?.dob || null,
          gender: (meta.patient_gender as string) || patientData?.gender || null,
          address: (meta.patient_address as string) || null,
          profiles: {
            full_name: (meta.patient_name as string) || patientData?.profiles?.full_name || "Patient",
          },
        },
        doctors: {
          specialty: (meta.doctor_specialty as string) || "Family Medicine Specialist | Aesthetic Medicine",
          license_no: (meta.doctor_license_no as string) || "0141185",
          profiles: {
            full_name: (meta.doctor_name as string) || "Dr. Fatimah Al-Zahra T. Ditti",
          },
        },
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      };

      const pdf = createLaboratoryRequestPdf(labRow);
      const filename = getLaboratoryRequestPdfFilename(requestNo);

      await sendEmail({
        to: patientEmail,
        subject: `Laboratory & Diagnostic Request: ${requestNo}`,
        body: [
          `Hello ${patientData?.profiles?.full_name ?? "Patient"},`,
          "",
          `Your laboratory request (${requestNo}) from Doc Kulot has been generated.`,
          "Please present the attached PDF copy when having your lab / diagnostic tests done.",
          "",
          `You can also view this request in your patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Laboratory request successfully emailed to ${patientEmail}.` });
    }

    // 4C. MD REFERRAL
    if (fileType === "MD Referral" || kind === "MD Referral") {
      const meta = fileData.document_metadata || {};
      const referralNo = (meta.referral_no as string) || "REF-FORM";
      const referralRow: MdReferralPdfRow = {
        referral_no: referralNo,
        created_at: fileData.created_at,
        referred_specialty: (meta.referred_specialty as string) || "Internal Medicine",
        referred_doctor: (meta.referred_doctor as string) || null,
        reason_for_referral: (meta.reason_for_referral as string) || (meta.note as string) || "Clinical consultation and management.",
        note: (meta.note as string) || null,
        released_to_patient: true,
        patients: {
          dob: (meta.patient_dob as string) || patientData?.dob || null,
          gender: (meta.patient_gender as string) || patientData?.gender || null,
          profiles: {
            full_name: (meta.patient_name as string) || patientData?.profiles?.full_name || "Patient",
          },
        },
        doctors: {
          specialty: (meta.doctor_specialty as string) || "Family Medicine",
          license_no: (meta.doctor_license_no as string) || "0141185",
          profiles: {
            full_name: (meta.doctor_name as string) || "Dr. Fatimah Al-Zahra T. Ditti",
          },
        },
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      };

      const pdf = createMdReferralPdf(referralRow);
      const filename = getMdReferralPdfFilename(referralNo);

      await sendEmail({
        to: patientEmail,
        subject: `Doctor Referral Form: ${referralNo}`,
        body: [
          `Hello ${patientData?.profiles?.full_name ?? "Patient"},`,
          "",
          `Your doctor referral form (${referralNo}) from Doc Kulot has been generated.`,
          "Please present the attached PDF copy to your referred physician.",
          "",
          `You can also view this referral in your patient portal: ${portalUrl}`,
        ].join("\n"),
        attachments: [
          {
            filename,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      });

      return ok({ message: `Doctor referral form successfully emailed to ${patientEmail}.` });
    }

    // 4D. OTHER PATIENT FILE
    await sendEmail({
      to: patientEmail,
      subject: `Medical Document from Doc Kulot: ${fileData.file_name}`,
      body: [
        `Hello ${patientData?.profiles?.full_name ?? "Patient"},`,
        "",
        `Doc Kulot has released a medical document (${fileData.file_name}) to your account.`,
        `You can securely access and view your medical documents in your patient portal: ${portalUrl}`,
      ].join("\n"),
    });

    return ok({ message: `Document notification successfully emailed to ${patientEmail}.` });
  } catch (error) {
    return httpError(error);
  }
}
