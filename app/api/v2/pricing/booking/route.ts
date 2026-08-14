import { httpError, ok } from "@/src/lib/http";
import { BOOKING_PRICING_DEFINITIONS } from "@/src/lib/booking-pricing";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const bookingCodes = BOOKING_PRICING_DEFINITIONS.map((item) => item.code);
    const { data, error } = await supabase
      .from("pricing")
      .select("id, code, name, category, price, is_active")
      .in("code", bookingCodes)
      .order("category")
      .order("name");

    if (error) throw error;

    return ok({
      pricing: (data ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      })),
    });
  } catch (e) {
    return httpError(e);
  }
}
