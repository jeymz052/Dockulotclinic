import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { isPastInClinicTime } from "@/src/lib/timezone";
import type {
  DoctorSchedule,
  DoctorUnavailability,
  ScheduleMode,
} from "@/src/lib/db/types";
import { HttpError } from "@/src/lib/http";

export type Slot = {
  start: string;
  end: string;
  remaining: number;
  disabled: boolean;
  reason?: "full" | "blocked" | "past";
};

export type SchedulableSlot = {
  start: string;
  end: string;
  mode: ScheduleMode;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const BOOKING_RULES = {
  Clinic: {
    days: [2, 4, 6, 5, 0],
    start: "09:00",
    end: "15:00",
    label: "Clinic visits are available on Tuesday, Thursday, Saturday, Friday, and select Sundays from 9:00 AM to 3:00 PM.",
  },
  Online: {
    weekday: {
      days: [1, 2, 3, 4, 5],
      start: "10:00",
      end: "20:00",
      label: "Telemedicine is available Monday to Friday from 10:00 AM to 8:00 PM.",
    },
    weekend: {
      days: [0, 6],
      start: "10:00",
      end: "18:00",
      label: "Telemedicine is available Saturday and Sunday from 10:00 AM to 6:00 PM.",
    },
  },
  Both: {
    days: [0, 6],
    start: "10:00",
    end: "15:00",
    label: "Combined clinic and virtual slots are only available on limited weekend clinic days.",
  },
} as const;

function dayOfWeek(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function expandSlots(start: string, end: string, minutes: number, mode: ScheduleMode) {
  const slots: { start: string; end: string; mode: ScheduleMode }[] = [];
  let cursor = start.length === 5 ? `${start}:00` : start;
  const stop = end.length === 5 ? `${end}:00` : end;
  while (cursor < stop) {
    const next = addMinutes(cursor, minutes);
    if (next > stop) break;
    slots.push({ start: cursor, end: next, mode });
    cursor = next;
  }
  return slots;
}

function normalizeClock(value: string) {
  return value.slice(0, 5);
}

function dayName(day: number) {
  return WEEKDAY_NAMES[day] ?? "Selected day";
}

function isAllowedDay(day: number, allowedDays: readonly number[]) {
  return allowedDays.includes(day);
}

function assertWithinRule(
  day: number,
  start: string,
  end: string,
  rule: { days: readonly number[]; start: string; end: string; label: string },
) {
  const normalizedStart = normalizeClock(start);
  const normalizedEnd = normalizeClock(end);

  if (!isAllowedDay(day, rule.days as number[])) {
    throw new HttpError(400, `${dayName(day)} is outside this schedule type. ${rule.label}`);
  }

  if (normalizedStart < rule.start || normalizedEnd > rule.end) {
    throw new HttpError(400, rule.label);
  }
}

function assertScheduleWithinPolicy(day: number, mode: ScheduleMode, start: string, end: string) {
  if (mode === "Clinic") {
    assertWithinRule(day, start, end, BOOKING_RULES.Clinic);
    return;
  }

  if (mode === "Online") {
    const weekend = BOOKING_RULES.Online.weekend;
    const weekday = BOOKING_RULES.Online.weekday;
    if (isAllowedDay(day, weekday.days)) {
      assertWithinRule(day, start, end, weekday);
      return;
    }
    assertWithinRule(day, start, end, weekend);
    return;
  }

  assertWithinRule(day, start, end, BOOKING_RULES.Both);
}

function mergeScheduleModes(left: ScheduleMode, right: ScheduleMode): ScheduleMode {
  if (left === right) return left;
  return "Both";
}

export async function getSchedulableSlotsForDate(
  doctorId: string,
  date: string,
): Promise<SchedulableSlot[]> {
  const schedules = await getDoctorSchedulesForDate(doctorId, date);
  if (schedules.length) {
    const bySlot = new Map<string, SchedulableSlot>();
    for (const schedule of schedules) {
      const slots = expandSlots(
        schedule.start_time,
        schedule.end_time,
        schedule.slot_minutes,
        schedule.schedule_mode ?? "Both",
      );
      for (const slot of slots) {
        const key = `${slot.start}-${slot.end}`;
        const existing = bySlot.get(key);
        bySlot.set(
          key,
          existing
            ? { ...existing, mode: mergeScheduleModes(existing.mode, slot.mode) }
            : slot,
        );
      }
    }

    return Array.from(bySlot.values()).sort((left, right) => left.start.localeCompare(right.start));
  }

  return [];
}

export async function getDoctorSchedulesForDate(
  doctorId: string,
  date: string,
): Promise<DoctorSchedule[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek(date))
    .eq("is_active", true)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUnavailabilityForDate(
  doctorId: string,
  date: string,
): Promise<DoctorUnavailability[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_unavailability")
    .select("*")
    .eq("doctor_id", doctorId)
    .lt("starts_at", `${date}T23:59:59Z`)
    .gt("ends_at", `${date}T00:00:00Z`);
  if (error) throw error;
  return data ?? [];
}

function overlapsUnavailable(
  date: string,
  slotStart: string,
  slotEnd: string,
  blocks: DoctorUnavailability[],
) {
  const slotFrom = new Date(`${date}T${slotStart}Z`).getTime();
  const slotTo = new Date(`${date}T${slotEnd}Z`).getTime();
  return blocks.some((b) => {
    const from = new Date(b.starts_at).getTime();
    const to = new Date(b.ends_at).getTime();
    return from < slotTo && to > slotFrom;
  });
}

export async function getAvailability(doctorId: string, date: string): Promise<Slot[]> {
  const supabase = getSupabaseAdmin();
  const slots = await getSchedulableSlotsForDate(doctorId, date);
  if (slots.length === 0) return [];
  const blocks = await getUnavailabilityForDate(doctorId, date);

  const { data: counts, error } = await supabase
    .from("appointments")
    .select("start_time, status")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date);
  if (error) throw error;

  const byStart = new Map<string, number>();
  for (const row of counts ?? []) {
    const r = row as { start_time: string; status: string };
    if (r.status === "Cancelled" || r.status === "NoShow") continue;
    const key = r.start_time.slice(0, 8);
    byStart.set(key, (byStart.get(key) ?? 0) + 1);
  }

  return slots.map((s) => {
    const past = isPastInClinicTime(date, s.start);
    const blocked = overlapsUnavailable(date, s.start, s.end, blocks);
    const taken = byStart.get(s.start) ?? 0;
    const full = taken >= 5;
    return {
      start: s.start,
      end: s.end,
      remaining: blocked || past ? 0 : Math.max(0, 5 - taken),
      disabled: past || blocked || full,
      reason: past ? "past" : blocked ? "blocked" : full ? "full" : undefined,
    };
  });
}

export function suggestNextSlot(slots: Slot[]): Slot | null {
  return slots.find((s) => !s.disabled) ?? null;
}

export async function upsertSchedule(input: {
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes?: number;
  schedule_mode?: ScheduleMode;
  is_active?: boolean;
}) {
  if (input.day_of_week < 0 || input.day_of_week > 6)
    throw new HttpError(400, "day_of_week must be 0..6");
  if (input.start_time >= input.end_time)
    throw new HttpError(400, "start_time must be before end_time");
  assertScheduleWithinPolicy(
    input.day_of_week,
    input.schedule_mode ?? "Both",
    input.start_time,
    input.end_time,
  );

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("doctor_schedules")
    .select("id")
    .eq("doctor_id", input.doctor_id)
    .eq("day_of_week", input.day_of_week)
    .eq("schedule_mode", input.schedule_mode ?? "Both")
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("doctor_schedules")
      .update({
        start_time: input.start_time,
        end_time: input.end_time,
        slot_minutes: input.slot_minutes ?? 60,
        schedule_mode: input.schedule_mode ?? "Both",
        is_active: input.is_active ?? true,
      })
      .eq("id", existing.id)
      .select()
      .single<DoctorSchedule>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("doctor_schedules")
    .insert({
      doctor_id: input.doctor_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      slot_minutes: input.slot_minutes ?? 60,
      schedule_mode: input.schedule_mode ?? "Both",
      is_active: input.is_active ?? true,
    })
    .select()
    .single<DoctorSchedule>();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctor_schedules").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSchedule(
  id: string,
  input: {
    start_time?: string;
    end_time?: string;
    slot_minutes?: number;
    schedule_mode?: ScheduleMode;
    is_active?: boolean;
  },
) {
  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("doctor_schedules")
    .select("day_of_week, schedule_mode, start_time, end_time")
    .eq("id", id)
    .maybeSingle<{ day_of_week: number; schedule_mode: ScheduleMode; start_time: string; end_time: string }>();
  if (currentError) throw currentError;

  const nextStart = input.start_time ?? current?.start_time;
  const nextEnd = input.end_time ?? current?.end_time;
  const effectiveDay = current?.day_of_week ?? 0;
  const effectiveMode = input.schedule_mode ?? current?.schedule_mode ?? "Both";

  if (nextStart && nextEnd && nextStart >= nextEnd) {
    throw new HttpError(400, "start_time must be before end_time");
  }
  if (nextStart && nextEnd) {
    assertScheduleWithinPolicy(effectiveDay, effectiveMode, nextStart, nextEnd);
  }

  const { data, error } = await supabase
    .from("doctor_schedules")
    .update(input)
    .eq("id", id)
    .select()
    .single<DoctorSchedule>();
  if (error) throw error;
  return data;
}

export async function addUnavailability(input: {
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  reason?: string;
}) {
  if (input.starts_at >= input.ends_at)
    throw new HttpError(400, "starts_at must be before ends_at");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_unavailability")
    .insert({
      doctor_id: input.doctor_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      reason: input.reason ?? null,
    })
    .select()
    .single<DoctorUnavailability>();
  if (error) throw error;
  return data;
}

export async function deleteUnavailability(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctor_unavailability").delete().eq("id", id);
  if (error) throw error;
}
