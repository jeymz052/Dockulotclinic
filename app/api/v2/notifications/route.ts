import { httpError, ok, requireActor } from "@/src/lib/http";
import { renderTemplate } from "@/src/lib/services/notifier";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type NotificationRow = {
  id: string;
  channel: "email" | "sms";
  template: string | null;
  payload: Record<string, unknown> | null;
  status: "queued" | "sent" | "failed" | string;
  created_at: string;
  send_at: string | null;
  sent_at: string | null;
  is_read: boolean;
};

type NotificationFeedItem = {
  id: string;
  template: string;
  payload: Record<string, unknown>;
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed";
  created_at: string;
  send_at: string | null;
  sent_at: string | null;
  channels: Array<"email" | "sms">;
  is_read: boolean;
  href: string | null;
};

type NotificationFeedResponse = {
  notifications: NotificationFeedItem[];
  count: number;
};

function buildNotificationEventKey(item: NotificationRow) {
  return [item.template ?? "", JSON.stringify(item.payload ?? {}), item.send_at ?? "", item.created_at].join(":");
}

function mergeStatus(current: NotificationFeedItem["status"], next: NotificationRow["status"]) {
  const normalizedNext = normalizeStatus(next);
  if (current === "failed" || normalizedNext === "failed") return "failed";
  if (current === "queued" || normalizedNext === "queued") return "queued";
  return "sent";
}

function normalizeStatus(status: NotificationRow["status"]): NotificationFeedItem["status"] {
  const normalized = String(status).toLowerCase();
  if (normalized === "failed") return "failed";
  if (normalized === "queued" || normalized === "pending") return "queued";
  return "sent";
}

function buildNotificationHref(item: NotificationFeedItem) {
  return item.href;
}

function buildNotificationHrefFromPayload(payload: Record<string, unknown> | null) {
  const appointmentId = typeof payload?.appointment_id === "string" ? payload.appointment_id : null;
  const billingId = typeof payload?.billing_id === "string" ? payload.billing_id : null;
  const prescriptionId = typeof payload?.prescription_id === "string" ? payload.prescription_id : null;

  if (appointmentId) {
    return `/appointments/my?appointment=${encodeURIComponent(appointmentId)}`;
  }

  if (billingId) {
    return `/payments/history?billing=${encodeURIComponent(billingId)}`;
  }

  if (prescriptionId) {
    return "/profile/files";
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();

    // Fetch all notifications (including read ones) for display
    const { data, error } = await supabase
      .from("notifications")
      .select("id, channel, template, payload, status, created_at, send_at, sent_at, is_read")
      .eq("user_id", actor.id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;

    // Count unread notifications
    const { count: unreadCount, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", actor.id)
      .eq("is_read", false);
    if (countError) throw countError;

    const feed = new Map<string, NotificationFeedItem>();

    for (const item of (data ?? []) as NotificationRow[]) {
      const key = buildNotificationEventKey(item);
      const existing = feed.get(key);

      if (!existing) {
        feed.set(key, {
          id: item.id,
          template: item.template ?? "notification",
          payload: item.payload ?? {},
          subject: renderTemplate(item.template ?? "welcome", item.payload ?? {}).subject,
          body: renderTemplate(item.template ?? "welcome", item.payload ?? {}).body,
          status: normalizeStatus(item.status),
          created_at: item.created_at,
          send_at: item.send_at,
          sent_at: item.sent_at,
          channels: [item.channel],
          is_read: item.is_read,
          href: buildNotificationHrefFromPayload(item.payload),
        });
        continue;
      }

      existing.status = mergeStatus(existing.status, item.status);
      if (item.sent_at && (!existing.sent_at || item.sent_at > existing.sent_at)) {
        existing.sent_at = item.sent_at;
      }
      if (!existing.channels.includes(item.channel)) {
        existing.channels.push(item.channel);
      }
      existing.is_read = existing.is_read && item.is_read;
    }

    const notifications = [...feed.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8)
      .map((item) => ({
        ...item,
        href: buildNotificationHref(item),
      }));

    const response: NotificationFeedResponse = {
      notifications,
      count: unreadCount ?? 0,
    };

    return ok(response);
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();
    const body = (await req.json()) as { notification_id?: string; action?: string };
    const { notification_id, action } = body ?? {};

    if (action === "mark_all_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", actor.id)
        .eq("is_read", false);
      if (error) throw error;
      return ok({ success: true });
    }

    if (action === "delete_all") {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", actor.id);
      if (error) throw error;
      return ok({ success: true });
    }

    if (!notification_id) {
      return httpError(new Error("notification_id is required"));
    }

    // Mark a single notification as read
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification_id)
      .eq("user_id", actor.id);
    if (error) throw error;

    return ok({ success: true });
  } catch (e) {
    return httpError(e);
  }
}
