function parseClockToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export type ClinicPatientCategory = "New" | "Regular" | "OldRecord";
export type BookingPatientStatus = "New" | "Existing";

export const NEW_PATIENT_CLINIC_CONSULTATION_FEE = 600;
export const FOLLOW_UP_CLINIC_CONSULTATION_FEE = 300;
export const ONLINE_CONSULTATION_FEE = 800;
export const PROCEDURE_DOWNPAYMENT_AMOUNT = 1000;

export const CLINIC_CONSULTATION_HOURLY_RATE = NEW_PATIENT_CLINIC_CONSULTATION_FEE;
export const ONLINE_CONSULTATION_HOURLY_RATE = ONLINE_CONSULTATION_FEE;

export function normalizeConfiguredClinicConsultationRate(value: number) {
  return Number.isFinite(value) && value > 0
    ? value
    : CLINIC_CONSULTATION_HOURLY_RATE;
}

export function normalizeConfiguredOnlineConsultationRate(value: number) {
  return Number.isFinite(value) && value > 0
    ? value
    : ONLINE_CONSULTATION_HOURLY_RATE;
}

export function resolveClinicConsultationFee(input: {
  patientCategory?: ClinicPatientCategory | null;
  patientStatus?: BookingPatientStatus | null;
  hasPriorClinicConsultation?: boolean;
}) {
  const isNewPatient = input.patientStatus === "New" || input.patientCategory === "New";
  if (isNewPatient && input.hasPriorClinicConsultation) {
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

export function calculateConsultationCharge(hourlyRate: number, start: string, end: string) {
  const hours = getAppointmentDurationHours(start, end);
  return Math.round(hourlyRate * hours * 100) / 100;
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
