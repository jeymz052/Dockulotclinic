import { httpError, ok } from "@/src/lib/http";
import {
  normalizeConfiguredClinicConsultationRate,
  normalizeConfiguredOnlineConsultationRate,
} from "@/src/lib/consultation-pricing";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

const FALLBACK_DOCTOR_SPECIALTY = "Family Medicine and Aesthetic Medicine";

type DoctorRow = {
  id: string;
  slug: string | null;
  specialty: string | null;
  license_no: string;
  consultation_fee_clinic: number | null;
  consultation_fee_online: number | null;
  profiles:
    | {
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
        is_active?: boolean | null;
      }
    | Array<{
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
        is_active?: boolean | null;
      }>
    | null;
};

function pickProfile(row: DoctorRow) {
  if (Array.isArray(row.profiles)) return row.profiles[0] ?? null;
  return row.profiles ?? null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("doctors")
      .select("id, slug, specialty, license_no, consultation_fee_clinic, consultation_fee_online, profiles!inner(full_name, email, phone, is_active)")
      .eq("profiles.is_active", true)
      .order("id", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as DoctorRow[];

    return ok({
      doctors: rows.map((doctor) => {
        const profile = pickProfile(doctor);
        const fullName = profile?.full_name?.trim() || "Doctor";

        return {
          id: doctor.id,
          slug: doctor.slug ?? doctor.id,
          name: fullName,
          full_name: fullName,
          specialty: doctor.specialty?.trim() || FALLBACK_DOCTOR_SPECIALTY,
          license_no: doctor.license_no,
          consultation_fee_clinic: normalizeConfiguredClinicConsultationRate(Number(doctor.consultation_fee_clinic ?? 0)),
          consultation_fee_online: normalizeConfiguredOnlineConsultationRate(Number(doctor.consultation_fee_online ?? 0)),
          profiles: {
            full_name: fullName,
            email: profile?.email ?? "",
            phone: profile?.phone ?? "",
            is_active: profile?.is_active ?? true,
          },
        };
      }),
    });
  } catch (e) {
    return httpError(e);
  }
}
