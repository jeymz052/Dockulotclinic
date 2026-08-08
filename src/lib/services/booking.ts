import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type { Appointment, ApptType, Doctor } from "@/src/lib/db/types";
import { getClinicToday, isPastInClinicTime } from "@/src/lib/timezone";
import {
  getSchedulableSlotsForDate,
  getUnavailabilityForDate,
} from "@/src/lib/services/schedule";
import { findNextAvailableSharedSlot } from "@/src/lib/services/appointment-availability";
import {
  enqueueAppointmentTeamNotifications,
  enqueueNotification,
  enqueueStaffAppointmentBookedNotifications,
} from "@/src/lib/services/notification";

export type BookingInput = {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: ApptType;
  reason?: string;
};

function assertMatchesSchedulableSlot(
  slots: Array<{ start: string; end: string }>,
  slotStart: string,
  slotEnd: string,
) {
  const toSec = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const hasMatch = slots.some(
    (slot) => toSec(slot.start) === toSec(slotStart) && toSec(slot.end) === toSec(slotEnd),
  );
  if (!hasMatch) {
    throw new HttpError(409, "Outside doctor's working hours");
  }
}

function overlapsBlocks(
  date: string,
  start: string,
  end: string,
  blocks: { starts_at: string; ends_at: string }[],
) {
  const from = new Date(`${date}T${start.length === 5 ? `${start}:00` : start}Z`).getTime();
  const to = new Date(`${date}T${end.length === 5 ? `${end}:00` : end}Z`).getTime();
  return blocks.some((b) => {
    const bf = new Date(b.starts_at).getTime();
    const bt = new Date(b.ends_at).getTime();
    return bf < to && bt > from;
  });
}

function normalizeTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

function supportsType(mode: "Clinic" | "Online" | "Both", type: ApptType) {
  return mode === "Both" || mode === type;
}

function overlapsSlot(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const aStart = normalizeTime(startA);
  const aEnd = normalizeTime(endA);
  const bStart = normalizeTime(startB);
  const bEnd = normalizeTime(endB);
  return aStart < bEnd && aEnd > bStart;
}

