import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { assertEmailNotProtectedPatient } from "@/src/lib/auth/protected-accounts";
import type {
  Appointment as V2Appointment,
  ApptStatus,
  ApptType,
} from "@/src/lib/db/types";
import type { AppointmentRecord, AppointmentStatus } from "@/src/lib/appointments";

/**
 * Translates between the legacy UI shape (doctor slugs, flat patient fields,
 * legacy status strings) and the normalized v2 schema.
 *
 * Doctor lookup key: doctors.slug (for example `doctora-kulot-md` in this clinic).
 * Patient identity: found/created via auth.users by email.
 */

export async function resolveDoctorIdBySlug(slug: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctors")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (data) return data.id;

  // Fallback: if only one doctor exists, use them and backfill the slug.
  const { data: all, error: allErr } = await supabase
    .from("doctors")
    .select("id");
  if (allErr) throw allErr;
  if (!all || all.length === 0) {
    throw new Error("No doctors found — create a doctor profile first.");
  }
  if (all.length === 1) {
    const only = all[0] as { id: string };
    await supabase.from("doctors").update({ slug }).eq("id", only.id);
    return only.id;
  }
  throw new Error(
    `Multiple doctors exist but none have slug '${slug}'. Set doctors.slug for each.`,
  );
}

export async function getDoctorSlugById(id: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctors")
    .select("slug")
    .eq("id", id)
    .maybeSingle<{ slug: string | null }>();
  if (error) throw error;
  return data?.slug ?? null;
}

export async function findOrCreatePatientByEmail(
  email: string,
  full_name: string,
  phone: string,
): Promise<string> {
  assertEmailNotProtectedPatient(email);
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email.toLowerCase())
    .maybeSingle<{ id: string; role: string }>();
  if (existing) {
    if (existing.role !== "patient") {
      throw new Error(`Email ${email} is registered to a non-patient account.`);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name },
    app_metadata: { role: "patient" },
  });
  if (error || !created.user) throw error ?? new Error("Failed to create patient account");

  // Profile + patient rows are created by DB triggers; patch phone/name in case trigger used fallback.
  await supabase
    .from("profiles")
    .update({ full_name, phone })
    .eq("id", created.user.id);

  return created.user.id;
}

function deriveLegacyStatus(v2: V2Appointment): AppointmentStatus {
  if (v2.status === "Pending") return "Pending";
  if (v2.appointment_type === "Online") {
    // Online visits never check in physically — collapse CheckedIn (shouldn't
    // happen for Online, but be defensive) back to Confirmed for the UI.
    if (v2.status === "Completed") return "Completed";
    if (v2.status === "InProgress") return "In Progress";
    return "Confirmed";
  }
  if (v2.status === "Completed") return "Completed";
  if (v2.status === "InProgress") return "In Progress";
  if (v2.status === "CheckedIn") return "Checked In";
  return "Confirmed";
}

export function legacyStatusMatchesLiving(s: ApptStatus): boolean {
  return s !== "Cancelled" && s !== "NoShow";
}

// Pre-Google-Meet bookings stored a placeholder URL on `meet.chiara.clinic`
// that was never a real meeting room. Hide those from the UI so the
// missing-link banner shows instead, prompting staff to set the real link.
function sanitizeMeetingLink(link: string | null): string | null {
  if (!link) return null;
  if (link.includes("meet.chiara.clinic")) return null;
  return link;
}

type PatientPair = { full_name: string; email: string; phone: string | null };

export async function mapV2RowToLegacy(
  row: V2Appointment,
  patient: PatientPair,
  doctorSlug: string,
): Promise<AppointmentRecord> {
  return {
    id: row.id,
    patientName: patient.full_name,
    email: patient.email,
    phone: patient.phone ?? "",
    doctorId: doctorSlug,
    date: row.appointment_date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    type: row.appointment_type as ApptType,
    reason: row.reason,
    status: deriveLegacyStatus(row),
    queueNumber: row.queue_number,
    meetingLink: sanitizeMeetingLink(row.meeting_link),
  };
}

export function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + 60;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function normalizeSqlTime(value: string): string {
  const [hoursText, minutesText = "0", secondsText = "0"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (
    !Number.isInteger(hours)
    || !Number.isInteger(minutes)
    || !Number.isInteger(seconds)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
    || seconds < 0
    || seconds > 59
  ) {
    throw new Error("Invalid time value.");
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function addOneHourSql(value: string): string {
  return normalizeSqlTime(addOneHour(value));
}
