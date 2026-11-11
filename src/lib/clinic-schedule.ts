export const CONSULTATION_SLOT_MINUTES = 20;
export const PROCEDURE_SLOT_MINUTES = 60;
export const MAX_BOOKINGS_PER_SLOT = 1;
export const STANDARD_BOOKING_START = "09:00";
export const STANDARD_BOOKING_END = "16:00";
export const VIRTUAL_CONSULT_START = "08:00";
export const VIRTUAL_CONSULT_END = "20:00";

export type BookingClinicLocation = {
  value: string;
  label: string;
  note: string;
  schedule: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
};

export const BOOKING_CLINIC_LOCATIONS: BookingClinicLocation[] = [
  {
    value: "fammed-family-clinic",
    label: "FamMed Family Clinic",
    schedule: "Monday to Friday, 9:00 AM - 4:00 PM",
    note: "Clinic visits and medical procedures follow this in-person schedule.",
    coordinates: {
      latitude: 6.962453,
      longitude: 122.12991,
    },
  },
];

export const STANDARD_CLINIC_SCHEDULES = [
  { day_of_week: 1, label: "Monday", clinic: "FamMed Family Clinic" },
  { day_of_week: 2, label: "Tuesday", clinic: "FamMed Family Clinic" },
  { day_of_week: 3, label: "Wednesday", clinic: "FamMed Family Clinic" },
  { day_of_week: 4, label: "Thursday", clinic: "FamMed Family Clinic" },
  { day_of_week: 5, label: "Friday", clinic: "FamMed Family Clinic" },
] as const;

export const STANDARD_VIRTUAL_SCHEDULES = [
  { day_of_week: 1, label: "Monday" },
  { day_of_week: 2, label: "Tuesday" },
  { day_of_week: 3, label: "Wednesday" },
  { day_of_week: 4, label: "Thursday" },
  { day_of_week: 5, label: "Friday" },
  { day_of_week: 6, label: "Saturday" },
] as const;

export function normalizeScheduleTime(value: string) {
  return value.length === 5 ? value : value.slice(0, 5);
}

export function getSundayOccurrenceInMonth(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (parsed.getUTCDay() !== 0) return null;
  return Math.floor((parsed.getUTCDate() - 1) / 7) + 1;
}

export function isFirstOrThirdSunday(date: string) {
  const occurrence = getSundayOccurrenceInMonth(date);
  return occurrence === 1 || occurrence === 3;
}

export const SALE_BUY_START = "2026-11-11T00:00:00+08:00";
export const SALE_BUY_END = "2026-11-14T23:59:59+08:00";
export const SALE_SCHEDULE_MAX_DATE = "2026-11-30";
export const SALE_PROCEDURE_START_TIME = "09:00";
export const SALE_PROCEDURE_END_TIME = "15:00";

export function is1111SalePeriod(time = Date.now()) {
  const start = new Date(SALE_BUY_START).getTime();
  const end = new Date(SALE_BUY_END).getTime();
  return time >= start && time <= end;
}

export function isProcedureSaleSchedulableDate(date: string) {
  if (date > SALE_SCHEDULE_MAX_DATE) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function isClinicProcedureBookingDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Monday to Friday only
  return day >= 1 && day <= 5;
}

export function isVirtualConsultBookingDate(date?: string, todayDate?: string) {
  if (!date) return true;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Monday to Saturday only (1 to 6) - no Sunday
  if (day < 1 || day > 6) return false;
  // No same-day booking for virtual consult! Must be at least tomorrow
  if (todayDate && date <= todayDate) return false;
  return true;
}

export function resolveClinicLocationForDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day >= 1 && day <= 5) return BOOKING_CLINIC_LOCATIONS[0];
  return null;
}

export function resolveAppointmentLocationLabel(
  date: string | undefined,
  type: "Clinic" | "Online",
) {
  if (type === "Online") return "Virtual Consult";
  if (!date) return "Doc Kulot Clinic";
  return resolveClinicLocationForDate(date)?.label ?? "FamMed Family Clinic";
}

export function standardBookingDateMessage(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) {
    return "FamMed Family Clinic accepts in-person bookings Monday to Friday, 9:00 AM - 4:00 PM.";
  }
  return "FamMed Family Clinic accepts bookings Monday to Friday, 9:00 AM - 4:00 PM.";
}
