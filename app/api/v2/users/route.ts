import { randomBytes } from "node:crypto";
import { HttpError, httpError, ok, requireRole } from "@/src/lib/http";
import { slugifyDoctorName } from "@/src/lib/server/doctor-identity";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { logActivity } from "@/src/lib/services/activity-log";
import type { DbRole, Profile } from "@/src/lib/db/types";

const CANONICAL_DOCTOR_SPECIALTY = "Family Medicine and Aesthetic Medicine";

type CreateUserBody = {
  email: string;
  full_name: string;
  phone?: string | null;
  role: "super_admin" | "staff" | "doctor";
  doctor?: {
    specialty?: string;
    license_no?: string;
    consultation_fee_clinic?: number;
    consultation_fee_online?: number;
  };
};

function assertCreateBody(body: unknown): CreateUserBody {
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid payload");
  const b = body as Partial<CreateUserBody>;
  if (!b.email || !b.full_name || !b.role) {
    throw new HttpError(400, "email, full_name, role required");
  }
  if (b.role !== "super_admin" && b.role !== "staff" && b.role !== "doctor") {
    throw new HttpError(400, "role must be super_admin, staff, or doctor");
  }
  return b as CreateUserBody;
}

function createTemporaryPassword() {
  return `Tmp-${randomBytes(8).toString("base64url")}!9Aa`;
}

export async function GET(req: Request) {
  try {
    await requireRole(req, ["super_admin", "secretary", "doctor"]);
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const role = url.searchParams.get("role")?.trim() as DbRole | null;
    const active = url.searchParams.get("active"); // null | "true" | "false"

    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (q) {
      // Search by email or name (simple, fast)
      query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    }
    if (role && ["super_admin", "secretary", "staff", "doctor", "patient", "admin"].includes(role)) {
      query = query.eq("role", role);
    }
    if (active === "true") query = query.eq("is_active", true);
    if (active === "false") query = query.eq("is_active", false);

    const { data, error } = await query;
    if (error) throw error;
    return ok({ users: (data ?? []) as Profile[] });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireRole(req, ["super_admin", "secretary", "doctor"]);
    const body = assertCreateBody(await req.json());

    const supabase = getSupabaseAdmin();
    const tempPassword = createTemporaryPassword();

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      phone: body.phone ?? undefined,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
      app_metadata: { role: body.role },
    });
    if (createError || !created.user) {
      throw new HttpError(400, createError?.message ?? "Unable to create user");
    }

    // Ensure profile matches (trigger should create it, but we patch phone + role anyway).
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: body.full_name,
        phone: body.phone ?? null,
        role: body.role,
        is_active: true,
      })
      .eq("id", created.user.id);
    if (profileError) throw profileError;

    if (body.role === "doctor") {
      const { data: existingDoctor, error: existingDoctorError } = await supabase
        .from("doctors")
        .select("id")
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (existingDoctorError) throw existingDoctorError;
      if (existingDoctor) {
        throw new HttpError(400, "This clinic is configured for a single doctor only.");
      }

      const doctorPayload = body.doctor;
      const doctorSlug = slugifyDoctorName(body.full_name);
      const { error: doctorError } = await supabase.from("doctors").insert({
        id: created.user.id,
        slug: doctorSlug,
        specialty: doctorPayload?.specialty?.trim() || CANONICAL_DOCTOR_SPECIALTY,
        // doctors.license_no is unique + non-null in schema, so fallback must be unique.
        license_no: doctorPayload?.license_no?.trim() || `AUTO-${created.user.id}`,
        consultation_fee_clinic: doctorPayload?.consultation_fee_clinic ?? 0,
        consultation_fee_online: doctorPayload?.consultation_fee_online ?? 0,
      });
      if (doctorError) throw doctorError;
    }

    await logActivity({
      actor,
      action: "users.create",
      entity_table: "profiles",
      entity_id: created.user.id,
      metadata: { role: body.role },
    });

    return ok(
      {
        user_id: created.user.id,
        temp_password: tempPassword,
        created_by: actor.id,
      },
      201,
    );
  } catch (e) {
    return httpError(e);
  }
}

