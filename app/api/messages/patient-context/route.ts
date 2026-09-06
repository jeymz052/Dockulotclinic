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
  let patientId = url.searchParams.get("patientId");
  const appointmentId = url.searchParams.get("appointmentId");

  const supabase = getSupabaseAdmin();

  // If patientId not given but appointmentId is given, resolve patientId
  if (!patientId && appointmentId) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("id", appointmentId)
      .maybeSingle<{ patient_id: string }>();
    if (appt?.patient_id) {
      patientId = appt.patient_id;
    }
  }

  if (!patientId) {
    return NextResponse.json({ message: "patientId or appointmentId is required" }, { status: 400 });
  }

  // 1. Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", patientId)
    .maybeSingle<{
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      avatar_url: string | null;
    }>();

  // 2. Patient Record (optional details)
  const { data: patientRecord } = await supabase
    .from("patients")
    .select("id, patient_number, dob, gender, address, allergies, medical_history, civil_status, emergency_contact_name, emergency_contact_phone")
    .eq("id", patientId)
    .maybeSingle<{
      id: string;
      patient_number: string | null;
      dob: string | null;
      gender: string | null;
      address: string | null;
      allergies: string | null;
      medical_history: string | null;
      civilStatus?: string | null;
      emergency_contact_name: string | null;
      emergency_contact_phone: string | null;
    }>();

  // 3. Appointments list (up to 15 latest appointments)
  const { data: appointmentsRaw } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, end_time, appointment_type, reason, status, queue_number, meeting_link")
    .eq("patient_id", patientId)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(15);

  const appointmentsList = appointmentsRaw || [];
  const apptIds = appointmentsList.map((a) => a.id);

  // 4. Consultation notes for these appointments
  let notesMap: Record<string, { diagnosis: string | null; notes: string | null; prescription: string | null }> = {};
  if (apptIds.length > 0) {
    const { data: notesRaw } = await supabase
      .from("consultation_notes")
      .select("appointment_id, diagnosis, notes, prescription")
      .in("appointment_id", apptIds);

    if (notesRaw) {
      for (const n of notesRaw) {
        notesMap[n.appointment_id] = {
          diagnosis: n.diagnosis || null,
          notes: n.notes || null,
          prescription: n.prescription || null,
        };
      }
    }
  }

  // Calculate age if dob present
  let age: number | null = null;
  if (patientRecord?.dob) {
    const birth = new Date(patientRecord.dob);
    if (!Number.isNaN(birth.getTime())) {
      const today = new Date();
      age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
    }
  }

  const appointments = appointmentsList.map((a) => {
    const note = notesMap[a.id];
    return {
      id: a.id,
      date: a.appointment_date,
      start: a.start_time?.slice(0, 5) || "",
      end: a.end_time?.slice(0, 5) || "",
      type: a.appointment_type,
      reason: a.reason,
      status: a.status,
      queueNumber: a.queue_number,
      meetingLink: a.meeting_link || null,
      diagnosis: note?.diagnosis || null,
      notes: note?.notes || null,
      prescription: note?.prescription || null,
    };
  });

  return NextResponse.json({
    patient: {
      id: patientId,
      fullName: profile?.full_name || "Patient",
      email: profile?.email || null,
      phone: profile?.phone || null,
      avatarUrl: profile?.avatar_url || null,
      patientNumber: patientRecord?.patient_number || null,
      dob: patientRecord?.dob || null,
      age,
      gender: patientRecord?.gender || null,
      address: patientRecord?.address || null,
      allergies: patientRecord?.allergies || null,
      medicalHistory: patientRecord?.medical_history || null,
      emergencyContactName: patientRecord?.emergency_contact_name || null,
      emergencyContactPhone: patientRecord?.emergency_contact_phone || null,
    },
    appointments,
    selectedAppointmentId: appointmentId || appointments[0]?.id || null,
  });
}
