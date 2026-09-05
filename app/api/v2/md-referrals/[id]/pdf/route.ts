import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createMdReferralPdf,
  getMdReferralPdfFilename,
  type MdReferralPdfRow,
} from "@/src/lib/services/md-referral-pdf";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

type Ctx = { params: Promise<{ id: string }> };

function decodePdfDataUrl(dataUrl: string) {
  const match = dataUrl.trim().match(/^data:application\/pdf;base64,(.+)$/i);
  if (!match?.[1]) return null;
  return Buffer.from(match[1], "base64");
}

type ReferralMetadata = {
  referral_no?: string;
  doctor_id?: string | null;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  doctor_license_no?: string | null;
  patient_name?: string | null;
  patient_dob?: string | null;
  patient_gender?: string | null;
  referred_specialty?: string;
  referred_doctor?: string | null;
  reason_for_referral?: string;
  note?: string | null;
};

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("patient_files")
      .select("id, patient_id, appointment_id, file_name, file_url, file_type, document_metadata, visible_to_patient, created_at")
      .eq("id", id)
      .single<{
        id: string;
        patient_id: string;
        appointment_id: string | null;
        file_name: string;
        file_url: string;
        file_type: string;
        document_metadata: ReferralMetadata | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data || data.file_type !== "MD Referral") {
      throw new HttpError(404, "MD Referral not found.");
    }

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

    const metadata = data.document_metadata;
    const referralNo = metadata?.referral_no || data.file_name.replace(/\.pdf$/i, "");
    let doctorId = metadata?.doctor_id ?? null;

    if (!doctorId && data.appointment_id) {
      const { data: appointmentRow } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("id", data.appointment_id)
        .maybeSingle<{ doctor_id: string }>();
      doctorId = appointmentRow?.doctor_id ?? null;
    }

    const [patientRes, doctorRes, settings] = await Promise.all([
      supabase
        .from("patients")
        .select("dob, gender, profiles(full_name)")
        .eq("id", data.patient_id)
        .maybeSingle<MdReferralPdfRow["patients"]>(),
      doctorId
        ? supabase
            .from("doctors")
            .select("id, specialty, license_no, profiles(full_name)")
            .eq("id", doctorId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      readSystemSettings(),
    ]);

    const patient = patientRes.data ?? {
      dob: metadata?.patient_dob ?? null,
      gender: metadata?.patient_gender ?? null,
      profiles: { full_name: metadata?.patient_name ?? "Patient" },
    };

    const doctorRow = doctorRes.data;
    const doctor = doctorRow
      ? {
          specialty: doctorRow.specialty,
          license_no: doctorRow.license_no,
          profiles: Array.isArray(doctorRow.profiles) ? doctorRow.profiles[0] ?? null : doctorRow.profiles,
        }
      : {
          specialty: metadata?.doctor_specialty ?? "Family Medicine",
          license_no: metadata?.doctor_license_no ?? "0141185",
          profiles: { full_name: metadata?.doctor_name ?? "Dr. Fatimah Al-Zahra T. Ditti" },
        };

    const pdf = createMdReferralPdf({
      referral_no: referralNo,
      created_at: data.created_at,
      referred_specialty: metadata?.referred_specialty || "Internal Medicine",
      referred_doctor: metadata?.referred_doctor || null,
      reason_for_referral: metadata?.reason_for_referral || metadata?.note || "Clinical consultation and management.",
      note: metadata?.note ?? null,
      released_to_patient: data.visible_to_patient,
      patients: patient,
      doctors: doctor,
      doctor_signature_data_url: settings.doctorSignatureDataUrl,
    });

    // Update stored file_url asynchronously with the clean Doc Kulot PDF
    const cleanFileUrl = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;
    if (data.file_url !== cleanFileUrl) {
      void supabase
        .from("patient_files")
        .update({ file_url: cleanFileUrl })
        .eq("id", data.id)
        .then(() => {});
    }

    const filename = getMdReferralPdfFilename(referralNo);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
