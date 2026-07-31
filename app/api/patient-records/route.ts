import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

type PatientRow = {
  id: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  family_history: string | null;
  allergies: string | null;
  medical_history: string | null;
  is_walk_in: boolean | null;
  patient_category: "New" | "Regular" | "OldRecord" | null;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    role: string;
  } | null;
};

type VisitRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: "Clinic" | "Online";
  reason: string;
  status: string;
  queue_number: number;
  updated_at: string;
  patients: {
    profiles: {
      full_name: string;
    } | null;
  } | null;
  vital_signs: {
    updated_at: string;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    temperature_c: number | null;
    pulse_rate: number | null;
    oxygen_saturation: number | null;
    respiratory_rate: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    notes: string | null;
  }[] | null;
  consultation_notes: {
    updated_at: string;
    diagnosis: string | null;
    notes: string | null;
    prescription: string | null;
    visible_to_patient: boolean;
  }[] | null;
};

function mapPatient(row: PatientRow): PatientRecordItem {
  return {
    id: row.id,
    fullName: row.profiles?.full_name ?? "Unknown",
    email: row.profiles?.email ?? "",
    phone: row.profiles?.phone ?? "",
    dateOfBirth: row.dob ?? "",
    gender: row.gender ?? "",
    address: row.address ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    familyHistory: row.family_history ?? "",
    allergies: row.allergies ?? "",
    medicalHistory: row.medical_history ?? "",
    isWalkIn: row.is_walk_in ?? false,
    patientCategory: row.patient_category ?? "New",
    status: row.profiles?.is_active === false ? "Inactive" : "Active",
  };
}

function mapVisit(row: VisitRow): PatientVisitRecord {
  const vitals = row.vital_signs?.[0] ?? null;
  const consultation = row.consultation_notes?.[0] ?? null;
  return {
    appointmentId: row.id,
    patientId: row.patient_id,
    patientName: row.patients?.profiles?.full_name ?? "Unknown",
    doctorId: row.doctor_id,
    date: row.appointment_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    type: row.appointment_type,
    reason: row.reason,
    status: row.status,
    queueNumber: row.queue_number,
    updatedAt: row.updated_at,
    vitals: vitals
      ? {
          updatedAt: vitals.updated_at,
          bpSystolic: vitals.bp_systolic,
          bpDiastolic: vitals.bp_diastolic,
          temperatureC: vitals.temperature_c,
          pulseRate: vitals.pulse_rate,
          oxygenSaturation: vitals.oxygen_saturation,
          respiratoryRate: vitals.respiratory_rate,
          weightKg: vitals.weight_kg,
          heightCm: vitals.height_cm,
          notes: vitals.notes,
        }
      : null,
        consultation: consultation
      ? {
          updatedAt: consultation.updated_at,
          diagnosis: consultation.diagnosis ?? "",
          note: consultation.notes ?? "",
          prescription: consultation.prescription ?? "",
          visibleToPatient: consultation.visible_to_patient,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "patients.manage")) {
    return unauthorized();
  }

  const supabase = getSupabaseAdmin();
  const [patientsResult, visitsResult] = await Promise.all([
    supabase
      .from("patients")
      .select("id, dob, gender, address, emergency_contact_name, emergency_contact_phone, family_history, allergies, medical_history, is_walk_in, patient_category, profiles!inner(full_name, email, phone, is_active, role)")
      .eq("profiles.role", "patient")
      .order("id"),
    supabase
      .from("appointments")
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        appointment_type,
        reason,
        status,
        queue_number,
        updated_at,
        patients!inner(profiles!inner(full_name)),
        vital_signs(updated_at, bp_systolic, bp_diastolic, temperature_c, pulse_rate, oxygen_saturation, respiratory_rate, weight_kg, height_cm, notes),
        consultation_notes(updated_at, diagnosis, notes, prescription, visible_to_patient)
      `)
      .neq("status", "PendingPayment")
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false }),
  ]);

  if (patientsResult.error) {
    return NextResponse.json({ message: patientsResult.error.message }, { status: 500 });
  }
  if (visitsResult.error) {
    return NextResponse.json({ message: visitsResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    patients: (patientsResult.data ?? []).map((row) => mapPatient(row as unknown as PatientRow)),
    visits: (visitsResult.data ?? []).map((row) => mapVisit(row as unknown as VisitRow)),
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "patients.manage")) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        patientId?: string;
        familyHistory?: string;
        medicalHistory?: string;
        allergies?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      }
    | null;

  if (!body?.patientId) {
    return NextResponse.json({ message: "Missing patientId" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("patients")
    .update({
      family_history: body.familyHistory?.trim() || null,
      medical_history: body.medicalHistory?.trim() || null,
      allergies: body.allergies?.trim() || null,
      emergency_contact_name: body.emergencyContactName?.trim() || null,
      emergency_contact_phone: body.emergencyContactPhone?.trim() || null,
    })
    .eq("id", body.patientId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
