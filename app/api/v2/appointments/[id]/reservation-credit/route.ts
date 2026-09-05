import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: reservation, error } = await supabase
      .from("online_booking_reservations")
      .select("amount")
      .eq("appointment_id", id)
      .eq("status", "Converted")
      .eq("appointment_type", "Clinic")
      .maybeSingle<{ amount: number }>();

    if (error) throw error;

    return ok({
      hasReservation: Boolean(reservation && Number(reservation.amount) > 0),
      amount: reservation ? Number(reservation.amount) : 0,
    });
  } catch (e) {
    return httpError(e);
  }
}