export async function reserveAppointment(input: BookingInput, actor: Actor) {
  if (actor.profile.role === "patient" && actor.id !== input.patient_id) {
    throw new HttpError(403, "Patients may only book for themselves");
  }
  if (!isStaff(actor.profile.role) && actor.profile.role !== "patient") {
    throw new HttpError(403, "Role cannot create appointments");
  }

  if (input.start_time >= input.end_time)
    throw new HttpError(400, "start_time must be before end_time");

  const clinicToday = getClinicToday();
  if (input.appointment_date < clinicToday) {
    throw new HttpError(409, "Past dates cannot be booked");
  }
  if (isPastInClinicTime(input.appointment_date, input.start_time)) {
    throw new HttpError(409, "Past time slots cannot be booked");
  }

  const supabase = getSupabaseAdmin();
  if (input.appointment_type === "Online") {
    throw new HttpError(
      400,
      "Online consultations require payment first. Use the checkout flow to confirm the slot.",
    );
  }

  const schedulableSlots = await getSchedulableSlotsForDate(input.doctor_id, input.appointment_date);
  if (schedulableSlots.length === 0) throw new HttpError(409, "Doctor is not working that day");
  assertMatchesSchedulableSlot(schedulableSlots, input.start_time, input.end_time);
  const exactSlot = schedulableSlots.find(
    (slot) => normalizeTime(slot.start) === normalizeTime(input.start_time)
      && normalizeTime(slot.end) === normalizeTime(input.end_time),
  );
  if (!exactSlot || !supportsType(exactSlot.mode, input.appointment_type)) {
    throw new HttpError(409, `${exactSlot?.mode ?? "Clinic"} schedule only`);
  }

  const blocks = await getUnavailabilityForDate(input.doctor_id, input.appointment_date);
  if (overlapsBlocks(input.appointment_date, input.start_time, input.end_time, blocks))
    throw new HttpError(409, "Doctor is unavailable during that time");

  const { data: existing, error: existingError } = await supabase
    .from("appointments")
    .select("queue_number, status, start_time, end_time, appointment_type")
    .eq("doctor_id", input.doctor_id)
    .eq("appointment_date", input.appointment_date);
  if (existingError) throw existingError;

  const { data: reservations, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .select("queue_number, status, start_time, end_time")
    .eq("doctor_id", input.doctor_id)
    .eq("appointment_date", input.appointment_date)
    .in("status", ["Pending", "Paid"]);
  if (reservationError) throw reservationError;

  const active = (existing ?? []).filter(
    (r) => r.status !== "Cancelled" && r.status !== "NoShow",
  );
  const pendingReservations = reservations ?? [];

  const overlapping = active.filter((r) =>
    overlapsSlot(input.start_time, input.end_time, r.start_time, r.end_time),
  );
  const overlappingReservations = pendingReservations.filter((r) =>
    overlapsSlot(input.start_time, input.end_time, r.start_time, r.end_time),
  );
  const conflictingType = overlapping.find(
    (r) => r.appointment_type !== input.appointment_type,
  );
  if (conflictingType || overlappingReservations.length > 0) {
    const next = await findNextAvailableSharedSlot(
      input.doctor_id,
      input.appointment_date,
      input.appointment_type,
      14,
    );
    const hint = next ? ` Next available: ${next.date} ${next.slot.start}-${next.slot.end}.` : "";
    throw new HttpError(
      409,
      `Slot conflict: ${(conflictingType?.appointment_type ?? "Online")} booking already exists for this shared time slot.${hint}`,
    );
  }

  if (overlapping.length + overlappingReservations.length >= 5) {
    const next = await findNextAvailableSharedSlot(
      input.doctor_id,
      input.appointment_date,
      input.appointment_type,
      14,
    );
    const hint = next ? ` Next available: ${next.date} ${next.slot.start}-${next.slot.end}.` : "";
    throw new HttpError(409, `Slot is full (max 5/hour).${hint}`);
  }

  const used = new Set([
    ...overlapping.map((r) => r.queue_number),
    ...overlappingReservations.map((r) => r.queue_number),
  ]);
  let queue_number = 1;
  while (queue_number <= 5 && used.has(queue_number)) queue_number++;
  if (queue_number > 5) throw new HttpError(409, "Slot is full");

  const { data: inserted, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      appointment_date: input.appointment_date,
      start_time: input.start_time,
      end_time: input.end_time,
      appointment_type: input.appointment_type,
      reason: input.reason ?? "",
      status: actor.profile.role === "patient" ? "Pending" : "Confirmed",
      queue_number,
    })
    .select()
    .single<Appointment>();
  if (error) throw error;

  await enqueueNotification({
    user_id: input.patient_id,
    template: "appointment_booked",
    channels: inserted.status === "Confirmed" ? ["email", "sms"] : ["email"],
    payload: {
      appointment_id: inserted.id,
      appointment_type: input.appointment_type,
      appointment_date: input.appointment_date,
      start_time: input.start_time,
      status: inserted.status,
    },
  });

  await enqueueStaffAppointmentBookedNotifications({
    appointment_id: inserted.id,
    appointment_type: input.appointment_type,
    patient_user_id: input.patient_id,
    appointment_date: input.appointment_date,
    start_time: input.start_time,
    doctor_user_id: input.doctor_id,
    excludeUserIds: [input.patient_id, actor.id],
  });

  return inserted;
}

export async function getDoctor(doctorId: string): Promise<Doctor> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("id", doctorId)
    .single<Doctor>();
  if (error) throw new HttpError(404, "Doctor not found");
  return data;
}

export async function getAppointment(id: string): Promise<Appointment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single<Appointment>();
  if (error) throw new HttpError(404, "Appointment not found");
  return data;
}

function assertParticipantOrStaff(appt: Appointment, actor: Actor) {
  const role = actor.profile.role;
  if (isStaff(role)) return;
  if (role === "doctor" && actor.id === appt.doctor_id) return;
  if (role === "patient" && actor.id === appt.patient_id) return;
  throw new HttpError(403, "Forbidden");
}

export async function cancelAppointment(id: string, actor: Actor) {
  const appt = await getAppointment(id);
  assertParticipantOrStaff(appt, actor);
  if (appt.status === "Completed") throw new HttpError(400, "Cannot cancel a completed appointment");
  if (appt.status === "Cancelled") return appt;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "Cancelled" })
    .eq("id", id)
    .select()
    .single<Appointment>();
  if (error) throw error;

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_cancelled",
    channels: ["email"],
    payload: { appointment_id: id },
  });
  await enqueueAppointmentTeamNotifications({
    appointment_id: id,
    appointment_type: appt.appointment_type,
    patient_user_id: appt.patient_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    doctor_user_id: appt.doctor_id,
    excludeUserIds: [appt.patient_id, actor.id],
    template: "appointment_staff_cancelled",
  });
  return data;
}

