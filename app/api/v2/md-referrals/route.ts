import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { sendEmail } from "@/src/lib/services/notifier";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createMdReferralPdf,
  getMdReferralPdfFilename,
  type MdReferralPdfRow,
} from "@/src/lib/services/md-referral-pdf";
import type { DbRole } from "@/src/lib/db/types";

type Ctx = { params: Promise<Record<string, never>> };
type MdReferralPatientRow = {
  dob?: string | null;
  gender?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function canManageMdReferrals(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function referralNumberForAppointment(appointmentId: string) {
  return `REF-${appointmentId.slice(0, 8).toUpperCase()}`;
}

export async function POST(req: Request, _ctx: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!canManageMdReferrals(actor.profile.role)) {
      throw new HttpError(403, "Only doctors and admins can create MD referrals.");
    }

    const body = await req.json();
    const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id.trim() : "";
    const patientId = typeof body.patient_id === "string" ? body.patient_id.trim() : "";
    const doctorId = typeof body.doctor_id === "string" ? body.doctor_id.trim() : "";

    if (!appointmentId || !patientId || !doctorId) {
      throw new HttpError(400, "appointment_id, patient_id, and doctor_id are required.");
    }

    const referredSpecialty = normalizeText(body.referred_specialty) ?? "Internal Medicine";
    const referredDoctor = normalizeText(body.referred_doctor);
    const reasonForReferral = normalizeText(body.reason_for_referral) ?? "";
    const note = normalizeText(body.note);
    const visibleToPatient = body.released_to_patient ?? true;

    if (!reasonForReferral) {
      throw new HttpError(400, "Reason for referral is required.");
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

    if (appointment.patient_id !== patientId || appointment.doctor_id !== doctorId) {
      throw new HttpError(400, "Appointment, patient, and doctor details do not match.");
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("dob, gender, profiles(full_name, email)")
      .eq("id", appointment.patient_id)
      .single<MdReferralPatientRow>();
    if (patientError) throw patientError;

    const patientEmail = patient?.profiles?.email?.trim() ?? "";
    if (!patientEmail) {
      throw new HttpError(400, "Patient email is missing.");
    }

    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select("specialty, license_no, profiles(full_name)")
      .eq("id", appointment.doctor_id)
      .single<MdReferralPdfRow["doctors"]>();
    if (doctorError) throw doctorError;

    const settings = await readSystemSettings();
    const referralNo = referralNumberForAppointment(appointment.id);
    const now = new Date().toISOString();

    const pdf = createMdReferralPdf({
      referral_no: referralNo,
      created_at: now,
      referred_specialty: referredSpecialty,
      referred_doctor: referredDoctor,
      reason_for_referral: reasonForReferral,
      note,
      released_to_patient: Boolean(visibleToPatient),
      patients: patient,
      doctors: doctor,
      doctor_signature_data_url: settings.doctorSignatureDataUrl,
    });

    const fileName = getMdReferralPdfFilename(referralNo);
    const fileUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;

    const { data: fileRow, error: fileError } = await supabase
      .from("patient_files")
      .insert({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        file_name: fileName,
        file_url: fileUrl,
        file_type: "MD Referral",
        document_metadata: {
          referral_no: referralNo,
          referred_specialty: referredSpecialty,
          referred_doctor: referredDoctor,
          reason_for_referral: reasonForReferral,
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
      subject: `Doctor Referral Form: ${referralNo}`,
      body: [
        `Hello ${patient?.profiles?.full_name ?? "Patient"},`,
        "",
        `This is a confirmation that ${doctor?.profiles?.full_name ?? "your doctor"} has issued an MD Referral (${referralNo}) referring you to ${referredDoctor ? `${referredDoctor} (${referredSpecialty})` : referredSpecialty}.`,
        `A copy of the PDF referral form is attached to this email, and you can also view it in your patient portal: ${process.env.NEXT_PUBLIC_APP_URL?.trim() ? `${process.env.NEXT_PUBLIC_APP_URL.trim()}/profile/files` : "/profile/files"}`,
        "",
        Boolean(visibleToPatient)
          ? "The doctor referral form is available in your patient files."
          : "The doctor referral form is saved for the clinic record and was sent to you by email.",
      ].join("\n"),
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdf).toString("base64"),
        },
      ],
    });

    return ok(
      {
        md_referral: {
          id: fileRow.id,
          referral_no: referralNo,
          file_name: fileRow.file_name,
        },
      },
      201,
    );
  } catch (e) {
    return httpError(e);
  }
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get("appointment_id");
    const patientId = searchParams.get("patient_id");

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("patient_files")
      .select("id, patient_id, appointment_id, file_name, file_type, document_metadata, visible_to_patient, created_at")
      .eq("file_type", "MD Referral")
      .order("created_at", { ascending: false });

    if (actor.profile.role === "patient") {
      query = query.eq("patient_id", actor.profile.id).eq("visible_to_patient", true);
    } else if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    if (appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ok({ md_referrals: data });
  } catch (e) {
    return httpError(e);
  }
}
