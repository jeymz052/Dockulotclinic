"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import {
  formatDisplayDate,
  formatRange,
  getWeekDates,
} from "@/src/lib/appointments";

type CalendarSlot = {
  start: string;
  end: string;
  mode: "Clinic" | "Online" | "Both";
  bookedCount: number;
  queueNumbers: number[];
  activeType: "Clinic" | "Online" | null;
  available: boolean;
  reason: string;
};

type DayAvailabilitySlot = {
  start: string;
  end: string;
  mode: "Clinic" | "Online" | "Both";
  bookedCount: number;
  queueNumbers: number[];
  activeType: "Clinic" | "Online" | null;
  availableForType: boolean;
  reason: string;
};

function mergeCalendarSlots(clinicSlots: DayAvailabilitySlot[], onlineSlots: DayAvailabilitySlot[]) {
  const byKey = new Map<string, { clinic?: DayAvailabilitySlot; online?: DayAvailabilitySlot }>();

  for (const slot of clinicSlots) {
    const key = `${slot.start}-${slot.end}`;
    byKey.set(key, { ...(byKey.get(key) ?? {}), clinic: slot });
  }

  for (const slot of onlineSlots) {
    const key = `${slot.start}-${slot.end}`;
    byKey.set(key, { ...(byKey.get(key) ?? {}), online: slot });
  }

  return Array.from(byKey.values())
    .map<CalendarSlot | null>(({ clinic, online }) => {
      const source = clinic ?? online;
      if (!source) return null;

      const available = Boolean(clinic?.availableForType || online?.availableForType);
      return {
        start: source.start,
        end: source.end,
        mode: source.mode,
        bookedCount: clinic?.bookedCount ?? online?.bookedCount ?? 0,
        queueNumbers: clinic?.queueNumbers?.length ? clinic.queueNumbers : (online?.queueNumbers ?? []),
        activeType: clinic?.activeType ?? online?.activeType ?? null,
        available,
        reason: available ? "Available" : clinic?.reason ?? online?.reason ?? "Unavailable",
      };
    })
    .filter((slot): slot is CalendarSlot => slot !== null)
    .sort((left, right) => left.start.localeCompare(right.start));
}

function getCurrentWeekStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export default function CalendarViewPage() {
  const { doctors, isLoading: doctorsLoading } = useDoctors();
  const [doctorId, setDoctorId] = useState("");
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, CalendarSlot[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId && doctors[0]) {
      setDoctorId(doctors[0].slug ?? doctors[0].id);
    }
  }, [doctorId, doctors]);

  const selectedDoctor =
    doctors.find((doctor) => (doctor.slug ?? doctor.id) === doctorId || doctor.id === doctorId)
    ?? doctors[0]
    ?? null;
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const selectedDoctorKey = selectedDoctor?.slug ?? selectedDoctor?.id ?? "";

  useEffect(() => {
    if (!selectedDoctorKey) {
      setAvailabilityByDate({});
      return;
    }

    const controller = new AbortController();

    async function loadWeekAvailability() {
      try {
        setIsLoading(true);
        setError(null);

        const dayResults = await Promise.all(
          weekDates.map(async (date) => {
            const [clinicResponse, onlineResponse] = await Promise.all([
              fetch(
                `/api/v2/appointments/availability?doctor_id=${encodeURIComponent(selectedDoctorKey)}&date=${encodeURIComponent(date)}&type=Clinic`,
                { cache: "no-store", signal: controller.signal },
              ),
              fetch(
                `/api/v2/appointments/availability?doctor_id=${encodeURIComponent(selectedDoctorKey)}&date=${encodeURIComponent(date)}&type=Online`,
                { cache: "no-store", signal: controller.signal },
              ),
            ]);

            if (!clinicResponse.ok || !onlineResponse.ok) {
              throw new Error("Failed to load the live calendar view.");
            }

            const clinicPayload = (await clinicResponse.json()) as { slots?: DayAvailabilitySlot[] };
            const onlinePayload = (await onlineResponse.json()) as { slots?: DayAvailabilitySlot[] };

            return [date, mergeCalendarSlots(clinicPayload.slots ?? [], onlinePayload.slots ?? [])] as const;
          }),
        );

        if (!controller.signal.aborted) {
          setAvailabilityByDate(Object.fromEntries(dayResults));
        }
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        if (!controller.signal.aborted) {
          setAvailabilityByDate({});
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load the live calendar view.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadWeekAvailability();

    return () => {
      controller.abort();
    };
  }, [selectedDoctorKey, weekDates]);

  const tableSlots = useMemo(() => {
    const slotMap = new Map<string, CalendarSlot>();
    for (const slots of Object.values(availabilityByDate)) {
      for (const slot of slots) {
        slotMap.set(`${slot.start}-${slot.end}`, slot);
      }
    }
    return Array.from(slotMap.values()).sort((left, right) => left.start.localeCompare(right.start));
  }, [availabilityByDate]);

  return (
    <div className="space-y-6 pb-8">
      <section className="border-b border-[#b89a4d] bg-white px-1 pb-6 pt-2">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9f832e]">Calendar</p>
            <h1 className="mt-3 text-3xl font-black text-neutral-900">Shared weekly availability at a glance</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Booking follows the saved schedules: clinic/procedure visits use FamMed Monday-Friday and RT Lim 1st/3rd Sundays from 9:00 AM-4:00 PM, while virtual consults use a separate 8:00 AM-8:00 PM schedule.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Shortcut href="/appointments" label="Appointments" />
            <Shortcut href="/appointments/my" label="My Appointments" />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{selectedDoctor?.name ?? "Doctor schedule"}</h2>
            <p className="text-sm text-neutral-500">{selectedDoctor?.specialty ?? "Live availability"}</p>
          </div>
          <p className="rounded-full border border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-700 whitespace-nowrap">
            Week of {formatDisplayDate(weekStart)}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <span className="text-sm font-semibold text-neutral-600">Filter by:</span>
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            disabled={!doctors.length}
            className="rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-300 focus:ring-2 focus:ring-neutral-100 hover:border-neutral-300"
          >
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setWeekStart(shiftDate(weekStart, -7))}
              className="rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100"
              title="Show previous week"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getCurrentWeekStart())}
                className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-100"
              title="Return to current week"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(shiftDate(weekStart, 7))}
                className="rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100"
              title="Show next week"
            >
              Next →
            </button>
          </div>
        </div>

        {tableSlots.length ? (
          <div className="overflow-x-auto rounded-3xl border border-neutral-100">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr>
                  <th className="border border-neutral-100 bg-neutral-50/60 px-4 py-3 text-left font-semibold text-neutral-700">
                    Time
                  </th>
                  {weekDates.map((date) => (
                    <th
                      key={date}
                      className="border border-neutral-100 bg-neutral-50/60 px-4 py-3 text-left font-semibold text-neutral-700"
                    >
                      {formatDisplayDate(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableSlots.map((slotTemplate) => (
                  <tr key={`${slotTemplate.start}-${slotTemplate.end}`}>
                    <td className="border border-neutral-100 bg-neutral-50/40 px-4 py-3 font-medium text-neutral-700">
                      {formatRange(slotTemplate.start, slotTemplate.end)}
                    </td>
                    {weekDates.map((date) => {
                      const slot = availabilityByDate[date]?.find(
                        (candidate) =>
                          candidate.start === slotTemplate.start && candidate.end === slotTemplate.end,
                      ) ?? null;

                      return (
                        <td
                          key={`${date}-${slotTemplate.start}`}
                          className="border border-neutral-100 px-3 py-3"
                        >
                          <CalendarCell slot={slot} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-600">
            No active saved weekly schedules are opening slots for this week yet.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-600">
          <Legend color="bg-orange-500" label="Clinic slot in use" />
          <Legend color="bg-sky-500" label="Virtual consult slot in use" />
          <Legend color="bg-green-500" label="Open shared slot" />
          <Legend color="bg-red-500" label="Unavailable or blocked" />
        </div>

        {doctorsLoading || isLoading ? <p className="mt-4 text-sm text-neutral-500">Loading live calendar...</p> : null}
      </div>
    </div>
  );
}

function CalendarCell({
  slot,
}: {
  slot: CalendarSlot | null;
}) {
  if (!slot) {
    return (
      <div className="rounded-[1.25rem] bg-slate-50 px-3 py-3 text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Closed</p>
        <p className="mt-2 text-xs">No saved schedule for this day.</p>
      </div>
    );
  }

  let classes = "border border-green-600 bg-green-500 text-white";
  let summary = "Open";
  let detail = slot.mode === "Both" ? "Available for clinic or virtual consult" : `${formatSlotMode(slot.mode)} schedule`;

  if (slot.activeType === "Clinic") {
    classes = "border border-orange-200 bg-orange-50 text-orange-800";
    summary = "Clinic booked";
    detail = `Queue ${slot.queueNumbers.join(", ")}`;
  } else if (slot.activeType === "Online") {
    classes = "border border-sky-200 bg-sky-50 text-sky-800";
    summary = "Virtual booked";
    detail = `Queue ${slot.queueNumbers.join(", ")}`;
  } else if (!slot.available) {
    classes = "border border-red-200 bg-red-50 text-red-800";
    summary = slot.reason;
    detail = slot.mode === "Both" ? "No booking allowed for this slot" : `${formatSlotMode(slot.mode)} schedule`;
  }

  return (
    <div className={`rounded-[1.25rem] px-3 py-3 shadow-sm ${classes}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{summary}</p>
      <p className="mt-2 text-xs">{detail}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function formatSlotMode(mode: CalendarSlot["mode"]) {
  return mode === "Online" ? "Virtual consult" : mode;
}

function shiftDate(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-[#b89a4d] hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

