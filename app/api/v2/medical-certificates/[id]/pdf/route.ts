import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createMedicalCertificatePdf,
  getMedicalCertificatePdfFilename,
  type MedicalCertificatePdfRow,
} from "@/src/lib/services/medical-certificate-pdf";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

type Ctx = { params: Promise<{ id: string }> };

function decodePdfDataUrl(dataUrl: string) {
  const match = dataUrl.trim().match(/^data:application\/pdf;base64,(.+)$/i);
  if (!match?.[1]) return null;
  return Buffer.from(match[1], "base64");
}

type CertificateMetadata = {
  certificate_no?: string;
  doctor_id?: string | null;
  complaints?: string;
  diagnosis?: string;
  recommendation?: string;
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
        document_metadata: CertificateMetadata | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data || data.file_type !== "Medical Certificate") {
      throw new HttpError(404, "Medical certificate not found.");
    }

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

    let pdf = decodePdfDataUrl(data.file_url);
    const metadata = data.document_metadata;
    const certificateNo = metadata?.certificate_no || data.file_name.replace(/\.pdf$/i, "");
    let doctorId = metadata?.doctor_id ?? null;
    let appointment: { id: string; doctor_id: string } | null = null;
    if (data.appointment_id) {
      const { data: appointmentRow, error: appointmentError } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("id", data.appointment_id)
        .maybeSingle<{ doctor_id: string }>();
      if (appointmentError) throw appointmentError;
      appointment = appointmentRow ? { id: data.appointment_id, ...appointmentRow } : null;
      doctorId = appointment?.doctor_id ?? doctorId;
    } else {
      const appointmentPrefix = certificateNo.replace(/^MC-/i, "").toLowerCase();
      if (appointmentPrefix) {
        const { data: appointmentRows, error: appointmentError } = await supabase
          .from("appointments")
          .select("id, doctor_id")
          .limit(500);
        if (appointmentError) throw appointmentError;
        appointment = appointmentRows?.find((row) => {
          const appointmentId = String((row as { id?: string }).id ?? "").toLowerCase();
          return appointmentId.startsWith(appointmentPrefix);
        }) as { id: string; doctor_id: string } | undefined ?? null;
        doctorId = appointment?.doctor_id ?? doctorId;
      }
    }
    if (appointment || doctorId) {
      const { data: prescriptionRows, error: prescriptionError } = appointment
        ? await supabase.from("prescriptions").select("doctor_id").eq("appointment_id", appointment.id).order("created_at", { ascending: false }).limit(5)
        : { data: [], error: null };
      if (prescriptionError) throw prescriptionError;
      const doctorIds = [
        ...(prescriptionRows ?? []).map((row) => row.doctor_id),
        doctorId,
      ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
      if (doctorIds.length === 0) {
        throw new HttpError(404, "Doctor record not found for this certificate.");
      }
      const [{ data: patient, error: patientError }, { data: doctors, error: doctorsError }, settings] = await Promise.all([
        supabase.from("patients").select("dob, gender, profiles(full_name)").eq("id", data.patient_id).single<MedicalCertificatePdfRow["patients"]>(),
        supabase.from("doctors").select("id, specialty, license_no, profiles(full_name)").in("id", doctorIds),
        readSystemSettings(),
      ]);
      if (patientError) throw patientError;
      if (doctorsError) throw doctorsError;
      const doctorRow = (doctors ?? []).find((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return !/not recorded/i.test(profile?.full_name ?? "");
      }) ?? doctors?.[0];
      if (!doctorRow) throw new HttpError(404, "Doctor record not found for this certificate.");
      const doctor = {
        specialty: doctorRow.specialty,
        license_no: doctorRow.license_no,
        profiles: Array.isArray(doctorRow.profiles) ? doctorRow.profiles[0] ?? null : doctorRow.profiles,
      };
      pdf = createMedicalCertificatePdf({
        certificate_no: certificateNo,
        created_at: data.created_at,
        complaints: metadata?.complaints ?? null,
        diagnosis: metadata?.diagnosis ?? null,
        recommendation: metadata?.recommendation ?? null,
        note: metadata?.note ?? null,
        released_to_patient: data.visible_to_patient,
        patients: patient,
        doctors: doctor,
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      });
    }
    if (!pdf) {
      throw new HttpError(500, "Stored medical certificate PDF is invalid.");
    }

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.file_name || getMedicalCertificatePdfFilename(data.id)}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
