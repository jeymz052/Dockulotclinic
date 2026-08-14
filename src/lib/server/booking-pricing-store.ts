import {
  BOOKING_PRICING_CODES,
  getBookingPriceAmount,
  resolveClinicConsultationPriceCode,
  type BookingPricingCode,
  type PricingItem,
} from "@/src/lib/booking-pricing";
import type {
  BookingPatientStatus,
  ClinicConsultKind,
  ClinicPatientCategory,
} from "@/src/lib/consultation-pricing";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function readActivePricingItems() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pricing")
    .select("id, code, name, category, price, is_active")
    .in("code", [
      BOOKING_PRICING_CODES.CLINIC_FIRST_CONSULT,
      BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP,
      BOOKING_PRICING_CODES.VIRTUAL_CONSULT,
      BOOKING_PRICING_CODES.PROCEDURE_RESERVATION,
    ]);

  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    price: Number(item.price),
  })) as PricingItem[];
}

export async function resolveBookingPricingAmount(code: BookingPricingCode) {
  return getBookingPriceAmount(await readActivePricingItems(), code);
}

export async function resolveVirtualConsultAmount() {
  return resolveBookingPricingAmount(BOOKING_PRICING_CODES.VIRTUAL_CONSULT);
}

export async function resolveProcedureReservationAmount() {
  return resolveBookingPricingAmount(BOOKING_PRICING_CODES.PROCEDURE_RESERVATION);
}

export async function resolveClinicConsultationAmount(input: {
  patientCategory?: ClinicPatientCategory | null;
  patientStatus?: BookingPatientStatus | null;
  consultKind?: ClinicConsultKind | null;
  hasPriorClinicConsultation?: boolean;
}) {
  return resolveBookingPricingAmount(resolveClinicConsultationPriceCode(input));
}
