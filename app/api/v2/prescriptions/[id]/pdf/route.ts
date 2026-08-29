import { HttpError, httpError, requireActor } from "@/src/lib/http";
import {
  createPrescriptionPdf,
  getPrescriptionPdfFilename,
  type PrescriptionPdfRow,
} from "@/src/lib/services/prescription-pdf";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { DbRole } from "@/src/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

function canManagePrescriptions(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

async function assertVirtualConsultationAppointment(supabase: ReturnType<typeof getSupabaseAdmin>, appointmentId: string | null) {
  if (!appointmentId) {
    throw new HttpError(400, "Prescriptions are only available for virtual consultations.");
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("appointment_type")
    .eq("id", appointmentId)
    .single<{ appointment_type: string }>();
  if (error) throw error;
  if (appointment.appointment_type !== "Online") {
    throw new HttpError(400, "Prescriptions are only available for virtual consultations.");
  }
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    type PrescriptionPdfRowWithAppointment = PrescriptionPdfRow & { appointment_id: string | null };

    const { data, error } = await supabase
      .from("prescriptions")
      .select("*, diagnoses(diagnosis_text, treatment_plan, follow_up_date), prescription_items(*), patients(dob, gender, profiles(full_name)), doctors(specialty, license_no, profiles(full_name))")
      .eq("id", id)
      .maybeSingle<PrescriptionPdfRowWithAppointment>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Prescription not found.");
    await assertVirtualConsultationAppointment(supabase, data.appointment_id);

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.released_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (!canManagePrescriptions(actor.profile.role)) {
      throw new HttpError(403, "Forbidden");
    }

    const settings = await readSystemSettings();
    const pdf = createPrescriptionPdf({ ...data, doctor_signature_data_url: settings.doctorSignatureDataUrl });
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getPrescriptionPdfFilename(data.prescription_no)}"`,
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
