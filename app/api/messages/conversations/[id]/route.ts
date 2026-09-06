import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  try {
    return await requireAuthenticatedUser(token);
  } catch {
    return null;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/messages/conversations/[id] — fetch conversation + paginated messages */
export async function GET(request: Request, context: RouteContext) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const before = url.searchParams.get("before"); // cursor: load messages before this timestamp
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

  const supabase = getSupabaseAdmin();
  const userId = auth.user.id;

  // Verify user has access to this conversation
  let convQuery = supabase
    .from("message_conversations")
    .select(
      `id, patient_id, clinic_user_id, last_message_at, last_message_preview,
       unread_clinic, unread_patient, created_at,
       patient:profiles!message_conversations_patient_id_fkey(id, full_name, avatar_url, last_seen_at),
       clinic_user:profiles!message_conversations_clinic_user_id_fkey(id, full_name, avatar_url, last_seen_at)`
    )
    .eq("id", id);

  if (auth.role === "PATIENT") {
    convQuery = convQuery.eq("patient_id", userId);
  }

  const { data: conversation, error: convError } = await convQuery.maybeSingle();
  if (convError) {
    console.error("[GET /api/messages/conversations/[id]]", convError);
    return NextResponse.json({ message: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ message: "Conversation not found" }, { status: 404 });
  }

  // Fetch paginated messages
  let msgQuery = supabase
    .from("messages")
    .select(
      `id, conversation_id, sender_id, body,
       attachment_url, attachment_type, attachment_name, attachment_size,
       is_read, read_at, created_at,
       sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)`
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    msgQuery = msgQuery.lt("created_at", before);
  }

  const { data: messages, error: msgError } = await msgQuery;
  if (msgError) {
    console.error("[GET /api/messages/conversations/[id] messages]", msgError);
    return NextResponse.json({ message: msgError.message }, { status: 500 });
  }

  // Return messages in chronological order
  const chronological = [...(messages ?? [])].reverse();

  return NextResponse.json({ conversation, messages: chronological });
}

/** PATCH /api/messages/conversations/[id] — mark messages as read / send a message */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "messages.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { action: "mark_read" | "send"; message?: { body?: string; attachment_url?: string; attachment_type?: string; attachment_name?: string; attachment_size?: number } };

  const supabase = getSupabaseAdmin();
  const userId = auth.user.id;

  if (body.action === "mark_read") {
    // Find out which side the user is (to zero out the right unread counter)
    const { data: conv } = await supabase
      .from("message_conversations")
      .select("patient_id, clinic_user_id")
      .eq("id", id)
      .maybeSingle<{ patient_id: string; clinic_user_id: string }>();

    if (!conv) {
      return NextResponse.json({ message: "Conversation not found" }, { status: 404 });
    }

    const isPatient = conv.patient_id === userId;
    const unreadField = isPatient ? "unread_patient" : "unread_clinic";

    // Mark individual message rows as read
    await supabase
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .neq("sender_id", userId)
      .eq("is_read", false);

    // Zero out unread counter for this side
    await supabase
      .from("message_conversations")
      .update({ [unreadField]: 0, updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  }

  if (body.action === "send") {
    if (!body.message?.body && !body.message?.attachment_url) {
      return NextResponse.json({ message: "Message body or attachment required" }, { status: 400 });
    }

    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: userId,
        body: body.message.body ?? null,
        attachment_url: body.message.attachment_url ?? null,
        attachment_type: body.message.attachment_type ?? null,
        attachment_name: body.message.attachment_name ?? null,
        attachment_size: body.message.attachment_size ?? null,
      })
      .select(
        `id, conversation_id, sender_id, body,
         attachment_url, attachment_type, attachment_name, attachment_size,
         is_read, read_at, created_at,
         sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)`
      )
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/messages/conversations/[id] send]", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: msg }, { status: 201 });
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
