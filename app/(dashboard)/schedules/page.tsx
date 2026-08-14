"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FaBan, FaCalendarCheck, FaClock, FaPlus, FaRotateRight, FaTrash } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  CONSULTATION_SLOT_MINUTES,
  STANDARD_BOOKING_END,
  STANDARD_BOOKING_START,
  STANDARD_CLINIC_SCHEDULES,
  STANDARD_VIRTUAL_SCHEDULES,
  VIRTUAL_CONSULT_END,
  VIRTUAL_CONSULT_START,
} from "@/src/lib/clinic-schedule";

type DoctorOption = {
  id: string;
  slug?: string;
  name?: string;
  full_name?: string;
  specialty: string;
  profiles?: { full_name?: string } | { full_name?: string }[];
};

type ScheduleMode = "Clinic" | "Online" | "Both";

type DoctorSchedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

type ScheduleForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  schedule_mode: Exclude<ScheduleMode, "Both">;
  is_active: boolean;
};

type ScheduleFilter = "all" | "Clinic" | "Online";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const INITIAL_FORM: ScheduleForm = {
  day_of_week: 1,
  start_time: STANDARD_BOOKING_START,
  end_time: STANDARD_BOOKING_END,
  schedule_mode: "Clinic",
  is_active: true,
};

const FILTERS: Array<{ value: ScheduleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "Clinic", label: "Clinic / Procedure" },
  { value: "Online", label: "Virtual Consult" },
];

const TIME_PRESETS = ["08:00", "09:00", "12:00", "16:00", "20:00"];

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function parseTimeInput(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return value.trim();

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
    return value.trim();
  }

  if (period) {
    if (hours === 12) {
      hours = period === "am" ? 0 : 12;
    } else if (period === "pm") {
      hours += 12;
    }
  }

  if (hours < 0 || hours > 23) return value.trim();
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeTimeInput(value: string) {
  const parsed = parseTimeInput(value);
  return /^\d{2}:\d{2}$/.test(parsed) ? parsed : value.trim();
}

