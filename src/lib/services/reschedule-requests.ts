import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type {
  Appointment,
  AppointmentRescheduleRequest,
  AppointmentRescheduleRequestStatus,
} from "@/src/lib/db/types";
import type { AppointmentRecord } from "@/src/lib/appointments";
import { readAppointments, validateSharedSlotOrThrow } from "@/src/lib/server/appointments-store";
import { normalizeSqlTime } from "@/src/lib/server/legacy-bridge";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { getClinicToday, isPastInClinicTime } from "@/src/lib/timezone";
import {
  enqueueAppointmentTeamNotifications,
  enqueueNotification,
} from "@/src/lib/services/notification";
import { recalculateQueueNumbersForSlot } from "@/src/lib/services/maintenance";
import { resolveSchedulableSlotForStart } from "@/src/lib/services/schedule";
import { isProcedureServiceTitle, parseAppointmentContext } from "@/src/lib/appointment-context";
import { CONSULTATION_SLOT_MINUTES, PROCEDURE_SLOT_MINUTES } from "@/src/lib/clinic-schedule";

export type RescheduleRequestView = {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  appointmentType: "Clinic" | "Online";
  currentDate: string;
  currentStart: string;
  currentEnd: string;
  requestedDate: string;
  requestedStart: string;
  requestedEnd: string;
  reason: string;
  status: AppointmentRescheduleRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type CreateRescheduleRequestInput = {
  appointment_id?: string;
  requested_date?: string;
  requested_start?: string;
  reason?: string;
};

type ReviewRescheduleRequestInput = {
  action?: "approve" | "reject";
  note?: string;
};

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "Choose a valid request date.");
  }
  return value;
}

function normalizeShortTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new HttpError(400, "Choose a valid request time.");
  }
  return normalizeSqlTime(value);
}

function canPatientChange(appt: Appointment) {
  return appt.status === "Pending" || appt.status === "Confirmed";
}

function assertCanReview(appt: Appointment, actor: Actor) {
  if (isStaff(actor.profile.role)) return;
  if (actor.profile.role === "doctor" && actor.id === appt.doctor_id) return;
  throw new HttpError(403, "Only staff or the assigned doctor can review this request.");
}

async function readAppointment(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single<Appointment>();
  if (error || !data) throw new HttpError(404, "Appointment not found.");
  return data;
}

async function readRequest(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointment_reschedule_requests")
    .select("*")
    .eq("id", id)
    .single<AppointmentRescheduleRequest>();
  if (error || !data) throw new HttpError(404, "Reschedule request not found.");
  return data;
}

async function readAppointmentsForActor(actor: Actor): Promise<AppointmentRecord[]> {
  if (actor.profile.role === "patient") return readAppointments({ patientId: actor.id });
  if (actor.profile.role === "doctor") return readAppointments({ doctorId: actor.id });
  return readAppointments();
}

async function mapRequests(rows: AppointmentRescheduleRequest[]): Promise<RescheduleRequestView[]> {
  if (rows.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const appointmentIds = [...new Set(rows.map((row) => row.appointment_id))];
  const patientIds = [...new Set(rows.map((row) => row.patient_id))];

  const [{ data: appointments }, { data: profiles }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, appointment_date, start_time, end_time, appointment_type")
      .in("id", appointmentIds),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", patientIds),
  ]);

  const appointmentsById = new Map(
    (appointments ?? []).map((row) => [
      row.id as string,
      row as {
        id: string;
        appointment_date: string;
        start_time: string;
        end_time: string;
        appointment_type: "Clinic" | "Online";
      },
    ]),
  );
  const profilesById = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      row as { id: string; full_name: string | null },
    ]),
  );

  return rows.map((row) => {
    const appt = appointmentsById.get(row.appointment_id);
    const patient = profilesById.get(row.patient_id);
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      patientName: patient?.full_name ?? "Patient",
      appointmentType: appt?.appointment_type ?? row.requested_appointment_type,
      currentDate: appt?.appointment_date ?? "",
      currentStart: appt?.start_time.slice(0, 5) ?? "",
      currentEnd: appt?.end_time.slice(0, 5) ?? "",
      requestedDate: row.requested_appointment_date,
      requestedStart: row.requested_start_time.slice(0, 5),
      requestedEnd: row.requested_end_time.slice(0, 5),
      reason: row.reason ?? "",
      status: row.status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
    };
  });
}

