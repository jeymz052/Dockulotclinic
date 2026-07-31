import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { assertEmailNotProtectedPatient } from "@/src/lib/auth/protected-accounts";
import {
  getDoctorSlugById,
  resolveDoctorIdBySlug,
} from "@/src/lib/server/legacy-bridge";
import {
  INITIAL_SYSTEM_SETTINGS,
  type AvailabilityReason,
  type ConsultationNote,
  type DoctorUnavailability,
  type PatientRecordItem,
  type SystemSettings,
} from "@/src/lib/clinic";
import {
  patientRecordToRegistrationFields,
  validatePatientRegistrationFields,
} from "@/src/lib/patient-registration";

function daysBetween(startIso: string, endIso: string): string[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const days: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (cursor < end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function normalizeReason(raw: string | null): AvailabilityReason {
  if (raw && raw.toLowerCase() === "leave") return "Leave";
  return "Not Available";
}

export async function readDoctorUnavailability(): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_unavailability")
    .select("id, doctor_id, starts_at, ends_at, reason");
  if (error) throw error;

  const doctorIds = [...new Set((data ?? []).map((r) => r.doctor_id as string))];
  const slugEntries = await Promise.all(
    doctorIds.map(async (id) => [id, (await getDoctorSlugById(id)) ?? id] as const),
  );
  const slugs = new Map(slugEntries);

  const expanded: DoctorUnavailability[] = [];
  for (const row of data ?? []) {
    const r = row as {
      id: string;
      doctor_id: string;
      starts_at: string;
      ends_at: string;
      reason: string | null;
    };
    const slug = slugs.get(r.doctor_id) ?? r.doctor_id;
    const reason = normalizeReason(r.reason);
    const note = r.reason ?? "";
    for (const day of daysBetween(r.starts_at, r.ends_at)) {
      expanded.push({
        id: `${r.id}|${day}`,
        doctorId: slug,
        date: day,
        reason,
        note,
      });
    }
  }
  return expanded;
}

export async function addDoctorUnavailability(
  payload: Omit<DoctorUnavailability, "id">,
): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);
  const starts_at = `${payload.date}T00:00:00Z`;
  const endDate = new Date(`${payload.date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const ends_at = endDate.toISOString();

  const { error } = await supabase.from("doctor_unavailability").insert({
    doctor_id: doctorUuid,
    starts_at,
    ends_at,
    reason: payload.note || payload.reason,
  });
  if (error) throw error;
  return readDoctorUnavailability();
}

export async function deleteDoctorUnavailability(
  id: string,
): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const [blockId] = id.split("|");
  const { error } = await supabase.from("doctor_unavailability").delete().eq("id", blockId);
  if (error) throw error;
  return readDoctorUnavailability();
}

export async function updateDoctorUnavailability(
  id: string,
  payload: Omit<DoctorUnavailability, "id">,
): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const [blockId] = id.split("|");
  const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);
  const starts_at = `${payload.date}T00:00:00Z`;
  const endDate = new Date(`${payload.date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const ends_at = endDate.toISOString();

  const { error } = await supabase
    .from("doctor_unavailability")
    .update({
      doctor_id: doctorUuid,
      starts_at,
      ends_at,
      reason: payload.note || payload.reason,
    })
    .eq("id", blockId);
  if (error) throw error;
  return readDoctorUnavailability();
}

// ============ PATIENTS (v2 via profiles+patients) ============

type PatientJoinRow = {
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

function mapPatientRow(row: PatientJoinRow): PatientRecordItem {
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

export async function readPatients(): Promise<PatientRecordItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .select("id, dob, gender, address, emergency_contact_name, emergency_contact_phone, family_history, allergies, medical_history, is_walk_in, patient_category, profiles!inner(full_name, email, phone, is_active, role)")
    .eq("profiles.role", "patient")
    .order("id");
  if (error) throw error;
  return (data ?? []).map((row) => mapPatientRow(row as unknown as PatientJoinRow));
}

export async function createPatient(
  payload: Omit<PatientRecordItem, "id" | "status">,
): Promise<PatientRecordItem[]> {
  const supabase = getSupabaseAdmin();
  const normalized = patientRecordToRegistrationFields(payload);
  assertEmailNotProtectedPatient(normalized.email);
  const validationError = validatePatientRegistrationFields(normalized);
  if (validationError) throw new Error(validationError);

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", normalized.email)
    .maybeSingle<{ id: string; role: string }>();

  if (existing && existing.role !== "patient") {
    throw new Error("This email is already registered to a non-patient account.");
  }

  let userId = existing?.id ?? null;
  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: normalized.email,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: normalized.fullName },
      app_metadata: { role: "patient" },
    });
    if (error || !created.user) throw error ?? new Error("Failed to create patient");
    userId = created.user.id;
  }

  // Triggers create profile + patient. Patch fields with the values from the form.
  await supabase
    .from("profiles")
    .update({
      full_name: normalized.fullName,
      phone: normalized.phone,
      role: "patient",
      is_active: true,
    })
    .eq("id", userId);

  await supabase
    .from("patients")
    .upsert({
      id: userId,
      dob: normalized.dateOfBirth || null,
      gender: normalized.gender || null,
      address: normalized.address || null,
      emergency_contact_name: payload.emergencyContactName?.trim() || null,
      emergency_contact_phone: payload.emergencyContactPhone?.trim() || null,
      family_history: payload.familyHistory?.trim() || null,
      allergies: payload.allergies?.trim() || null,
      medical_history: payload.medicalHistory?.trim() || null,
      is_walk_in: payload.isWalkIn,
      patient_category: payload.patientCategory ?? "New",
    });

  return readPatients();
}

