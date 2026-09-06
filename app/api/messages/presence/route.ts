import { NextResponse } from "next/server";
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

/** PATCH /api/messages/presence — update last_seen_at for the authenticated user */
export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (error) {
    console.error("[PATCH /api/messages/presence]", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
