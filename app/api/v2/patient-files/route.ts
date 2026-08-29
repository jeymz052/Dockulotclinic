import { httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);

    let query = supabase
      .from("patient_files")
      .select("id, patient_id, appointment_id, file_name, file_url, file_type, document_metadata, visible_to_patient, created_at")
      .order("created_at", { ascending: false });

    if (actor.profile.role === "patient") {
      query = query.eq("patient_id", actor.id).eq("visible_to_patient", true);
    } else if (url.searchParams.get("patient_id")) {
      query = query.eq("patient_id", url.searchParams.get("patient_id"));
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    return ok({ files: data ?? [] });
  } catch (e) {
    return httpError(e);
  }
}