export async function listRescheduleRequests(
  actor: Actor,
  status: AppointmentRescheduleRequestStatus | "all" = "Pending",
) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("appointment_reschedule_requests")
    .select("*")
    .order("created_at", { ascending: true });

  if (status !== "all") query = query.eq("status", status);
  if (actor.profile.role === "patient") {
    query = query.eq("patient_id", actor.id);
  } else if (actor.profile.role === "doctor") {
    query = query.eq("doctor_id", actor.id);
  } else if (!isStaff(actor.profile.role)) {
    throw new HttpError(403, "Forbidden");
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapRequests((data ?? []) as AppointmentRescheduleRequest[]);
}

export async function createRescheduleRequest(
  input: CreateRescheduleRequestInput,
  actor: Actor,
) {
  if (actor.profile.role !== "patient") {
    throw new HttpError(403, "Only patients can request rescheduling from this flow.");
  }

  const appointmentId = typeof input.appointment_id === "string" ? input.appointment_id : "";
  const requestedDate = normalizeDate(input.requested_date);
  const requestedStart = normalizeShortTime(input.requested_start);
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  const appt = await readAppointment(appointmentId);

  if (appt.patient_id !== actor.id) {
    throw new HttpError(403, "You can only reschedule your own appointments.");
  }
  if (!canPatientChange(appt)) {
    throw new HttpError(400, "Only pending or confirmed appointments can be rescheduled.");
  }
  if (appt.appointment_date < getClinicToday()) {
    throw new HttpError(400, "Past appointments cannot be rescheduled.");
  }
  if (
    appt.appointment_date === requestedDate
    && normalizeSqlTime(appt.start_time) === requestedStart
  ) {
    throw new HttpError(400, "Choose a different time for the reschedule request.");
  }
  if (isPastInClinicTime(requestedDate, requestedStart)) {
    throw new HttpError(400, "Past time slots cannot be requested.");
  }

  const slot = await resolveSchedulableSlotForStart(
    appt.doctor_id,
    requestedDate,
    requestedStart,
    appt.appointment_type,
    {
      slotMinutes: appt.appointment_type === "Clinic" && isProcedureServiceTitle(parseAppointmentContext(appt.reason).service)
        ? PROCEDURE_SLOT_MINUTES
        : CONSULTATION_SLOT_MINUTES,
    },
  );
  const requestedEnd = slot.end;

  await validateSharedSlotOrThrow({
    doctorUuid: appt.doctor_id,
    date: requestedDate,
    start_time: requestedStart,
    end_time: requestedEnd,
    type: appt.appointment_type,
    patientId: appt.patient_id,
    ignoreAppointmentId: appt.id,
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointment_reschedule_requests")
    .insert({
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      doctor_id: appt.doctor_id,
      requested_appointment_date: requestedDate,
      requested_start_time: requestedStart,
      requested_end_time: requestedEnd,
      requested_appointment_type: appt.appointment_type,
      reason,
      requested_by: actor.id,
    })
    .select()
    .single<AppointmentRescheduleRequest>();
  if (error) {
    throw new HttpError(409, "You already have a pending reschedule request for this appointment.");
  }

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_reschedule_requested",
    channels: ["email"],
    payload: {
      appointment_id: appt.id,
      appointment_type: appt.appointment_type,
      appointment_date: requestedDate,
      start_time: requestedStart,
    },
  });
  await enqueueAppointmentTeamNotifications({
    appointment_id: appt.id,
    appointment_type: appt.appointment_type,
    patient_user_id: appt.patient_id,
    appointment_date: requestedDate,
    start_time: requestedStart,
    doctor_user_id: appt.doctor_id,
    excludeUserIds: [actor.id],
    template: "appointment_staff_reschedule_requested",
  });

  const [request] = await mapRequests([data]);
  return request;
}

