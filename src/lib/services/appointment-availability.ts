import type { ApptType } from "@/src/lib/db/types";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { normalizeClockTime, isPastInClinicTime } from "@/src/lib/timezone";
import {
  getSchedulableSlotsForDate,
  getUnavailabilityForDate,
} from "@/src/lib/services/schedule";
import { MAX_BOOKINGS_PER_SLOT } from "@/src/lib/clinic-schedule";

export type SharedAvailabilitySlot = {
  start: string;
  end: string;
  mode: "Clinic" | "Online" | "Both";
  bookedCount: number;
  queueNumbers: number[];
  activeType: ApptType | null;
  availableForType: boolean;
  isFull: boolean;
  reason: string;
  nextQueueNumber: number | null;
};

function addDays(date: string, amount: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

function overlapsSlot(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return normalizeClockTime(startA) < normalizeClockTime(endB)
    && normalizeClockTime(endA) > normalizeClockTime(startB);
}

function overlapsUnavailable(
  date: string,
  slotStart: string,
  slotEnd: string,
  blocks: { starts_at: string; ends_at: string; reason: string | null }[],
) {
  const slotFrom = new Date(`${date}T${normalizeClockTime(slotStart)}Z`).getTime();
  const slotTo = new Date(`${date}T${normalizeClockTime(slotEnd)}Z`).getTime();
  return (
    blocks.find((block) => {
      const from = new Date(block.starts_at).getTime();
      const to = new Date(block.ends_at).getTime();
      return from < slotTo && to > slotFrom;
    }) ?? null
  );
}

function getNextQueueNumber(queueNumbers: number[]) {
  const used = new Set(queueNumbers.filter((value) => Number.isInteger(value)));
  let candidate = 1;
  while (candidate <= MAX_BOOKINGS_PER_SLOT && used.has(candidate)) candidate += 1;
  return candidate <= MAX_BOOKINGS_PER_SLOT ? candidate : null;
}

function supportsType(mode: "Clinic" | "Online" | "Both", type: ApptType) {
  return mode === "Both" || mode === type;
}

export async function buildSharedDayAvailability(
  doctorId: string,
  date: string,
  type: ApptType,
  options: { ignoreAppointmentId?: string; slotMinutes?: number } = {},
): Promise<{
  slots: SharedAvailabilitySlot[];
  blockedReason: string | null;
}> {
  const schedulableSlots = await getSchedulableSlotsForDate(doctorId, date, {
    slotMinutes: options.slotMinutes,
    type,
  });
  if (schedulableSlots.length === 0) {
    return { slots: [], blockedReason: "Doctor is not working on this date." };
  }

  const supabase = getSupabaseAdmin();
  let appointmentsQuery = supabase
    .from("appointments")
    .select("id, start_time, end_time, appointment_type, queue_number, status")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date);
  const reservationsQuery = supabase
    .from("online_booking_reservations")
    .select("id, start_time, end_time, queue_number, status")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", date)
    .in("status", ["Pending", "Paid"]);

  if (options.ignoreAppointmentId) {
    appointmentsQuery = appointmentsQuery.neq("id", options.ignoreAppointmentId);
  }

  const [blocks, appointmentsResult, reservationsResult] = await Promise.all([
    getUnavailabilityForDate(doctorId, date, { type }),
    appointmentsQuery,
    reservationsQuery,
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (reservationsResult.error) throw reservationsResult.error;

  const appointments = (appointmentsResult.data ?? []).filter(
    (row) => row.status !== "Cancelled" && row.status !== "NoShow",
  );
  const reservations = reservationsResult.data ?? [];

  const slots = schedulableSlots.map(
    (slot): SharedAvailabilitySlot => {
      const overlapping = appointments
        .filter((row) => overlapsSlot(slot.start, slot.end, row.start_time, row.end_time))
        .sort((left, right) => left.queue_number - right.queue_number);
      const overlappingReservations = reservations
        .filter((row) => overlapsSlot(slot.start, slot.end, row.start_time, row.end_time))
        .sort((left, right) => left.queue_number - right.queue_number);
      const queueNumbers = [
        ...overlapping.map((row) => row.queue_number),
        ...overlappingReservations.map((row) => row.queue_number),
      ];
      const activeType = overlapping[0]?.appointment_type ?? (overlappingReservations.length > 0 ? "Online" : null);
      const blocked = overlapsUnavailable(date, slot.start, slot.end, blocks);
      const nextQueueNumber = getNextQueueNumber(queueNumbers);
      const isFull = nextQueueNumber === null;
      const scheduleSupportsType = supportsType(slot.mode, type);
      const typeConflict = activeType !== null && activeType !== type;
      const isPast = isPastInClinicTime(date, slot.start);
      const availableForType = !isPast && !blocked && scheduleSupportsType && !typeConflict && !isFull;

      let reason = "Available";
      if (isPast) reason = "Past time";
      else if (blocked) reason = blocked.reason ?? "Doctor unavailable";
      else if (!scheduleSupportsType) reason = `${slot.mode} schedule only`;
      else if (typeConflict) reason = `${activeType} booking already occupies this shared slot`;
      else if (isFull) reason = "Slot already booked";

      return {
        start: slot.start.slice(0, 5),
        end: slot.end.slice(0, 5),
        mode: slot.mode,
        bookedCount: overlapping.length + overlappingReservations.length,
        queueNumbers,
        activeType,
        availableForType,
        isFull,
        reason,
        nextQueueNumber,
      };
    },
  );

  const blockedReason =
    slots.length === 0
      ? "No schedulable slots on this date."
      : slots.every((slot) => !slot.availableForType)
        ? slots.find((slot) => slot.reason !== "Past time")?.reason ?? "All remaining slots have passed."
        : null;

  return { slots, blockedReason };
}

export async function findNextAvailableSharedSlot(
  doctorId: string,
  date: string,
  type: ApptType,
  scanDays = 14,
  options: { ignoreAppointmentId?: string; slotMinutes?: number } = {},
) {
  for (let offset = 0; offset < Math.max(1, scanDays); offset += 1) {
    const nextDate = addDays(date, offset);
    const result = await buildSharedDayAvailability(doctorId, nextDate, type, options);
    const slot = result.slots.find((candidate) => candidate.availableForType);
    if (slot) {
      return { date: nextDate, slot };
    }
  }

  return null;
}
