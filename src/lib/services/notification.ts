import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { NotificationChannel } from "@/src/lib/db/types";
import { processDueNotifications } from "@/src/lib/services/notification-dispatch";

export type NotifyTemplate =
  | "welcome"
  | "verify_email"
  | "appointment_booked"
  | "appointment_staff_confirmed"
  | "appointment_staff_reschedule_requested"
  | "appointment_staff_rescheduled"
  | "appointment_staff_checked_in"
  | "appointment_staff_in_progress"
  | "appointment_staff_completed"
  | "appointment_staff_payment_failed"
  | "appointment_confirmed"
  | "appointment_payment_success"
  | "online_meeting_link"
  | "appointment_paid_and_confirmed"
  | "appointment_payment_failed"
  | "appointment_reminder_24h"
  | "appointment_reminder_6h"
  | "appointment_cancelled"
  | "appointment_reschedule_requested"
  | "appointment_reschedule_approved"
  | "appointment_reschedule_rejected"
  | "billing_issued"
  | "prescription_released"
  | "appointment_staff_booked"
  | "appointment_staff_cancelled";

export async function enqueueNotification(input: {
  user_id: string;
  template: NotifyTemplate;
  channels?: NotificationChannel[];
  payload: Record<string, unknown>;
  send_at?: string;
}) {
  const supabase = getSupabaseAdmin();
  const channels: NotificationChannel[] = input.channels ?? ["email"];
  const rows = channels.map((channel) => ({
    user_id: input.user_id,
    channel,
    status: "queued" as const,
    payload: input.payload,
    template: input.template,
    send_at: input.send_at ?? new Date().toISOString(),
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;

  const latestSendAt = rows.reduce(
    (latest, row) => (row.send_at > latest ? row.send_at : latest),
    rows[0]?.send_at ?? "",
  );

  if (latestSendAt && latestSendAt <= new Date().toISOString()) {
    try {
      await processDueNotifications();
    } catch (dispatchError) {
      console.error("[notifications] auto-dispatch failed", dispatchError);
    }
  }
}

export async function enqueueStaffAppointmentBookedNotifications(input: {
  appointment_id: string;
  appointment_type: string;
  patient_user_id?: string | null;
  patient_name?: string;
  appointment_date?: string;
  start_time?: string;
  doctor_user_id?: string | null;
  excludeUserIds?: string[];
}) {
  return enqueueAppointmentTeamNotifications({
    ...input,
    template: "appointment_staff_booked",
  });
}

export async function enqueueAppointmentTeamNotifications(input: {
  appointment_id: string;
  appointment_type: string;
  patient_user_id?: string | null;
  patient_name?: string;
  appointment_date?: string;
  start_time?: string;
  doctor_user_id?: string | null;
  excludeUserIds?: string[];
  channels?: NotificationChannel[];
  template:
    | "appointment_staff_booked"
    | "appointment_staff_confirmed"
    | "appointment_staff_cancelled"
    | "appointment_staff_reschedule_requested"
    | "appointment_staff_rescheduled"
    | "appointment_staff_checked_in"
    | "appointment_staff_in_progress"
    | "appointment_staff_completed"
    | "appointment_staff_payment_failed";
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["staff", "secretary", "admin", "super_admin"])
    .eq("is_active", true);

  if (error) throw error;

  let patientName = input.patient_name;
  if (!patientName && input.patient_user_id) {
    const { data: patientProfile, error: patientError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", input.patient_user_id)
      .maybeSingle<{ full_name: string }>();
    if (patientError) throw patientError;
    patientName = patientProfile?.full_name;
  }

  const excluded = new Set(input.excludeUserIds ?? []);
  const recipientIds = new Set(
    (data ?? [])
      .map((row) => row.id as string)
      .filter((id) => !excluded.has(id)),
  );

  if (input.doctor_user_id && !excluded.has(input.doctor_user_id)) {
    recipientIds.add(input.doctor_user_id);
  }

  await Promise.all(
    [...recipientIds].map((userId) =>
      enqueueNotification({
        user_id: userId,
        template: input.template,
        channels: input.channels ?? ["email"],
        payload: {
          appointment_id: input.appointment_id,
          appointment_type: input.appointment_type,
          patient_name: patientName,
          appointment_date: input.appointment_date,
          start_time: input.start_time,
        },
      }),
    ),
  );
}