export async function updatePatient(
  updatedPatient: PatientRecordItem,
): Promise<PatientRecordItem[]> {
  const supabase = getSupabaseAdmin();
  const normalized = patientRecordToRegistrationFields(updatedPatient);
  const validationError = validatePatientRegistrationFields(normalized);
  if (validationError) throw new Error(validationError);

  const profileUpdate = {
    full_name: normalized.fullName,
    email: normalized.email,
    phone: normalized.phone,
    is_active: updatedPatient.status !== "Inactive",
  };
  await supabase.from("profiles").update(profileUpdate).eq("id", updatedPatient.id);
  await supabase
    .from("patients")
    .update({
      dob: normalized.dateOfBirth || null,
      gender: normalized.gender || null,
      address: normalized.address || null,
      emergency_contact_name: updatedPatient.emergencyContactName.trim() || null,
      emergency_contact_phone: updatedPatient.emergencyContactPhone.trim() || null,
      family_history: updatedPatient.familyHistory.trim() || null,
      allergies: updatedPatient.allergies.trim() || null,
      medical_history: updatedPatient.medicalHistory.trim() || null,
      is_walk_in: updatedPatient.isWalkIn,
      patient_category: updatedPatient.patientCategory,
    })
    .eq("id", updatedPatient.id);
  return readPatients();
}

export async function deletePatient(id: string): Promise<PatientRecordItem[]> {
  const supabase = getSupabaseAdmin();
  // Soft-delete: deactivate profile. Keeps audit trail, prevents cascading appt deletion.
  await supabase.from("profiles").update({ is_active: false }).eq("id", id);
  return readPatients();
}

// ============ CONSULTATION NOTES (v2) ============

type NoteJoinRow = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  visible_to_patient: boolean;
  updated_at: string;
  appointments: {
    status: string;
    patient_id: string;
    patients: {
      profiles: { full_name: string } | null;
    } | null;
  } | null;
};

export type ConsultationNotesFilter = {
  patientId?: string;
  doctorId?: string;
};

function deriveLegacyNoteStatus(apptStatus: string): ConsultationNote["status"] {
  if (apptStatus === "Completed") return "Completed";
  if (apptStatus === "InProgress") return "In Progress";
  return "Ready";
}

