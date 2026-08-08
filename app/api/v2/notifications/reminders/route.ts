import { isAuthorizedCronRequest } from "@/src/lib/cron";
import { httpError, ok } from "@/src/lib/http";
import { enqueueNotification } from "@/src/lib/services/notification";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function handleReminderCron(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return ok({ message: "Forbidden" }, 403);
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const horizonIso = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_date, start_time, status, appointment_type, meeting_link")
      .in("status", ["Confirmed"])
      .gte("appointment_date", nowIso.slice(0, 10))
      .lte("appointment_date", horizonIso.slice(0, 10));
    if (error) throw error;

    let enqueued24 = 0;
    let enqueued6 = 0;

    for (const row of appts ?? []) {
      const r = row as {
        id: string;
        patient_id: string;
        appointment_date: string;
        start_time: string;
        appointment_type: string;
        meeting_link: string | null;
      };

      const startAt = new Date(`${r.appointment_date}T${r.start_time}Z`);
      if (startAt <= now) continue;

      const reminder24At = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
      if (reminder24At > now) {
        const { data: existing24 } = await supabase
          .from("notifications")
          .select("id")
          .eq("template", "appointment_reminder_24h")
          .eq("user_id", r.patient_id)
          .contains("payload", { appointment_id: r.id })
          .maybeSingle();

        if (!existing24) {
          await enqueueNotification({
            user_id: r.patient_id,
            template: "appointment_reminder_24h",
            channels: ["email", "sms"],
            payload: {
              appointment_id: r.id,
              appointment_type: r.appointment_type,
              meeting_link: r.meeting_link,
            },
            send_at: reminder24At.toISOString(),
          });
          enqueued24++;
        }
      }

      const reminder6At = new Date(startAt.getTime() - 6 * 60 * 60 * 1000);
      if (reminder6At > now) {
        const { data: existing6 } = await supabase
          .from("notifications")
          .select("id")
          .eq("template", "appointment_reminder_6h")
          .eq("user_id", r.patient_id)
          .contains("payload", { appointment_id: r.id })
          .maybeSingle();

        if (!existing6) {
          await enqueueNotification({
            user_id: r.patient_id,
            template: "appointment_reminder_6h",
            channels: ["email"],
            payload: {
              appointment_id: r.id,
              appointment_type: r.appointment_type,
              meeting_link: r.meeting_link,
            },
            send_at: reminder6At.toISOString(),
          });
          enqueued6++;
        }
      }

    }

    return ok({ scanned: appts?.length ?? 0, enqueued_24h: enqueued24, enqueued_6h: enqueued6 });
  } catch (e) {
    return httpError(e);
  }
}

export async function GET(req: Request) {
  return handleReminderCron(req);
}

export async function POST(req: Request) {
  return handleReminderCron(req);
}
