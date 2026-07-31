import { HttpError, httpError, ok, requireRole } from "@/src/lib/http";
import { slugifyDoctorName } from "@/src/lib/server/doctor-identity";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { logActivity } from "@/src/lib/services/activity-log";
import type { DbRole } from "@/src/lib/db/types";

const CANONICAL_DOCTOR_SPECIALTY = "Family Medicine and Aesthetic Medicine";

type UpdateUserBody = {
  full_name?: string;
  phone?: string | null;
  role?: DbRole; // super_admin|staff|doctor|patient|admin|secretary
  is_active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(req, ["super_admin", "secretary", "doctor"]);
    const { id } = await ctx.params;
    if (!id) throw new HttpError(400, "Missing user id");

    const body = (await req.json()) as UpdateUserBody;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid payload");

    const updates: Record<string, unknown> = {};
    if (body.full_name != null) updates.full_name = body.full_name;
    if ("phone" in body) updates.phone = body.phone ?? null;
    if (body.role != null) updates.role = body.role;
    if (body.is_active != null) updates.is_active = body.is_active;

    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, "No updates provided");
    }

    const supabase = getSupabaseAdmin();
    const { data: currentUser, error: currentUserError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle<{ role: DbRole }>();
    if (currentUserError) throw currentUserError;

    // Prevent locking yourself out accidentally
    if (actor.id === id && updates.is_active === false) {
      throw new HttpError(400, "You cannot deactivate your own account.");
    }
    if (currentUser?.role === "doctor" && body.role && body.role !== "doctor") {
      throw new HttpError(400, "The clinic doctor account must remain assigned to the doctor role.");
    }

    if (body.role === "doctor" && currentUser?.role !== "doctor") {
      const { data: existingDoctor, error: existingDoctorError } = await supabase
        .from("doctors")
        .select("id")
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (existingDoctorError) throw existingDoctorError;
      if (existingDoctor) {
        throw new HttpError(400, "This clinic is configured for a single doctor only.");
      }

      const { error: insertDoctorError } = await supabase.from("doctors").insert({
        id,
        slug: slugifyDoctorName(body.full_name ?? `doctor-${id}`),
        specialty: CANONICAL_DOCTOR_SPECIALTY,
        license_no: `AUTO-${id}`,
        consultation_fee_clinic: 600,
        consultation_fee_online: 800,
      });
      if (insertDoctorError) throw insertDoctorError;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    // If role is changed, keep auth.app_metadata.role in sync (trusted role source).
    if (body.role) {
      await supabase.auth.admin.updateUserById(id, {
        app_metadata: { role: body.role },
      });
    }

    await logActivity({
      actor,
      action: "users.update",
      entity_table: "profiles",
      entity_id: id,
      metadata: {
        fields: Object.keys(updates),
        role: body.role,
        is_active: body.is_active,
      },
    });

    return ok({ user: data });
  } catch (e) {
    return httpError(e);
  }
}

