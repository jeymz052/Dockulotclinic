import { HttpError, httpError, requireActor } from "@/src/lib/http";
import {
  createPrescriptionPdf,
  getPrescriptionPdfFilename,
  type PrescriptionPdfRow,
} from "@/src/lib/services/prescription-pdf";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { DbRole } from "@/src/lib/db/types";

type Ctx = { params: Promise<{ id: string }> };

function canManagePrescriptions(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("prescriptions")
      .select("*, diagnoses(diagnosis_text, treatment_plan, follow_up_date), prescription_items(*), patients(profiles(full_name)), doctors(profiles(full_name))")
      .eq("id", id)
      .maybeSingle<PrescriptionPdfRow>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Prescription not found.");

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.released_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (!canManagePrescriptions(actor.profile.role)) {
      throw new HttpError(403, "Forbidden");
    }

    const pdf = createPrescriptionPdf(data);
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
