import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Public GET endpoint — no auth required.
 * Returns active doctor_unavailability ranges where clinic visits are closed.
 * Used by the public announcement banner to inform patients of upcoming closures.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Fetch rows that end in the future and either affect Clinic only, or affect all types.
    // We intentionally exclude Online-only blocks since those don't affect clinic visit availability.
    const { data, error } = await supabase
      .from("doctor_unavailability")
      .select("starts_at, ends_at, reason, affected_type")
      .gt("ends_at", now)
      .or("affected_type.is.null,affected_type.eq.Clinic")
      .order("starts_at", { ascending: true });

    if (error) throw error;

    const rawClosures = (data ?? []).map((row) => {
      const r = row as {
        starts_at: string;
        ends_at: string;
        reason: string | null;
        affected_type: string | null;
      };
      // ends_at is exclusive (the day AFTER the last blocked day)
      const lastDay = new Date(r.ends_at);
      lastDay.setUTCDate(lastDay.getUTCDate() - 1);
      return {
        start: r.starts_at.slice(0, 10),
        end: lastDay.toISOString().slice(0, 10),
        note: r.reason ?? null,
        // clinicOnly = true when only clinic visits are blocked, virtual consult stays open
        clinicOnly: r.affected_type === "Clinic",
      };
    });

    // Merge adjacent / consecutive or overlapping date ranges with matching clinicOnly status
    const closures: typeof rawClosures = [];
    for (const item of rawClosures) {
      const prev = closures[closures.length - 1];
      if (!prev) {
        closures.push({ ...item });
        continue;
      }

      const nextDayAfterPrev = new Date(`${prev.end}T00:00:00Z`);
      nextDayAfterPrev.setUTCDate(nextDayAfterPrev.getUTCDate() + 1);
      const nextDayStr = nextDayAfterPrev.toISOString().slice(0, 10);

      if (prev.clinicOnly === item.clinicOnly && item.start <= nextDayStr) {
        if (item.end > prev.end) {
          prev.end = item.end;
        }
        if (item.note && prev.note && !prev.note.includes(item.note)) {
          prev.note = `${prev.note}; ${item.note}`;
        } else if (item.note && !prev.note) {
          prev.note = item.note;
        }
      } else {
        closures.push({ ...item });
      }
    }

    return NextResponse.json({ closures });
  } catch {
    return NextResponse.json({ closures: [] });
  }
}