function formatTimeLabel(value: string) {
  const parsed = parseTimeInput(value);
  const normalized = /^\d{2}:\d{2}$/.test(parsed) ? parsed : normalizeTime(value);
  const [hoursText, minutesText] = normalized.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function getModeDefaults(mode: ScheduleForm["schedule_mode"]) {
  return mode === "Online"
    ? { start_time: VIRTUAL_CONSULT_START, end_time: VIRTUAL_CONSULT_END }
    : { start_time: STANDARD_BOOKING_START, end_time: STANDARD_BOOKING_END };
}

function formatMode(mode: ScheduleMode) {
  if (mode === "Online") return "Virtual Consult";
  if (mode === "Clinic") return "Clinic / Procedure";
  return "Legacy Combined";
}

function doctorDisplayName(doctor: DoctorOption | null) {
  if (!doctor) return "Doctor";
  if (doctor.full_name?.trim()) return doctor.full_name.trim();
  if (doctor.name?.trim()) return doctor.name.trim();
  if (Array.isArray(doctor.profiles)) return doctor.profiles[0]?.full_name?.trim() || "Doctor";
  return doctor.profiles?.full_name?.trim() || "Doctor";
}

function scheduleMinutes(schedule: DoctorSchedule) {
  const start = Number(schedule.start_time.slice(0, 2)) * 60 + Number(schedule.start_time.slice(3, 5));
  const end = Number(schedule.end_time.slice(0, 2)) * 60 + Number(schedule.end_time.slice(3, 5));
  return Math.max(end - start, 0);
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function modeTone(mode: ScheduleMode) {
  if (mode === "Online") return "border-sky-200 bg-sky-50 text-sky-900";
  if (mode === "Clinic") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  return "border-neutral-200 bg-neutral-50 text-neutral-700";
}

export default function SchedulesPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(INITIAL_FORM);
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isSavingSchedule, startScheduleTransition] = useTransition();

  const canManageSchedule = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const selectedDoctorName = doctorDisplayName(selectedDoctor);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoadingDoctors(true);
        const res = await fetch("/api/v2/doctors", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await res.json().catch(() => ({}))) as { doctors?: DoctorOption[]; message?: string };
        if (!res.ok) throw new Error(body.message ?? "Failed to load doctors.");
        if (!active) return;
        setDoctors(body.doctors ?? []);
        setSelectedDoctorId((current) => current || body.doctors?.[0]?.id || "");
      } catch (error) {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Failed to load doctors." });
        }
      } finally {
        if (active) setLoadingDoctors(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (!accessToken || !selectedDoctorId) return;
    let active = true;

    (async () => {
      try {
        setLoadingSchedules(true);
        const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await res.json().catch(() => ({}))) as { schedules?: DoctorSchedule[]; message?: string };
        if (!res.ok) throw new Error(body.message ?? "Failed to load schedules.");
        if (!active) return;
        setSchedules(body.schedules ?? []);
      } catch (error) {
        if (active) {
          setSchedules([]);
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Failed to load schedules." });
        }
      } finally {
        if (active) setLoadingSchedules(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, selectedDoctorId]);

  const bookingSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.schedule_mode === "Clinic" || schedule.schedule_mode === "Online"),
    [schedules],
  );

  const visibleSchedules = useMemo(
    () => bookingSchedules.filter((schedule) => filter === "all" || schedule.schedule_mode === filter),
    [bookingSchedules, filter],
  );

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, DoctorSchedule[]>();
    for (const schedule of visibleSchedules) {
      const current = map.get(schedule.day_of_week) ?? [];
      map.set(schedule.day_of_week, [...current, schedule]);
    }
    for (const items of map.values()) {
      items.sort((left, right) => {
        if (left.schedule_mode !== right.schedule_mode) return left.schedule_mode.localeCompare(right.schedule_mode);
        return left.start_time.localeCompare(right.start_time);
      });
    }
    return map;
  }, [visibleSchedules]);

  const activeClinicRows = bookingSchedules.filter((schedule) => schedule.is_active && schedule.schedule_mode === "Clinic");
  const activeOnlineRows = bookingSchedules.filter((schedule) => schedule.is_active && schedule.schedule_mode === "Online");
  const activeDayCount = new Set(bookingSchedules.filter((schedule) => schedule.is_active).map((schedule) => schedule.day_of_week)).size;
  const activeHours = bookingSchedules
    .filter((schedule) => schedule.is_active)
    .reduce((total, schedule) => total + scheduleMinutes(schedule), 0);
  const existingDaySchedules = bookingSchedules.filter(
    (schedule) => schedule.day_of_week === form.day_of_week && schedule.schedule_mode === form.schedule_mode,
  );

  function updateField<K extends keyof ScheduleForm>(field: K, value: ScheduleForm[K]) {
    if (field === "schedule_mode") {
      const scheduleMode = value as ScheduleForm["schedule_mode"];
      setForm((current) => ({ ...current, ...getModeDefaults(scheduleMode), schedule_mode: scheduleMode }));
      setFeedback(null);
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function resetForm(next: Partial<ScheduleForm> = {}) {
    setForm({ ...INITIAL_FORM, ...next });
    setEditingId(null);
  }

  function beginCreate(day: number, mode: ScheduleForm["schedule_mode"] = form.schedule_mode) {
    resetForm({ day_of_week: day, schedule_mode: mode, ...getModeDefaults(mode), is_active: true });
  }

  function beginEdit(schedule: DoctorSchedule) {
    if (schedule.schedule_mode === "Both") return;
    setEditingId(schedule.id);
    setForm({
      day_of_week: schedule.day_of_week,
      start_time: normalizeTime(schedule.start_time),
      end_time: normalizeTime(schedule.end_time),
      schedule_mode: schedule.schedule_mode,
      is_active: schedule.is_active,
    });
    setFeedback(null);
  }

  function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedDoctorId) return;

    startScheduleTransition(async () => {
      const startTime = normalizeTimeInput(form.start_time);
      const endTime = normalizeTimeInput(form.end_time);
      const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          schedule_id: editingId ?? undefined,
          day_of_week: form.day_of_week,
          start_time: startTime,
          end_time: endTime,
          slot_minutes: CONSULTATION_SLOT_MINUTES,
          schedule_mode: form.schedule_mode,
          is_active: form.is_active,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as { message?: string; schedule?: DoctorSchedule };
      if (!res.ok || !body.schedule) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to save schedule." });
        return;
      }

      const savedSchedule = body.schedule;
      setSchedules((current) => {
        const withoutSaved = current.filter((item) => item.id !== savedSchedule.id);
        return [...withoutSaved, savedSchedule].sort((left, right) => {
          if (left.day_of_week !== right.day_of_week) return left.day_of_week - right.day_of_week;
          if (left.schedule_mode !== right.schedule_mode) return left.schedule_mode.localeCompare(right.schedule_mode);
          return left.start_time.localeCompare(right.start_time);
        });
      });
      setFeedback({ tone: "success", message: editingId ? "Schedule updated." : "Schedule saved." });
      resetForm({ day_of_week: form.day_of_week, schedule_mode: form.schedule_mode, ...getModeDefaults(form.schedule_mode) });
    });
  }

  function deleteSchedule(schedule: DoctorSchedule) {
    if (!accessToken || !selectedDoctorId) return;

    startScheduleTransition(async () => {
      const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule?schedule_id=${schedule.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to delete schedule." });
        return;
      }
      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      if (editingId === schedule.id) resetForm();
      setFeedback({ tone: "success", message: "Schedule deleted." });
    });
  }

  function applyStandardSchedule() {
    if (!accessToken || !selectedDoctorId) return;

    startScheduleTransition(async () => {
      const standardRows = [
        ...STANDARD_CLINIC_SCHEDULES.map((rule) => ({
          ...rule,
          start_time: STANDARD_BOOKING_START,
          end_time: STANDARD_BOOKING_END,
          schedule_mode: "Clinic" as const,
        })),
        ...STANDARD_VIRTUAL_SCHEDULES.map((rule) => ({
          ...rule,
          start_time: VIRTUAL_CONSULT_START,
          end_time: VIRTUAL_CONSULT_END,
          schedule_mode: "Online" as const,
        })),
      ];

      const saved: DoctorSchedule[] = [];
      for (const rule of standardRows) {
        const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            day_of_week: rule.day_of_week,
            start_time: rule.start_time,
            end_time: rule.end_time,
            slot_minutes: CONSULTATION_SLOT_MINUTES,
            schedule_mode: rule.schedule_mode,
            is_active: true,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { message?: string; schedule?: DoctorSchedule };
        if (!res.ok || !body.schedule) {
          setFeedback({ tone: "error", message: body.message ?? `Failed to save ${rule.label}.` });
          return;
        }
        saved.push(body.schedule);
      }

      setSchedules((current) => {
        const savedKeys = new Set(saved.map((item) => `${item.day_of_week}-${item.schedule_mode}`));
        const replaced = current.filter((item) => !savedKeys.has(`${item.day_of_week}-${item.schedule_mode}`));
        return [...replaced, ...saved].sort((left, right) => {
          if (left.day_of_week !== right.day_of_week) return left.day_of_week - right.day_of_week;
          if (left.schedule_mode !== right.schedule_mode) return left.schedule_mode.localeCompare(right.schedule_mode);
          return left.start_time.localeCompare(right.start_time);
        });
      });
      setFeedback({ tone: "success", message: "Doc Kulot schedule applied." });
      resetForm();
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Doc Kulot Workspace</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-neutral-950">Schedules</h1>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              value={selectedDoctorId}
              onChange={(event) => setSelectedDoctorId(event.target.value)}
              disabled={loadingDoctors || !canManageSchedule}
              className="h-12 min-w-72 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-900 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctorDisplayName(doctor)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={applyStandardSchedule}
              disabled={!canManageSchedule || isSavingSchedule || !selectedDoctorId}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <FaRotateRight className="h-4 w-4" aria-hidden="true" />
              {isSavingSchedule ? "Saving" : "Apply Doc Kulot Schedule"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Doctor" value={selectedDoctorName} />
          <Metric label="Clinic / Procedure" value={`${activeClinicRows.length} rows`} />
          <Metric label="Virtual Consult" value={`${activeOnlineRows.length} rows`} />
          <Metric label="Weekly Hours" value={formatHours(activeHours)} />
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Weekly Rows</p>
              <h2 className="mt-1 text-xl font-black text-neutral-950">{activeDayCount}/7 active days</h2>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    filter === item.value
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loadingSchedules ? (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm font-semibold text-neutral-600">
              Loading schedules...
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {DAYS.map((day, index) => {
              const daySchedules = schedulesByDay.get(index) ?? [];
              const hasActive = daySchedules.some((schedule) => schedule.is_active);
              return (
                <article
                  key={day}
                  className={`min-h-44 rounded-2xl border p-4 transition ${
                    hasActive
                      ? "border-neutral-300 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                      : "border-neutral-200 bg-neutral-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black text-neutral-950">
                        {index === 0 && filter !== "Online" ? "Sunday, 1st/3rd" : day}
                      </h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
                        {hasActive ? "Active" : daySchedules.length ? "Inactive" : "Off"}
                      </p>
                    </div>

                    {canManageSchedule ? (
                      <button
                        type="button"
                        onClick={() => beginCreate(index, filter === "Online" ? "Online" : "Clinic")}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
                        aria-label={`Add ${day} schedule`}
                        title={`Add ${day} schedule`}
                      >
                        <FaPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`rounded-2xl border px-3 py-3 ${modeTone(schedule.schedule_mode)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">
                              {formatTimeLabel(schedule.start_time)} - {formatTimeLabel(schedule.end_time)}
                            </p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                              {formatMode(schedule.schedule_mode)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                            {schedule.is_active ? "On" : "Off"}
                          </span>
                        </div>

                        {canManageSchedule ? (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(schedule)}
                              className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-bold transition hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSchedule(schedule)}
                              className="grid h-9 w-9 place-items-center rounded-xl border border-white/80 bg-white/80 transition hover:bg-white"
                              aria-label={`Delete ${formatMode(schedule.schedule_mode)} schedule`}
                              title={`Delete ${formatMode(schedule.schedule_mode)} schedule`}
                            >
                              <FaTrash className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {!daySchedules.length ? (
                      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-3 py-8 text-center text-sm font-semibold text-neutral-400">
                        No slots
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm xl:sticky xl:top-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Editor</p>
                <h2 className="mt-1 text-xl font-black text-neutral-950">
                  {editingId ? "Edit Row" : "New Row"}
                </h2>
              </div>
              <StatusPill active={form.is_active} />
            </div>

            <form className="mt-5 space-y-4" onSubmit={saveSchedule}>
              <Field label="Type">
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["Clinic", "Online"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={!canManageSchedule || isSavingSchedule}
                      onClick={() => updateField("schedule_mode", mode)}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        form.schedule_mode === mode
                          ? mode === "Online"
                            ? "border-sky-300 bg-sky-50 text-sky-950"
                            : "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                      }`}
                    >
                      {mode === "Online" ? "Virtual Consult" : "Clinic / Procedure"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Day">
                <select
                  value={form.day_of_week}
                  onChange={(event) => updateField("day_of_week", Number(event.target.value))}
                  disabled={!canManageSchedule || isSavingSchedule}
                  className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <TimeField
                  label="Start"
                  value={form.start_time}
                  onChange={(value) => updateField("start_time", value)}
                  onBlur={(value) => updateField("start_time", normalizeTimeInput(value))}
                  disabled={!canManageSchedule || isSavingSchedule}
                />
                <TimeField
                  label="End"
                  value={form.end_time}
                  onChange={(value) => updateField("end_time", value)}
                  onBlur={(value) => updateField("end_time", normalizeTimeInput(value))}
                  disabled={!canManageSchedule || isSavingSchedule}
                />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-800">
                Active
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateField("is_active", event.target.checked)}
                  disabled={!canManageSchedule || isSavingSchedule}
                  className="h-5 w-5 rounded border-neutral-300 accent-neutral-950"
                />
              </label>

              {existingDaySchedules.length && !editingId ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-600">
                  Existing row will update.
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!canManageSchedule || isSavingSchedule || !selectedDoctorId}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <FaCalendarCheck className="h-4 w-4" aria-hidden="true" />
                  {isSavingSchedule ? "Saving" : editingId ? "Update" : "Save"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-white text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
                    aria-label="Cancel edit"
                    title="Cancel edit"
                  >
                    <FaBan className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <Link
            href="/schedules/slots"
            className="flex items-center justify-between rounded-3xl border border-neutral-200 bg-neutral-950 p-5 text-white shadow-sm transition hover:bg-neutral-800"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.22em] text-white/55">Blocked Dates</span>
              <span className="mt-1 block text-lg font-black">Manage Blocks</span>
            </span>
            <FaClock className="h-5 w-5" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-neutral-800">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-neutral-950">{value}</p>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
        active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {active ? "On" : "Off"}
    </span>
  );
}

function TimeField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        inputMode="numeric"
        value={value ? formatTimeLabel(value) : ""}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur(event.target.value)}
        disabled={disabled}
        className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formatTimeLabel(preset)}
          </button>
        ))}
      </div>
    </Field>
  );
}
