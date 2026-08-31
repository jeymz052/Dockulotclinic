import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import {
  createProcedureAftercarePdf,
  getProcedureAftercarePdfFilename,
  type ProcedureAftercarePdfRow,
} from "@/src/lib/services/procedure-consent-pdf";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("patient_procedure_consents")
      .select("id, patient_id, procedure_name, patient_name, aftercare_guide_title, aftercare_acknowledged, signed_at")
      .eq("id", id)
      .maybeSingle<ProcedureAftercarePdfRow>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Procedure aftercare instructions not found.");

    if (actor.profile.role === "patient" && data.patient_id !== actor.id) {
      throw new HttpError(403, "Forbidden");
    }

    const settings = await readSystemSettings();
    const pdf = createProcedureAftercarePdf({
      ...data,
      doctor_signature_data_url: settings.doctorSignatureDataUrl,
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${new URL(req.url).searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${getProcedureAftercarePdfFilename(data.procedure_name)}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
