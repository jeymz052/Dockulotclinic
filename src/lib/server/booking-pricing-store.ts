import {
  BOOKING_PRICING_CODES,
  BOOKING_PRICING_DEFINITIONS,
  getBookingPriceAmount,
  getDiscountedPrice,
  getProcedurePricingCode,
  is1111SalePeriod,
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
      BOOKING_PRICING_CODES.CLINIC_VISIT_RESERVATION,
      BOOKING_PRICING_CODES.VIRTUAL_CONSULT,
      BOOKING_PRICING_CODES.PROCEDURE_RESERVATION,
      BOOKING_PRICING_CODES.MEDICAL_CERTIFICATE_ADDON,
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

export async function resolveMedicalCertificateAddonAmount() {
  return resolveBookingPricingAmount(BOOKING_PRICING_CODES.MEDICAL_CERTIFICATE_ADDON);
}

export async function resolveProcedureReservationAmount() {
  return resolveBookingPricingAmount(BOOKING_PRICING_CODES.PROCEDURE_RESERVATION);
}

export async function resolveProcedureCheckoutAmount(serviceTitle: string | null | undefined, time = Date.now()) {
  if (is1111SalePeriod(time)) {
    const code = getProcedurePricingCode(serviceTitle);
    if (code) {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("pricing")
        .select("price")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

      const basePrice = data?.price
        ? Number(data.price)
        : BOOKING_PRICING_DEFINITIONS.find((item) => item.code === code)?.defaultPrice ?? 0;

      if (basePrice > 0) {
        return getDiscountedPrice(basePrice);
      }
    }
  }

  // Outside 11.11 sale (or fallback): normal ₱1,000 reservation fee
  return resolveProcedureReservationAmount();
}

export async function resolveClinicVisitReservationAmount() {
  return resolveBookingPricingAmount(BOOKING_PRICING_CODES.CLINIC_VISIT_RESERVATION);
}

export async function resolveClinicConsultationAmount(input: {
  patientCategory?: ClinicPatientCategory | null;
  patientStatus?: BookingPatientStatus | null;
  consultKind?: ClinicConsultKind | null;
  hasPriorClinicConsultation?: boolean;
}) {
  return resolveBookingPricingAmount(resolveClinicConsultationPriceCode(input));
}
