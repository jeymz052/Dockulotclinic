import {
  CLINIC_VISIT_RESERVATION_FEE,
  FOLLOW_UP_CLINIC_CONSULTATION_FEE,
  NEW_PATIENT_CLINIC_CONSULTATION_FEE,
  ONLINE_CONSULTATION_FEE,
  PROCEDURE_DOWNPAYMENT_AMOUNT,
  type BookingPatientStatus,
  type ClinicConsultKind,
  type ClinicPatientCategory,
} from "@/src/lib/consultation-pricing";

export type PricingCategory = "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";

export type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: PricingCategory;
  price: number;
  is_active: boolean;
};

export const BOOKING_PRICING_CODES = {
  CLINIC_FIRST_CONSULT: "GEN-CONSULT",
  CLINIC_FOLLOW_UP: "FOLLOW-UP",
  CLINIC_VISIT_RESERVATION: "CLINIC-VISIT-RESERVATION",
  VIRTUAL_CONSULT: "ONLINE-CONSULT",
  MEDICAL_CERTIFICATE_ADDON: "ONLINE-MEDCERT",
  PROCEDURE_RESERVATION: "PROC-RESERVATION",
} as const;

export type BookingPricingCode =
  (typeof BOOKING_PRICING_CODES)[keyof typeof BOOKING_PRICING_CODES]
  | ProcedurePricingCode;

export const PROCEDURE_PRICING_CODES = {
  "Botox": "PROC-BOTOX",
  "Mesolipo": "PROC-MESOLIPO",
  "Fillers": "PROC-FILLERS",
  "Sclerotherapy": "PROC-SCLEROTHERAPY",
  "Wart Removal / Skin Tag Removal": "PROC-WART-REMOVAL",
  "Mole Surgery": "PROC-MOLE-SURGERY",
  "GLP Initiation": "PROC-GLP-INITIATION",
  "GlowRx Program": "PROC-GLOWRX",
  "Botox - Whole Face": "PROC-BOTOX-WHOLE-FACE",
  "Botox - Whole Face (incl Jawtox)": "PROC-BOTOX-WHOLE-FACE",
  "Botox - Jawtox": "PROC-BOTOX-JAWTOX",
  "Botox - Forehead": "PROC-BOTOX-FOREHEAD",
  "Botox - Alartox": "PROC-BOTOX-ALARTOX",
  "Botox - Nefertiti": "PROC-BOTOX-NEFERTITI",
  "Botox - Barbie Arm": "PROC-BOTOX-BARBIE-ARM",
  "Botox - Traptox": "PROC-BOTOX-TRAPTOX",
  "Botox - Mesolift": "PROC-BOTOX-MESOLIFT",
  "Mesolipo - Chin": "PROC-MESOLIPO-CHIN",
  "Mesolipo - Face": "PROC-MESOLIPO-FACE",
  "Mesolipo - Arms": "PROC-MESOLIPO-ARMS",
  "Fillers - Lips": "PROC-FILLERS-LIPS",
  "Fillers - Chin": "PROC-FILLERS-CHIN",
  "PinkGlow": "PROC-PINKGLOW",
  "RedGlow": "PROC-REDGLOW",
  "CrystalGlow": "PROC-CRYSTALGLOW",
} as const;

export type ProcedurePricingCode = (typeof PROCEDURE_PRICING_CODES)[keyof typeof PROCEDURE_PRICING_CODES];

export type BookingPricingGroup = "Clinic Visit" | "Virtual Consult" | "Medical Procedure";

export type BookingPricingDefinition = {
  code: BookingPricingCode;
  name: string;
  category: PricingCategory;
  group: BookingPricingGroup;
  defaultPrice: number;
  bookingUse: string;
  note: string;
};

