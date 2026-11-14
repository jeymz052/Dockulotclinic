import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

// DELETE: Remove an existing photo or file
export async function DELETE(req: Request) {
  try {
    const actor = await requireActor(req);
    const role = actor.profile.role;
    if (role !== "super_admin" && role !== "admin" && role !== "staff" && role !== "secretary" && role !== "doctor") {
      throw new HttpError(403, "Only clinic staff can delete patient photos.");
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("id");
    if (!fileId) {
      throw new HttpError(400, "File id is required.");
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("patient_files").delete().eq("id", fileId);
    if (error) throw error;

    return ok({ message: "Photo deleted successfully" });
  } catch (e) {
    return httpError(e);
  }
}

// POST: Upload or Replace photo
export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const role = actor.profile.role;
    if (role !== "super_admin" && role !== "admin" && role !== "staff" && role !== "secretary" && role !== "doctor") {
      throw new HttpError(403, "Only clinic staff can upload patient procedure photos.");
    }

    const form = await req.formData();
    const file = form.get("file");
    const patientId = form.get("patient_id");
    const appointmentId = form.get("appointment_id");
    const stage = form.get("stage") || "pre_procedure"; // 'pre_procedure' | 'post_procedure' | 'general'
    const notes = form.get("notes") || "";
    const replaceFileId = form.get("replace_file_id"); // Optional ID of photo being replaced

    if (!(file instanceof File)) {
      throw new HttpError(400, "File is required.");
    }
    if (!patientId || typeof patientId !== "string") {
      throw new HttpError(400, "patient_id is required.");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowed = ["png", "jpg", "jpeg", "webp", "avif"];
    if (!allowed.includes(ext)) {
      throw new HttpError(400, `Unsupported image type: .${ext}. Only image files are allowed.`);
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new HttpError(400, "Photo must be 15 MB or smaller.");
    }

    const stageLabel = stage === "post_procedure" ? "post-procedure" : stage === "pre_procedure" ? "pre-procedure" : "photo";
    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "ehr-photo";

    const path = `ehr-photos/${patientId}/${Date.now()}-${stageLabel}-${safeName}.${ext}`;
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("landing-assets")
      .upload(path, buffer, {
        contentType: file.type || `image/${ext}`,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from("landing-assets").getPublicUrl(path);
    const photoUrl = pub.publicUrl;

    const readableType = stage === "pre_procedure"
      ? "Pre-Procedure Photo"
      : stage === "post_procedure"
        ? "Post-Procedure Photo"
        : "Clinical Photo";

    const fileNameWithStage = `${readableType} - ${file.name}`;

    // If replaceFileId is provided, delete the old file record
    if (typeof replaceFileId === "string" && replaceFileId.trim()) {
      await supabase.from("patient_files").delete().eq("id", replaceFileId.trim());
    }

    const { data: fileRow, error: dbError } = await supabase
      .from("patient_files")
      .insert({
        patient_id: patientId,
        appointment_id: typeof appointmentId === "string" && appointmentId.trim() ? appointmentId.trim() : null,
        file_name: fileNameWithStage,
        file_url: photoUrl,
        file_type: readableType,
        document_metadata: {
          photo_stage: stage,
          notes: typeof notes === "string" ? notes.trim() : "",
          uploaded_by: actor.id,
          uploaded_by_name: actor.profile.full_name,
        },
        visible_to_patient: true,
      })
      .select("id, patient_id, appointment_id, file_name, file_url, file_type, document_metadata, created_at")
      .single();

    if (dbError) throw dbError;

    return ok({ photo: fileRow }, 201);
  } catch (e) {
    return httpError(e);
  }
}
