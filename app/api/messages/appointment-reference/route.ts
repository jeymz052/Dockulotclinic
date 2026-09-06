import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { hasPermission } from "@/src/lib/auth/permissions";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const auth = await requireAuthenticatedUser(token).catch(() => null);
  if (!auth || !hasPermission(auth.role, "messages.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const appointmentId = url.searchParams.get("id");
  if (!appointmentId) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select(`
      id, patient_id, appointment_date, start_time, end_time, appointment_type,
      reason, status, queue_number, meeting_link,
      patients!inner(profiles!inner(id, full_name, email, phone))
    `)
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !appt) {
    // Try fallback query without inner join
    const { data: rawAppt, error: rawErr } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, start_time, end_time, appointment_type, reason, status, queue_number, meeting_link")
      .eq("id", appointmentId)
      .maybeSingle();

    if (rawErr || !rawAppt) {
      return NextResponse.json({ message: "Appointment not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", rawAppt.patient_id)
      .maybeSingle();

    const { data: note } = await supabase
      .from("consultation_notes")
      .select("diagnosis, notes, prescription")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    return NextResponse.json({
      reference: {
        id: rawAppt.id,
        patientId: rawAppt.patient_id,
        patientName: profile?.full_name || "Patient",
        patientEmail: profile?.email || null,
        date: rawAppt.appointment_date,
        start: rawAppt.start_time?.slice(0, 5),
        end: rawAppt.end_time?.slice(0, 5),
        type: rawAppt.appointment_type,
        reason: rawAppt.reason,
        status: rawAppt.status,
        diagnosis: note?.diagnosis || null,
        notes: note?.notes || null,
        prescription: note?.prescription || null,
      },
    });
  }

  const patientProfile = (appt as any).patients?.profiles;

  const { data: note } = await supabase
    .from("consultation_notes")
    .select("diagnosis, notes, prescription")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  return NextResponse.json({
    reference: {
      id: appt.id,
      patientId: appt.patient_id,
      patientName: patientProfile?.full_name || "Patient",
      patientEmail: patientProfile?.email || null,
      date: appt.appointment_date,
      start: appt.start_time?.slice(0, 5),
      end: appt.end_time?.slice(0, 5),
      type: appt.appointment_type,
      reason: appt.reason,
      status: appt.status,
      diagnosis: note?.diagnosis || null,
      notes: note?.notes || null,
      prescription: note?.prescription || null,
    },
  });
}
