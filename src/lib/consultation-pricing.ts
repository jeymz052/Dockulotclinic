function parseClockToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export type ClinicPatientCategory = "New" | "Existing";
export type BookingPatientStatus = "New" | "Existing";
export type ClinicConsultKind = "FirstConsult" | "FollowUp";

export const NEW_PATIENT_CLINIC_CONSULTATION_FEE = 600;
export const FOLLOW_UP_CLINIC_CONSULTATION_FEE = 300;
export const ONLINE_CONSULTATION_FEE = 800;
export const PROCEDURE_DOWNPAYMENT_AMOUNT = 1000;
// Non-refundable reservation fee collected online (PayMongo QR Ph) to secure a
// clinic visit slot. Deducted from the patient's POS bill on the day of visit.
export const CLINIC_VISIT_RESERVATION_FEE = 200;

export const DEFAULT_CLINIC_CONSULTATION_FEE = NEW_PATIENT_CLINIC_CONSULTATION_FEE;
export const DEFAULT_ONLINE_CONSULTATION_FEE = ONLINE_CONSULTATION_FEE;

export function normalizeConfiguredClinicConsultationRate(value: number) {
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_CLINIC_CONSULTATION_FEE;
}

export function normalizeConfiguredOnlineConsultationRate(value: number) {
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_ONLINE_CONSULTATION_FEE;
}

export function resolveClinicConsultationFee(input: {
  patientCategory?: ClinicPatientCategory | null;
  patientStatus?: BookingPatientStatus | null;
  consultKind?: ClinicConsultKind | null;
  hasPriorClinicConsultation?: boolean;
}) {
  if (input.consultKind === "FollowUp") {
    return FOLLOW_UP_CLINIC_CONSULTATION_FEE;
  }
  if (input.consultKind === "FirstConsult") {
    return NEW_PATIENT_CLINIC_CONSULTATION_FEE;
  }
  if (input.patientCategory === "Existing") {
    return FOLLOW_UP_CLINIC_CONSULTATION_FEE;
  }
  if (input.patientStatus === "Existing") {
    return FOLLOW_UP_CLINIC_CONSULTATION_FEE;
  }
  if (input.hasPriorClinicConsultation) {
    return FOLLOW_UP_CLINIC_CONSULTATION_FEE;
  }
  return NEW_PATIENT_CLINIC_CONSULTATION_FEE;
}

export function getAppointmentDurationMinutes(start: string, end: string) {
  return Math.max(0, parseClockToMinutes(end) - parseClockToMinutes(start));
}

export function getAppointmentDurationHours(start: string, end: string) {
  return getAppointmentDurationMinutes(start, end) / 60;
}

export function calculateOnlineConsultationCharge(start: string, end: string) {
  void start;
  void end;
  return ONLINE_CONSULTATION_FEE;
}

export function formatDurationLabel(start: string, end: string) {
  const hours = getAppointmentDurationHours(start, end);
  if (Number.isInteger(hours)) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  return `${hours.toFixed(2).replace(/\.?0+$/, "")} hrs`;
}
