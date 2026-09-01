import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import { displayClinicEmail } from "@/src/lib/patient-email";
import { formatPatientFullName, splitPatientFullName } from "@/src/lib/patient-registration";

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
  patient_number?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix_name?: string | null;
  dob: string | null;
  gender: string | null;
  civil_status?: string | null;
  address: string | null;
  religion?: string | null;
  occupation?: string | null;
  guardian_name?: string | null;
  doctor_notes?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  family_history: string | null;
  allergies: string | null;
  medical_history: string | null;
  is_walk_in: boolean | null;
  patient_category?: string | null;
  profiles: {
    full_name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    role: string;
  } | null;
};

function isMissingPatientColumn(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "42703"
      && "message" in error
      && /patient_category|patient_number|first_name|middle_name|last_name|suffix_name|civil_status|religion|occupation|guardian_name|doctor_notes/i.test(String((error as { message?: unknown }).message ?? "")),
  );
}

const PATIENT_SELECT_WITH_OFFICIAL_FIELDS =
  "id, patient_number, first_name, middle_name, last_name, suffix_name, dob, gender, civil_status, address, religion, occupation, guardian_name, doctor_notes, emergency_contact_name, emergency_contact_phone, family_history, allergies, medical_history, is_walk_in, patient_category, profiles!inner(full_name, email, phone, is_active, role)";
const PATIENT_SELECT_WITH_CATEGORY =
  "id, dob, gender, address, emergency_contact_name, emergency_contact_phone, family_history, allergies, medical_history, is_walk_in, patient_category, profiles!inner(full_name, email, phone, is_active, role)";
const PATIENT_SELECT_LEGACY =
  "id, dob, gender, address, emergency_contact_name, emergency_contact_phone, family_history, allergies, medical_history, is_walk_in, profiles!inner(full_name, email, phone, is_active, role)";

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
  const legacyParts = splitPatientFullName(row.profiles?.full_name ?? "");
  const firstName = row.first_name ?? legacyParts.firstName;
  const middleName = row.middle_name ?? legacyParts.middleName;
  const lastName = row.last_name ?? legacyParts.lastName;
  const suffixName = row.suffix_name ?? legacyParts.suffixName;
  const fullName = formatPatientFullName({
    firstName,
    middleName,
    lastName,
    suffixName,
    fullName: row.profiles?.full_name,
  }) || "Unknown";

  return {
    id: row.id,
    patientNumber: row.patient_number ?? row.id.slice(0, 8).toUpperCase(),
    fullName,
    firstName,
    middleName,
    lastName,
    suffixName,
    email: displayClinicEmail(row.profiles?.email ?? ""),
    phone: row.profiles?.phone ?? "",
    dateOfBirth: row.dob ?? "",
    gender: row.gender ?? "",
    civilStatus: row.civil_status ?? "",
    address: row.address ?? "",
    religion: row.religion ?? "",
    occupation: row.occupation ?? "",
    guardianName: row.guardian_name ?? "",
    doctorNotes: row.doctor_notes ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    familyHistory: row.family_history ?? "",
    allergies: row.allergies ?? "",
    medicalHistory: row.medical_history ?? "",
    isWalkIn: row.is_walk_in ?? false,
    patientCategory: row.patient_category === "New" ? "New" : "Existing",
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

  const adminClient = getSupabaseAdmin();
  const [patientsResultInitial, visitsResult] = await Promise.all([
    adminClient
      .from("patients")
      .select(PATIENT_SELECT_WITH_OFFICIAL_FIELDS)
      .eq("profiles.role", "patient")
      .order("id"),
    adminClient
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

  let patientsResult: {
    data: unknown[] | null;
    error: { message: string } | null;
  } = patientsResultInitial;
  if (isMissingPatientColumn(patientsResult.error)) {
    patientsResult = await adminClient
      .from("patients")
      .select(PATIENT_SELECT_WITH_CATEGORY)
      .eq("profiles.role", "patient")
      .order("id");
  }
  if (isMissingPatientColumn(patientsResult.error)) {
    patientsResult = await adminClient
      .from("patients")
      .select(PATIENT_SELECT_LEGACY)
      .eq("profiles.role", "patient")
      .order("id");
  }

  if (patientsResult.error) {
    return NextResponse.json({ message: patientsResult.error.message }, { status: 500 });
  }
  if (visitsResult.error) {
    return NextResponse.json({ message: visitsResult.error.message }, { status: 500 });
  }

  const visits = (visitsResult.data ?? []).map((row) => mapVisit(row as unknown as VisitRow));
  const completedPatientIds = new Set(
    visits
      .filter((visit) => visit.status === "Completed")
      .map((visit) => visit.patientId),
  );

  return NextResponse.json({
    patients: (patientsResult.data ?? [])
      .filter((row) => (row as unknown as PatientRow).profiles?.role === "patient")
      .map((row) => {
        const patient = mapPatient(row as unknown as PatientRow);
        return completedPatientIds.has(patient.id) && patient.patientCategory === "New"
          ? { ...patient, patientCategory: "Existing" as const }
          : patient;
      }),
    visits,
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
        patientCategory?: "New" | "Existing";
        familyHistory?: string;
        medicalHistory?: string;
        allergies?: string;
        civilStatus?: string;
        religion?: string;
        occupation?: string;
        guardianName?: string;
        doctorNotes?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
      }
    | null;

  if (!body?.patientId) {
    return NextResponse.json({ message: "Missing patientId" }, { status: 400 });
  }

  const adminClient = getSupabaseAdmin();
  const officialUpdate = {
    ...(body.patientCategory ? { patient_category: body.patientCategory } : {}),
    ...(body.familyHistory !== undefined ? { family_history: body.familyHistory.trim() || null } : {}),
    ...(body.medicalHistory !== undefined ? { medical_history: body.medicalHistory.trim() || null } : {}),
    ...(body.allergies !== undefined ? { allergies: body.allergies.trim() || null } : {}),
    ...(body.civilStatus !== undefined ? { civil_status: body.civilStatus.trim() || null } : {}),
    ...(body.religion !== undefined ? { religion: body.religion.trim() || null } : {}),
    ...(body.occupation !== undefined ? { occupation: body.occupation.trim() || null } : {}),
    ...(body.guardianName !== undefined ? { guardian_name: body.guardianName.trim() || null } : {}),
    ...(body.doctorNotes !== undefined ? { doctor_notes: body.doctorNotes.trim() || null } : {}),
    ...(body.emergencyContactName !== undefined ? { emergency_contact_name: body.emergencyContactName.trim() || null } : {}),
    ...(body.emergencyContactPhone !== undefined ? { emergency_contact_phone: body.emergencyContactPhone.trim() || null } : {}),
  };
  const { error } = await adminClient
    .from("patients")
    .update(officialUpdate)
    .eq("id", body.patientId);

  if (isMissingPatientColumn(error)) {
    const { error: legacyError } = await adminClient
      .from("patients")
      .update({
        ...("family_history" in officialUpdate ? { family_history: officialUpdate.family_history } : {}),
        ...("medical_history" in officialUpdate ? { medical_history: officialUpdate.medical_history } : {}),
        ...("allergies" in officialUpdate ? { allergies: officialUpdate.allergies } : {}),
        ...("emergency_contact_name" in officialUpdate ? { emergency_contact_name: officialUpdate.emergency_contact_name } : {}),
        ...("emergency_contact_phone" in officialUpdate ? { emergency_contact_phone: officialUpdate.emergency_contact_phone } : {}),
      })
      .eq("id", body.patientId);
    if (legacyError) {
      return NextResponse.json({ message: legacyError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
