import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { sendEmail } from "@/src/lib/services/notifier";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createMedicalCertificatePdf,
  getMedicalCertificatePdfFilename,
  type MedicalCertificatePdfRow,
} from "@/src/lib/services/medical-certificate-pdf";
import type { DbRole } from "@/src/lib/db/types";
import { hasAppointmentAddOn } from "@/src/lib/appointment-context";

type Ctx = { params: Promise<Record<string, never>> };
type MedicalCertificatePatientRow = {
  dob?: string | null;
  gender?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function canManageMedicalCertificates(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function certificateNumberForAppointment(appointmentId: string) {
  return `MC-${appointmentId.slice(0, 8).toUpperCase()}`;
}

export async function POST(req: Request, _ctx: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!canManageMedicalCertificates(actor.profile.role)) {
      throw new HttpError(403, "Only doctors and admins can create medical certificates.");
    }

    const body = await req.json();
    const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id.trim() : "";
    const patientId = typeof body.patient_id === "string" ? body.patient_id.trim() : "";
    const doctorId = typeof body.doctor_id === "string" ? body.doctor_id.trim() : "";

    if (!appointmentId || !patientId || !doctorId) {
      throw new HttpError(400, "appointment_id, patient_id, and doctor_id are required.");
    }

    const complaints = normalizeText(body.complaints) ?? "";
    const diagnosis = normalizeText(body.diagnosis) ?? "";
    const recommendation = normalizeText(body.recommendation) ?? "";
    const note = normalizeText(body.note);
    const visibleToPatient = body.released_to_patient ?? true;

    if (!diagnosis) {
      throw new HttpError(400, "Diagnosis is required.");
    }
    if (!recommendation) {
      throw new HttpError(400, "Recommendation is required.");
    }

    const supabase = getSupabaseAdmin();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, doctor_id, appointment_type, reason")
      .eq("id", appointmentId)
      .single<{
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_type: string;
        reason: string;
      }>();
    if (appointmentError) throw appointmentError;
    if (appointment.appointment_type !== "Online") {
      throw new HttpError(400, "Medical certificates are only available for virtual consultations.");
    }
    if (!hasAppointmentAddOn(appointment.reason, "Medical Certificate")) {
      throw new HttpError(400, "This virtual consultation does not include the medical certificate add-on.");
    }
    if (appointment.patient_id !== patientId || appointment.doctor_id !== doctorId) {
      throw new HttpError(400, "Appointment, patient, and doctor details do not match.");
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("dob, gender, profiles(full_name, email)")
      .eq("id", appointment.patient_id)
      .single<MedicalCertificatePatientRow>();
    if (patientError) throw patientError;

    const patientEmail = patient?.profiles?.email?.trim() ?? "";
    if (!patientEmail) {
      throw new HttpError(400, "Patient email is missing.");
    }

    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("specialty, license_no, profiles(full_name)")
      .eq("id", appointment.doctor_id)
      .single<MedicalCertificatePdfRow["doctors"]>();
    if (doctorError) throw doctorError;

    const settings = await readSystemSettings();
    const certificateNo = certificateNumberForAppointment(appointment.id);
    const now = new Date().toISOString();
    const pdf = createMedicalCertificatePdf({
      certificate_no: certificateNo,
      created_at: now,
      complaints,
      diagnosis,
      recommendation,
      note,
      released_to_patient: Boolean(visibleToPatient),
      patients: patient,
      doctors: doctor,
      doctor_signature_data_url: settings.doctorSignatureDataUrl,
    });
    const fileName = getMedicalCertificatePdfFilename(certificateNo);
    const fileUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;

    const { data: fileRow, error: fileError } = await supabase
      .from("patient_files")
      .insert({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        file_name: fileName,
        file_url: fileUrl,
        file_type: "Medical Certificate",
        document_metadata: {
          certificate_no: certificateNo,
          complaints,
          diagnosis,
          recommendation,
          note,
          doctor_id: appointment.doctor_id,
          doctor_name: doctor?.profiles?.full_name ?? null,
          doctor_specialty: doctor?.specialty ?? null,
          doctor_license_no: doctor?.license_no ?? null,
          patient_name: patient?.profiles?.full_name ?? null,
          patient_dob: patient?.dob ?? null,
          patient_gender: patient?.gender ?? null,
        },
        visible_to_patient: Boolean(visibleToPatient),
      })
      .select("id, file_name")
      .single<{ id: string; file_name: string }>();
    if (fileError) throw fileError;

    await sendEmail({
      to: patientEmail,
      subject: `Medical certificate confirmation: ${certificateNo}`,
      body: [
        `Hello ${patient?.profiles?.full_name ?? "Patient"},`,
        "",
        `This is a confirmation that ${doctor?.profiles?.full_name ?? "your doctor"} has emailed your medical certificate ${certificateNo}.`,
        `A copy of the PDF is attached to this email, and you can also view your files in the patient portal: ${process.env.NEXT_PUBLIC_APP_URL?.trim() ? `${process.env.NEXT_PUBLIC_APP_URL.trim()}/profile/files` : "/profile/files"}`,
        "",
        Boolean(visibleToPatient)
          ? "The medical certificate is available in your patient files."
          : "The medical certificate is saved for the clinic record and was sent to you by email.",
      ].join("\n"),
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdf).toString("base64"),
        },
      ],
    });

    return ok({
      medical_certificate: {
        id: fileRow.id,
        certificate_no: certificateNo,
        file_name: fileRow.file_name,
      },
    }, 201);
  } catch (e) {
    return httpError(e);
  }
}