export const BOOKING_PRICING_DEFINITIONS: BookingPricingDefinition[] = [
  {
    code: BOOKING_PRICING_CODES.CLINIC_FIRST_CONSULT,
    name: "First Clinic Consultation",
    category: "Consultation",
    group: "Clinic Visit",
    defaultPrice: NEW_PATIENT_CLINIC_CONSULTATION_FEE,
    bookingUse: "Shown when patient selects first clinic consult",
    note: "Used for in-person clinic visit booking and POS consultation fee guidance.",
  },
  {
    code: BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP,
    name: "Clinic Follow-up Consultation",
    category: "Consultation",
    group: "Clinic Visit",
    defaultPrice: FOLLOW_UP_CLINIC_CONSULTATION_FEE,
    bookingUse: "Shown when patient selects follow-up clinic consult",
    note: "Used for returning clinic visit booking and follow-up fee guidance.",
  },
  {
    code: BOOKING_PRICING_CODES.VIRTUAL_CONSULT,
    name: "Virtual Consult",
    category: "Consultation",
    group: "Virtual Consult",
    defaultPrice: ONLINE_CONSULTATION_FEE,
    bookingUse: "Charged before virtual consult confirmation",
    note: "Used by booking checkout and public virtual consult service cards.",
  },
  {
    code: BOOKING_PRICING_CODES.MEDICAL_CERTIFICATE_ADDON,
    name: "Medical Certificate Add-on",
    category: "Other",
    group: "Virtual Consult",
    defaultPrice: 200,
    bookingUse: "Optional virtual consult add-on for a medical certificate request",
    note: "Available only for virtual consult bookings. Physical clinic certificates remain handled in person.",
  },
  {
    code: BOOKING_PRICING_CODES.CLINIC_VISIT_RESERVATION,
    name: "Clinic Visit Reservation Fee",
    category: "Consultation",
    group: "Clinic Visit",
    defaultPrice: CLINIC_VISIT_RESERVATION_FEE,
    bookingUse: "Non-refundable fee charged online before clinic visit confirmation",
    note: "Deducted from the patient's POS bill on the day of visit. Prevents no-shows.",
  },
  {
    code: BOOKING_PRICING_CODES.PROCEDURE_RESERVATION,
    name: "Medical Procedure Reservation Fee",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: PROCEDURE_DOWNPAYMENT_AMOUNT,
    bookingUse: "Charged before procedure schedule confirmation",
    note: "Deductible reservation fee for appointment-only medical procedures.",
  },
  {
    code: PROCEDURE_PRICING_CODES.Botox,
    name: "Botox",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 6499,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Starts-at price. Specific area pricing varies (Whole Face, Jawtox, Forehead, etc.).",
  },
  {
    code: PROCEDURE_PRICING_CODES.Mesolipo,
    name: "Mesolipo",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 3999,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Starts-at price. Specific area pricing varies (Chin, Face, Arms).",
  },
  {
    code: PROCEDURE_PRICING_CODES.Fillers,
    name: "Fillers",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 8999,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Starts-at price. Specific area pricing varies (Lips, Chin).",
  },
  {
    code: PROCEDURE_PRICING_CODES.Sclerotherapy,
    name: "Sclerotherapy",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 5999,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Final procedure bill can still vary by treatment plan.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Wart Removal / Skin Tag Removal"],
    name: "Wart Removal / Skin Tag Removal",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 2999,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Final procedure bill can still vary by treatment plan.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Mole Surgery"],
    name: "Mole Surgery",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 6999,
    bookingUse: "Shown as starting price on procedure service cards",
    note: "Final procedure bill can still vary by treatment plan.",
  },
  {
    code: PROCEDURE_PRICING_CODES["GLP Initiation"],
    name: "GLP Initiation",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 10000,
    bookingUse: "Shown as procedure service and standard package reference",
    note: "Base package price is ₱10,000. In POS billing, unit price can be adjusted or split into installments (e.g. ₱5,000 or ₱1,250 per visit).",
  },
  {
    code: PROCEDURE_PRICING_CODES["GlowRx Program"],
    name: "GlowRx Program",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 9999,
    bookingUse: "Shown as program price on procedure service cards",
    note: "5-week program. Final bill follows the structured program plan.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Whole Face"],
    name: "Botox - Whole Face (incl Jawtox)",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 20999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Whole face Botox including Jawtox.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Jawtox"],
    name: "Botox - Jawtox",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 10999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Jawtox-specific Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Forehead"],
    name: "Botox - Forehead",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 6999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Forehead-specific Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Alartox"],
    name: "Botox - Alartox",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 6499,
    bookingUse: "Shown as procedure price on service cards",
    note: "Alartox (nose) Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Nefertiti"],
    name: "Botox - Nefertiti",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 11999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Nefertiti neck lift Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Barbie Arm"],
    name: "Botox - Barbie Arm",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 14999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Barbie Arm Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Traptox"],
    name: "Botox - Traptox",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 14999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Traptox (trapezius) Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Botox - Mesolift"],
    name: "Botox - Mesolift",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 9999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Mesolift Botox procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Mesolipo - Chin"],
    name: "Mesolipo - Chin",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 3999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Chin-specific Mesolipo procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Mesolipo - Face"],
    name: "Mesolipo - Face",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 3999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Face-specific Mesolipo procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Mesolipo - Arms"],
    name: "Mesolipo - Arms",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 5499,
    bookingUse: "Shown as procedure price on service cards",
    note: "Arms-specific Mesolipo procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Fillers - Lips"],
    name: "Fillers - Lips",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 14499,
    bookingUse: "Shown as procedure price on service cards",
    note: "Lip filler procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES["Fillers - Chin"],
    name: "Fillers - Chin",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 8999,
    bookingUse: "Shown as procedure price on service cards",
    note: "Chin filler procedure.",
  },
  {
    code: PROCEDURE_PRICING_CODES.PinkGlow,
    name: "PinkGlow (Microneedle + Exosomes + Botox)",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 7499,
    bookingUse: "Shown as procedure price on service cards",
    note: "PinkGlow treatment — best for brightening dull skin.",
  },
  {
    code: PROCEDURE_PRICING_CODES.RedGlow,
    name: "RedGlow (Microneedle + Exosomes + Botox)",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 7999,
    bookingUse: "Shown as procedure price on service cards",
    note: "RedGlow treatment — for acne treatment.",
  },
  {
    code: PROCEDURE_PRICING_CODES.CrystalGlow,
    name: "CrystalGlow (Microneedle + Exosomes + Botox)",
    category: "Procedure",
    group: "Medical Procedure",
    defaultPrice: 7499,
    bookingUse: "Shown as procedure price on service cards",
    note: "CrystalGlow treatment — best for hydrating skin.",
  },
];