export async function reviewRescheduleRequest(
  id: string,
  input: ReviewRescheduleRequestInput,
  actor: Actor,
) {
  const action = input.action;
  if (action !== "approve" && action !== "reject") {
    throw new HttpError(400, "Choose approve or reject.");
  }

  const request = await readRequest(id);
  const appt = await readAppointment(request.appointment_id);
  assertCanReview(appt, actor);

  if (request.status !== "Pending") {
    throw new HttpError(400, "This reschedule request has already been reviewed.");
  }
  if (!canPatientChange(appt)) {
    throw new HttpError(400, "Only pending or confirmed appointments can be rescheduled.");
  }

  const supabase = getSupabaseAdmin();
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";

  if (action === "reject") {
    const { data, error } = await supabase
      .from("appointment_reschedule_requests")
      .update({
        status: "Rejected",
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq("id", id)
      .select()
      .single<AppointmentRescheduleRequest>();
    if (error) throw error;

    await enqueueNotification({
      user_id: request.patient_id,
      template: "appointment_reschedule_rejected",
      channels: ["email"],
      payload: {
        appointment_id: request.appointment_id,
        appointment_type: request.requested_appointment_type,
        appointment_date: request.requested_appointment_date,
        start_time: request.requested_start_time,
      },
    });

    const [view] = await mapRequests([data]);
    return {
      request: view,
      appointments: await readAppointmentsForActor(actor),
    };
  }

  const { queueNumber } = await validateSharedSlotOrThrow({
    doctorUuid: appt.doctor_id,
    date: request.requested_appointment_date,
    start_time: request.requested_start_time,
    end_time: request.requested_end_time,
    type: request.requested_appointment_type,
    patientId: request.patient_id,
    ignoreAppointmentId: appt.id,
  });

  const oldSlot = {
    doctor_id: appt.doctor_id,
    appointment_date: appt.appointment_date,
    start_time: appt.start_time,
    end_time: appt.end_time,
  };

  const { error: appointmentError } = await supabase
    .from("appointments")
    .update({
      appointment_date: request.requested_appointment_date,
      start_time: request.requested_start_time,
      end_time: request.requested_end_time,
      appointment_type: request.requested_appointment_type,
      queue_number: queueNumber,
    })
    .eq("id", appt.id);
  if (appointmentError) throw appointmentError;

  await recalculateQueueNumbersForSlot(oldSlot);

  const { data, error } = await supabase
    .from("appointment_reschedule_requests")
    .update({
      status: "Approved",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
    })
    .eq("id", id)
    .select()
    .single<AppointmentRescheduleRequest>();
  if (error) throw error;

  await enqueueNotification({
    user_id: request.patient_id,
    template: "appointment_reschedule_approved",
    channels: ["email", "sms"],
    payload: {
      appointment_id: request.appointment_id,
      appointment_type: request.requested_appointment_type,
      appointment_date: request.requested_appointment_date,
      start_time: request.requested_start_time,
    },
  });
  await enqueueAppointmentTeamNotifications({
    appointment_id: request.appointment_id,
    appointment_type: request.requested_appointment_type,
    patient_user_id: request.patient_id,
    appointment_date: request.requested_appointment_date,
    start_time: request.requested_start_time,
    doctor_user_id: request.doctor_id,
    excludeUserIds: [actor.id],
    template: "appointment_staff_rescheduled",
  });

  const [view] = await mapRequests([data]);
  return {
    request: view,
    appointments: await readAppointmentsForActor(actor),
  };
}
