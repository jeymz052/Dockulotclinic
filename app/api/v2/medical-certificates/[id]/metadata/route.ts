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
          certificate_no?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          doctor_specialty?: string | null;
          doctor_license_no?: string | null;
          patient_name?: string | null;
          patient_dob?: string | null;
          patient_gender?: string | null;
          complaints?: string | null;
          diagnosis?: string | null;
          recommendation?: string | null;
          note?: string | null;
        } | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Certificate not found.");

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

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

    const { data: patient } = await supabase
      .from("patients")
      .select("dob, gender, profiles(full_name)")
      .eq("id", data.patient_id)
      .maybeSingle<{ dob?: string | null; gender?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null }>();

    const patientProfile = Array.isArray(patient?.profiles) ? patient?.profiles[0] : patient?.profiles;
    const patientName = patientProfile?.full_name ?? metadata?.patient_name ?? null;
    const patientDob = patient?.dob ?? metadata?.patient_dob ?? null;
    const patientGender = patient?.gender ?? metadata?.patient_gender ?? null;

    const settings = await readSystemSettings();

    let doctorRow: { specialty?: string | null; license_no?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null } | null = null;

    if (doctorId || appointment) {
      const { data: prescriptionRows } = appointment
        ? await supabase
            .from("prescriptions")
            .select("doctor_id")
            .eq("appointment_id", appointment.id)
            .order("created_at", { ascending: false })
            .limit(5)
        : { data: [] };

      const doctorIds = [
        ...(prescriptionRows ?? []).map((row) => row.doctor_id),
        doctorId,
      ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

      if (doctorIds.length > 0) {
        const { data: doctors } = await supabase
          .from("doctors")
          .select("specialty, license_no, profiles(full_name)")
          .in("id", doctorIds);

        doctorRow = (doctors ?? []).find((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return !/not recorded/i.test(profile?.full_name ?? "");
        }) ?? doctors?.[0] ?? null;
      }
    }

    if (!doctorRow) {
      const { data: fallbackDoctors } = await supabase
        .from("doctors")
        .select("specialty, license_no, profiles(full_name)")
        .limit(5);

      doctorRow = (fallbackDoctors ?? []).find((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return !/not recorded/i.test(profile?.full_name ?? "");
      }) ?? fallbackDoctors?.[0] ?? null;
    }

    const doctorProfile = Array.isArray(doctorRow?.profiles) ? doctorRow?.profiles[0] : doctorRow?.profiles;
    const doctorName = doctorProfile?.full_name ?? metadata?.doctor_name ?? "Dr. Fatimah Al-Zahra T. Ditti";
    const doctorSpecialty = doctorRow?.specialty ?? metadata?.doctor_specialty ?? "Family and Aesthetic Medicine Specialist";
    const doctorLicenseNo = doctorRow?.license_no ?? metadata?.doctor_license_no ?? "0141185";

    return Response.json({
      certificateNo,
      doctorName,
      doctorSpecialty,
      doctorLicenseNo,
      doctorSignatureDataUrl: settings.doctorSignatureDataUrl ?? null,
      patientName,
      patientDob,
      patientGender,
      complaints: metadata?.complaints ?? null,
      diagnosis: metadata?.diagnosis ?? null,
      recommendation: metadata?.recommendation ?? null,
      note: metadata?.note ?? null,
      createdAt: data.created_at,
    });
  } catch (e) {
    return httpError(e);
  }
}
