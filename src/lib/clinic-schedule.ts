export const CONSULTATION_SLOT_MINUTES = 30;
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
    schedule: "Monday to Saturday, 9:00 AM - 4:00 PM",
    note: "Clinic visits and medical procedures follow this in-person schedule.",
    coordinates: {
      latitude: 6.962453,
      longitude: 122.12991,
    },
  },
  {
    value: "rt-lim-family-hospital",
    label: "RT Lim Family Hospital",
    schedule: "1st and 3rd Sundays, 9:00 AM - 4:00 PM",
    note: "Sunday booking opens only on the 1st and 3rd Sunday of each month.",
    coordinates: {
      latitude: 7.6515375,
      longitude: 122.466453125,
    },
  },
];

export const STANDARD_CLINIC_SCHEDULES = [
  { day_of_week: 1, label: "Monday", clinic: "FamMed Family Clinic" },
  { day_of_week: 2, label: "Tuesday", clinic: "FamMed Family Clinic" },
  { day_of_week: 3, label: "Wednesday", clinic: "FamMed Family Clinic" },
  { day_of_week: 4, label: "Thursday", clinic: "FamMed Family Clinic" },
  { day_of_week: 5, label: "Friday", clinic: "FamMed Family Clinic" },
  { day_of_week: 6, label: "Saturday", clinic: "FamMed Family Clinic" },
  { day_of_week: 0, label: "1st and 3rd Sunday", clinic: "RT Lim Family Hospital" },
] as const;

export const STANDARD_VIRTUAL_SCHEDULES = [
  { day_of_week: 0, label: "Sunday" },
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

export function isClinicProcedureBookingDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day >= 1 && day <= 6) return true;
  return day === 0 && isFirstOrThirdSunday(date);
}

export function isVirtualConsultBookingDate(date?: string) {
  void date;
  return true;
}

export function resolveClinicLocationForDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day >= 1 && day <= 6) return BOOKING_CLINIC_LOCATIONS[0];
  if (day === 0 && isFirstOrThirdSunday(date)) return BOOKING_CLINIC_LOCATIONS[1];
  return null;
}

export function resolveAppointmentLocationLabel(
  date: string | undefined,
  type: "Clinic" | "Online",
) {
  if (type === "Online") return "Virtual Consult";
  if (!date) return "Doc Kulot Clinic";
  return resolveClinicLocationForDate(date)?.label ?? "Doc Kulot Clinic";
}

export function standardBookingDateMessage(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 0) {
    return "RT Lim Family Hospital accepts bookings only on the 1st and 3rd Sunday, 9:00 AM - 4:00 PM.";
  }
  return "FamMed Family Clinic accepts bookings Monday to Saturday, 9:00 AM - 4:00 PM.";
}
