import { NextResponse } from "next/server";
import { HttpError, httpError, requireRole } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { logActivity } from "@/src/lib/services/activity-log";

const BACKUP_TABLES = [
  "profiles",
  "patients",
  "doctors",
  "appointments",
  "consultation_notes",
  "prescriptions",
  "billings",
  "payments",
  "content_posts",
  "inquiries",
  "follow_up_inquiries",
] as const;

export async function GET(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "backup-export", 5, 60_000);
    const actor = await requireRole(req, ["super_admin", "admin", "secretary", "doctor"]);
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      exported_by: actor.id,
      tables: {},
    };

    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select("*").limit(5000);
      if (error) throw error;
      (payload.tables as Record<string, unknown>)[table] = data ?? [];
    }

    await logActivity({
      actor,
      action: "backup.export",
      entity_table: "system",
      metadata: { tables: BACKUP_TABLES },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="clinic-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return httpError(e);
    return httpError(e);
  }
}
