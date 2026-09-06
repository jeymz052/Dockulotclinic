import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  try {
    return await requireAuthenticatedUser(token);
  } catch {
    return null;
  }
}

/** GET /api/messages/conversations — list all conversations for the current user */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const userId = auth.user.id;

  let query = supabase
    .from("message_conversations")
    .select(
      `id,
       patient_id,
       clinic_user_id,
       last_message_at,
       last_message_preview,
       unread_clinic,
       unread_patient,
       created_at,
       patient:profiles!message_conversations_patient_id_fkey(id, full_name, avatar_url, last_seen_at),
       clinic_user:profiles!message_conversations_clinic_user_id_fkey(id, full_name, avatar_url, last_seen_at)`
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (auth.role === "PATIENT") {
    query = query.eq("patient_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[GET /api/messages/conversations]", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (auth.role === "PATIENT" && (!data || data.length === 0)) {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (doctor) {
      const { data: newConv } = await supabase
        .from("message_conversations")
        .upsert(
          { patient_id: userId, clinic_user_id: doctor.id },
          { onConflict: "patient_id,clinic_user_id" }
        )
        .select(
          `id,
           patient_id,
           clinic_user_id,
           last_message_at,
           last_message_preview,
           unread_clinic,
           unread_patient,
           created_at,
           patient:profiles!message_conversations_patient_id_fkey(id, full_name, avatar_url, last_seen_at),
           clinic_user:profiles!message_conversations_clinic_user_id_fkey(id, full_name, avatar_url, last_seen_at)`
        )
        .maybeSingle();

      if (newConv) {
        return NextResponse.json({ conversations: [newConv] });
      }
    }
  }

  return NextResponse.json({ conversations: data ?? [] });
}

/** POST /api/messages/conversations — create or return existing conversation */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.send")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { patient_id?: string };
  const supabase = getSupabaseAdmin();

  let patientId: string;
  let clinicUserId: string;

  if (auth.role === "PATIENT") {
    // Patient initiates — find the first available doctor as clinic_user
    patientId = auth.user.id;
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!doctor) {
      return NextResponse.json({ message: "No clinic user available" }, { status: 404 });
    }
    clinicUserId = doctor.id;
  } else {
    // Clinic staff initiates — patient_id, appointment_id, or patient_email can be supplied
    let resolvedPatientId = body.patient_id;

    if (!resolvedPatientId && (body as { appointment_id?: string }).appointment_id) {
      const { data: appt } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("id", (body as { appointment_id?: string }).appointment_id)
        .maybeSingle<{ patient_id: string }>();
      if (appt?.patient_id) {
        resolvedPatientId = appt.patient_id;
      }
    }

    if (!resolvedPatientId && (body as { patient_email?: string }).patient_email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", (body as { patient_email?: string }).patient_email)
        .maybeSingle<{ id: string }>();
      if (prof?.id) {
        resolvedPatientId = prof.id;
      }
    }

    if (!resolvedPatientId) {
      return NextResponse.json(
        { message: "patient_id or appointment_id is required" },
        { status: 400 }
      );
    }
    patientId = resolvedPatientId;
    clinicUserId = auth.user.id;
  }

  // Upsert conversation
  const { data, error } = await supabase
    .from("message_conversations")
    .upsert(
      { patient_id: patientId, clinic_user_id: clinicUserId },
      { onConflict: "patient_id,clinic_user_id", ignoreDuplicates: false }
    )
    .select(
      `id, patient_id, clinic_user_id, last_message_at, last_message_preview,
       unread_clinic, unread_patient, created_at,
       patient:profiles!message_conversations_patient_id_fkey(id, full_name, avatar_url, last_seen_at),
       clinic_user:profiles!message_conversations_clinic_user_id_fkey(id, full_name, avatar_url, last_seen_at)`
    )
    .maybeSingle();

  if (error) {
    console.error("[POST /api/messages/conversations]", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data }, { status: 201 });
}