export async function markArrived(id: string, actor: Actor) {
  // Allow front-desk staff or the appointment's doctor to mark arrival.
  // Online visits never check in physically, so they're rejected below.
  const appt = await getAppointment(id);
  const role = actor.profile.role;
  if (!(isStaff(role) || (role === "doctor" && actor.id === appt.doctor_id)))
    throw new HttpError(
      403,
      "Only front-desk staff or the appointment's doctor can mark a patient as arrived",
    );
  if (appt.appointment_type !== "Clinic")
    throw new HttpError(400, "Only clinic visits can be checked in");
  if (appt.status === "CheckedIn") return appt;
  if (appt.status !== "Confirmed")
    throw new HttpError(400, `Cannot check in from status ${appt.status}`);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "CheckedIn" })
    .eq("id", id)
    .select()
    .single<Appointment>();
  if (error) throw error;
  await enqueueAppointmentTeamNotifications({
    appointment_id: id,
    appointment_type: appt.appointment_type,
    patient_user_id: appt.patient_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    doctor_user_id: appt.doctor_id,
    excludeUserIds: [appt.patient_id, actor.id],
    template: "appointment_staff_checked_in",
  });
  return data;
}

export async function startConsultation(id: string, actor: Actor) {
  if (actor.profile.role !== "doctor" && !isStaff(actor.profile.role))
    throw new HttpError(403, "Only doctors can start consultations");
  const appt = await getAppointment(id);
  if (actor.profile.role === "doctor" && actor.id !== appt.doctor_id)
    throw new HttpError(403, "Not your appointment");
  if (appt.status === "Cancelled")
    throw new HttpError(400, "Cannot start — online payment not confirmed");

  // Clinic visits must be checked in first; online visits jump straight from
  // Confirmed to InProgress because there is no physical arrival.
  if (appt.appointment_type === "Clinic") {
    if (appt.status === "Confirmed")
      throw new HttpError(400, "Mark the patient as arrived before starting the consultation");
    if (appt.status !== "CheckedIn")
      throw new HttpError(400, `Cannot start from status ${appt.status}`);
  } else if (appt.status !== "Confirmed") {
    throw new HttpError(400, `Cannot start from status ${appt.status}`);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "InProgress" })
    .eq("id", id)
    .select()
    .single<Appointment>();
  if (error) throw error;
  await enqueueAppointmentTeamNotifications({
    appointment_id: id,
    appointment_type: appt.appointment_type,
    patient_user_id: appt.patient_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    doctor_user_id: appt.doctor_id,
    excludeUserIds: [appt.patient_id, actor.id],
    template: "appointment_staff_in_progress",
  });
  return data;
}

export async function completeConsultation(id: string, actor: Actor) {
  if (actor.profile.role !== "doctor" && !isStaff(actor.profile.role))
    throw new HttpError(403, "Only doctors can complete consultations");
  const appt = await getAppointment(id);
  if (actor.profile.role === "doctor" && actor.id !== appt.doctor_id)
    throw new HttpError(403, "Not your appointment");
  if (appt.status !== "InProgress")
    throw new HttpError(400, "Appointment is not in progress");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "Completed" })
    .eq("id", id)
    .select()
    .single<Appointment>();
  if (error) throw error;
  await enqueueAppointmentTeamNotifications({
    appointment_id: id,
    appointment_type: appt.appointment_type,
    patient_user_id: appt.patient_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    doctor_user_id: appt.doctor_id,
    excludeUserIds: [appt.patient_id, actor.id],
    template: "appointment_staff_completed",
  });
  return data;
}

export async function listAppointments(actor: Actor, filters: {
  from?: string;
  to?: string;
  doctor_id?: string;
  patient_id?: string;
  status?: string;
}) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("appointments").select("*");

  if (actor.profile.role === "patient") {
    q = q.eq("patient_id", actor.id);
  } else if (actor.profile.role === "doctor") {
    q = q.eq("doctor_id", actor.id);
  } else if (isStaff(actor.profile.role)) {
    if (filters.doctor_id) q = q.eq("doctor_id", filters.doctor_id);
    if (filters.patient_id) q = q.eq("patient_id", filters.patient_id);
  } else {
    throw new HttpError(403, "Forbidden");
  }

  if (filters.from) q = q.gte("appointment_date", filters.from);
  if (filters.to) q = q.lte("appointment_date", filters.to);
  if (filters.status) q = q.eq("status", filters.status);

  const { data, error } = await q
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("queue_number", { ascending: true });
  if (error) throw error;
  return data as Appointment[];
}

export function canReadAppointment(appt: Appointment, actor: Actor): boolean {
  const role = actor.profile.role;
  return (
    isStaff(role) ||
    (role === "doctor" && actor.id === appt.doctor_id) ||
    (role === "patient" && actor.id === appt.patient_id)
  );
}