export function formatPeso(value: number) {
  return `PHP ${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBookingPeso(value: number) {
  return `${Number(value).toLocaleString("en-PH")} PHP`;
}

export function findPricingByCode(items: PricingItem[], code: string) {
  return items.find((item) => item.code.trim().toUpperCase() === code);
}

export function findActivePricingByCode(items: PricingItem[], code: string) {
  const item = findPricingByCode(items, code);
  return item?.is_active ? item : null;
}

export function getBookingPriceAmount(items: PricingItem[], code: BookingPricingCode) {
  const configured = findPricingByCode(items, code);
  if (configured) return Number(configured.price);
  return BOOKING_PRICING_DEFINITIONS.find((item) => item.code === code)?.defaultPrice ?? 0;
}

export function getProcedurePricingCode(serviceTitle: string | null | undefined) {
  const normalized = (serviceTitle ?? "").trim();
  return PROCEDURE_PRICING_CODES[normalized as keyof typeof PROCEDURE_PRICING_CODES] ?? null;
}

export function resolveClinicConsultationPriceCode(input: {
  patientCategory?: ClinicPatientCategory | null;
  patientStatus?: BookingPatientStatus | null;
  consultKind?: ClinicConsultKind | null;
  hasPriorClinicConsultation?: boolean;
}) {
  if (input.consultKind === "FollowUp") return BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP;
  if (input.consultKind === "FirstConsult") return BOOKING_PRICING_CODES.CLINIC_FIRST_CONSULT;
  if (input.patientCategory === "Existing") {
    return BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP;
  }
  if (input.patientStatus === "Existing") return BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP;
  if (input.hasPriorClinicConsultation) return BOOKING_PRICING_CODES.CLINIC_FOLLOW_UP;
  return BOOKING_PRICING_CODES.CLINIC_FIRST_CONSULT;
}

export function getClinicConsultationAmount(
  items: PricingItem[],
  consultKind: ClinicConsultKind,
) {
  const code = resolveClinicConsultationPriceCode({ consultKind });
  return getBookingPriceAmount(items, code);
}

export function getProcedureDisplayPriceLabel(items: PricingItem[], serviceTitle: string) {
  const code = getProcedurePricingCode(serviceTitle);
  if (!code) return null;
  const amount = getBookingPriceAmount(items, code);
  return amount > 0 ? `Starts at ${formatBookingPeso(amount)}` : "Consultation required";
}

export const SALE_DISCOUNT_PERCENT = 11;

export function getDiscountedPrice(price: number): number {
  return Math.round(price * (1 - SALE_DISCOUNT_PERCENT / 100));
}

export function getProcedureDiscountInfo(items: PricingItem[], serviceTitle: string) {
  const code = getProcedurePricingCode(serviceTitle);
  if (!code) return null;
  const original = getBookingPriceAmount(items, code);
  if (original <= 0) return null;
  const discounted = getDiscountedPrice(original);
  const savings = original - discounted;
  return {
    original,
    discounted,
    savings,
    discountPercent: SALE_DISCOUNT_PERCENT,
  };
}
