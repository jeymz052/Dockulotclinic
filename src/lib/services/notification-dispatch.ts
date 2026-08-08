import { renderTemplate, sendEmail, sendSms } from "@/src/lib/services/notifier";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type NotificationRow = {
  id: string;
  user_id: string | null;
  channel: "email" | "sms";
  template: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  send_at: string | null;
};

export async function processDueNotifications(limit = 100) {
  const supabase = getSupabaseAdmin();

  const { data: queued, error } = await supabase
    .from("notifications")
    .select("id, user_id, channel, template, payload, status, send_at")
    .in("status", ["queued", "Pending"])
    .limit(limit);
  if (error) throw error;

  const rows = (queued ?? []) as NotificationRow[];
  if (rows.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, phone")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { id: string; email: string; phone: string | null }]),
  );

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        const profile = row.user_id ? profilesById.get(row.user_id) : null;
        if (!profile) throw new Error("Recipient profile missing");

        const rendered = renderTemplate(row.template ?? "welcome", row.payload ?? {}, row.channel);
        const subject = rendered.subject;
        const body = rendered.body;

        if (row.channel === "email") {
          await sendEmail({ to: profile.email, subject, body });
        } else {
          if (!profile.phone) throw new Error("No phone on profile");
          await sendSms({ to: profile.phone, body });
        }

        await supabase
          .from("notifications")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", row.id);
        succeeded++;
      } catch (e) {
        failed++;
        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error: e instanceof Error ? e.message : "Unknown error",
          })
          .eq("id", row.id);
      }
    }),
  );

  return { processed: rows.length, succeeded, failed };
}
