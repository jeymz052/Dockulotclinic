import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("patient_files")
      .select("patient_id, appointment_id, file_name, document_metadata, visible_to_patient, created_at")
      .eq("id", id)
      .single<{
        patient_id: string;
        appointment_id: string | null;
        file_name: string;
        document_metadata: {
          referral_no?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          doctor_specialty?: string | null;
          doctor_license_no?: string | null;
          patient_name?: string | null;
          patient_dob?: string | null;
          patient_gender?: string | null;
          referred_specialty?: string | null;
          referred_doctor?: string | null;
          reason_for_referral?: string | null;
          note?: string | null;
        } | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Referral not found.");

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

    const metadata = data.document_metadata;
    const settings = await readSystemSettings();

    return Response.json({
      referralNo: metadata?.referral_no || data.file_name.replace(/\.pdf$/i, ""),
      doctorName: metadata?.doctor_name || "Dr. Fatimah Al-Zahra T. Ditti",
      doctorSpecialty: metadata?.doctor_specialty || "Family Medicine",
      doctorLicenseNo: metadata?.doctor_license_no || "0141185",
      doctorSignatureDataUrl: settings.doctorSignatureDataUrl,
      patientName: metadata?.patient_name || null,
      patientDob: metadata?.patient_dob || null,
      patientGender: metadata?.patient_gender || null,
      referredSpecialty: metadata?.referred_specialty || "Internal Medicine",
      referredDoctor: metadata?.referred_doctor || null,
      reasonForReferral: metadata?.reason_for_referral || null,
      note: metadata?.note || null,
      createdAt: data.created_at,
    });
  } catch (e) {
    return httpError(e);
  }
}