async function mapNoteRow(row: NoteJoinRow, slugsById: Map<string, string>): Promise<ConsultationNote> {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    doctorId: slugsById.get(row.doctor_id) ?? row.doctor_id,
    patientName: row.appointments?.patients?.profiles?.full_name ?? "Unknown",
    diagnosis: row.diagnosis ?? "",
    note: row.notes ?? "",
    prescription: row.prescription ?? "",
    status: deriveLegacyNoteStatus(row.appointments?.status ?? ""),
    visibleToPatient: row.visible_to_patient,
    updatedAt: row.updated_at,
  };
}

export async function readConsultationNotes(
  filter: ConsultationNotesFilter = {},
): Promise<ConsultationNote[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("consultation_notes")
    .select(`
      id, appointment_id, doctor_id, chief_complaint, diagnosis, prescription, notes, visible_to_patient, updated_at,
      appointments!inner(
        status,
        patient_id,
        patients!inner(profiles!inner(full_name))
      )
    `)
    .order("updated_at", { ascending: false });

  if (filter.doctorId) {
    query = query.eq("doctor_id", filter.doctorId);
  }
  if (filter.patientId) {
    query = query.eq("appointments.patient_id", filter.patientId);
    query = query.eq("visible_to_patient", true);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as NoteJoinRow[];
  const doctorIds = [...new Set(rows.map((r) => r.doctor_id))];
  const slugEntries = await Promise.all(
    doctorIds.map(async (id) => [id, (await getDoctorSlugById(id)) ?? id] as const),
  );
  const slugs = new Map(slugEntries);

  return Promise.all(rows.map((r) => mapNoteRow(r, slugs)));
}

export async function upsertConsultationNote(
  payload: Omit<ConsultationNote, "id" | "updatedAt"> & { id?: string },
): Promise<ConsultationNote[]> {
  const supabase = getSupabaseAdmin();
  const doctorUuid = await resolveDoctorIdBySlug(payload.doctorId);

  await supabase.from("consultation_notes").upsert(
    {
      appointment_id: payload.appointmentId,
      doctor_id: doctorUuid,
      diagnosis: payload.diagnosis,
      notes: payload.note,
      prescription: payload.prescription,
      visible_to_patient: payload.visibleToPatient,
    },
    { onConflict: "appointment_id" },
  );

  // Reflect the legacy status into the v2 appointment status machine.
  const newStatus =
    payload.status === "Completed"
      ? "Completed"
      : payload.status === "In Progress"
        ? "InProgress"
        : null;
  if (newStatus) {
    await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", payload.appointmentId);
  }

  return readConsultationNotes();
}

export async function deleteConsultationNote(id: string): Promise<ConsultationNote[]> {
  const supabase = getSupabaseAdmin();
  await supabase.from("consultation_notes").delete().eq("id", id);
  return readConsultationNotes();
}

export async function readSystemSettings(): Promise<SystemSettings> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("system_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle<{
      clinic_name: string;
      email: string;
      phone: string;
      address: string;
      online_consultation_fee: number;
      max_patients_per_hour: number;
      clinic_open_time?: string | null;
      clinic_close_time?: string | null;
      default_meeting_link?: string | null;
    }>();
  if (!data) return INITIAL_SYSTEM_SETTINGS;
  return {
    clinicName: data.clinic_name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    onlineConsultationFee: Number(data.online_consultation_fee),
    maxPatientsPerHour: data.max_patients_per_hour,
    clinicOpenTime: data.clinic_open_time?.slice(0, 5) ?? INITIAL_SYSTEM_SETTINGS.clinicOpenTime,
    clinicCloseTime: data.clinic_close_time?.slice(0, 5) ?? INITIAL_SYSTEM_SETTINGS.clinicCloseTime,
    defaultMeetingLink: data.default_meeting_link ?? "",
  };
}

export async function saveSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("system_settings")
    .update({
      clinic_name: settings.clinicName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      online_consultation_fee: settings.onlineConsultationFee,
      max_patients_per_hour: settings.maxPatientsPerHour,
      clinic_open_time: settings.clinicOpenTime,
      clinic_close_time: settings.clinicCloseTime,
      default_meeting_link: (settings.defaultMeetingLink ?? "").trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) throw error;
  return readSystemSettings();
}
