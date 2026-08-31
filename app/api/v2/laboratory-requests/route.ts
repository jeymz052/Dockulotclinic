import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { sendEmail } from "@/src/lib/services/notifier";
import {
  createLaboratoryRequestPdf,
  getLaboratoryRequestPdfFilename,
  type LaboratoryRequestPdfRow,
} from "@/src/lib/services/laboratory-request-pdf";
import type { DbRole } from "@/src/lib/db/types";

type Ctx = { params: Promise<Record<string, never>> };
type LaboratoryPatientRow = {
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function canManageLaboratoryRequests(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  return [];
}

function requestNumberForAppointment(appointmentId: string) {
  return `LR-${appointmentId.slice(0, 8).toUpperCase()}`;
}

export async function POST(req: Request, _ctx: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!canManageLaboratoryRequests(actor.profile.role)) {
      throw new HttpError(403, "Only doctors and admins can create laboratory requests.");
    }

    const body = await req.json();
    const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id.trim() : "";
    const patientId = typeof body.patient_id === "string" ? body.patient_id.trim() : "";
    const doctorId = typeof body.doctor_id === "string" ? body.doctor_id.trim() : "";

    if (!patientId) {
      throw new HttpError(400, "patient_id is required.");
    }

    const bloodChemistry = normalizeArray(body.blood_chemistry);
    const hematology = normalizeArray(body.hematology);
    const immunoSerology = normalizeArray(body.immuno_serology);
    const clinicalMicroscopy = normalizeArray(body.clinical_microscopy);
    const selectedTests = normalizeArray(body.selected_tests);
    const ultrasound = normalizeText(body.ultrasound);
    const xray = normalizeText(body.xray);
    const ctScan = normalizeText(body.ct_scan);
    const others = normalizeText(body.others);
    const notes = normalizeText(body.notes);
    const visibleToPatient = body.released_to_patient ?? true;

    const allSelected = Array.from(
      new Set([
        ...selectedTests,
        ...bloodChemistry,
        ...hematology,
        ...immunoSerology,
        ...clinicalMicroscopy,
      ]),
    );

    if (allSelected.length === 0 && !ultrasound && !xray && !ctScan && !others) {
      throw new HttpError(400, "Please select at least one laboratory test or specify imaging/diagnostics.");
    }

    const supabase = getSupabaseAdmin();

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("dob, gender, address, profiles(full_name, email)")
      .eq("id", patientId)
      .single<LaboratoryPatientRow>();
    if (patientError) throw patientError;

    let doctor: LaboratoryRequestPdfRow["doctors"] = null;
    if (doctorId) {
      const { data: doctorRow } = await supabase
        .from("doctors")
        .select("specialty, license_no, profiles(full_name)")
        .eq("id", doctorId)
        .maybeSingle<LaboratoryRequestPdfRow["doctors"]>();
      doctor = doctorRow ?? null;
    }

    const settings = await readSystemSettings();
    const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const requestNo = appointmentId ? requestNumberForAppointment(appointmentId) : `LR-${Date.now().toString(36).toUpperCase()}-${uniqueSuffix}`;
    const now = new Date().toISOString();

    const pdf = createLaboratoryRequestPdf({
      request_no: requestNo,
      created_at: now,
      selected_tests: allSelected,
      blood_chemistry: bloodChemistry,
      hematology,
      immuno_serology: immunoSerology,
      clinical_microscopy: clinicalMicroscopy,
      ultrasound,
      xray,
      ct_scan: ctScan,
      others,
      notes,
      released_to_patient: Boolean(visibleToPatient),
      patients: patient,
      doctors: doctor,
      doctor_signature_data_url: settings.doctorSignatureDataUrl,
    });

    const fileName = getLaboratoryRequestPdfFilename(requestNo);
    const fileUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;

    const { data: fileRow, error: fileError } = await supabase
      .from("patient_files")
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId || null,
        file_name: fileName,
        file_url: fileUrl,
        file_type: "Laboratory Request",
        document_metadata: {
          request_no: requestNo,
          selected_tests: allSelected,
          blood_chemistry: bloodChemistry,
          hematology,
          immuno_serology: immunoSerology,
          clinical_microscopy: clinicalMicroscopy,
          ultrasound,
          xray,
          ct_scan: ctScan,
          others,
          notes,
          doctor_id: doctorId || null,
          doctor_name: doctor?.profiles?.full_name ?? "FATIMAH AL-ZAHRA T. DITTI, MD, DFM",
          doctor_specialty: doctor?.specialty ?? "Family Medicine, Aesthetic Medicine",
          doctor_license_no: doctor?.license_no ?? "0141185",
          patient_name: patient?.profiles?.full_name ?? null,
          patient_dob: patient?.dob ?? null,
          patient_gender: patient?.gender ?? null,
          patient_address: patient?.address ?? null,
        },
        visible_to_patient: Boolean(visibleToPatient),
      })
      .select("id, file_name")
      .single<{ id: string; file_name: string }>();
    if (fileError) throw fileError;

    // Auto-email laboratory request PDF copy to patient if email exists
    let emailedToPatient = false;
    try {
      const patientEmail = patient?.profiles?.email?.trim();
      if (patientEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
        const portalUrl = appUrl ? `${appUrl}/profile/files` : "/profile/files";
        await sendEmail({
          to: patientEmail,
          subject: `Laboratory & Diagnostic Request: ${requestNo}`,
          body: [
            `Hello ${patient?.profiles?.full_name ?? "Patient"},`,
            "",
            `Your laboratory request (${requestNo}) from ${doctor?.profiles?.full_name ?? "Doc Kulot"} has been prepared.`,
            "Please present the attached PDF copy when having your lab / diagnostic tests done.",
            "",
            `You can also view this request in your patient portal: ${portalUrl}`,
          ].join("\n"),
          attachments: [
            {
              filename: fileName,
              content: Buffer.from(pdf).toString("base64"),
            },
          ],
        });
        emailedToPatient = true;
      }
    } catch (emailErr) {
      console.error("[laboratory-requests:auto-email] Failed to email laboratory request:", emailErr);
    }

    return ok({
      message: emailedToPatient
        ? `Laboratory request created and emailed to ${patient?.profiles?.email}.`
        : "Laboratory request created.",
      laboratory_request: {
        id: fileRow.id,
        request_no: requestNo,
        file_name: fileRow.file_name,
      },
      emailed: emailedToPatient,
    });
  } catch (error) {
    return httpError(error);
  }
}
