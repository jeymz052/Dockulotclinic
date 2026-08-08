"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { SystemSettings } from "@/src/lib/clinic";

type DoctorOption = {
  id: string;
  slug?: string;
  name?: string;
  full_name?: string;
  specialty: string;
  profiles?: {
    full_name?: string;
  } | {
    full_name?: string;
  }[];
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
  slot_minutes: number;
  schedule_mode: ScheduleMode;
  is_active: boolean;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const INITIAL_FORM: ScheduleForm = {
  day_of_week: 1,
  start_time: "10:00",
  end_time: "20:00",
  slot_minutes: 60,
  schedule_mode: "Online",
  is_active: true,
};

const EMPTY_SETTINGS: SystemSettings = {
  clinicName: "",
  email: "",
  phone: "",
  address: "",
  onlineConsultationFee: 0,
  maxPatientsPerHour: 5,
  clinicOpenTime: "08:00",
  clinicCloseTime: "17:00",
  defaultMeetingLink: "",
};

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function formatMode(mode: ScheduleMode) {
  return mode === "Both" ? "Clinic + Online" : mode;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatTimeLabel(value: string) {
  const parsed = parseTimeInput(value);
  const normalized = /^\d{2}:\d{2}$/.test(parsed) ? parsed : normalizeTime(value);
  const [hoursText, minutesText] = normalized.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const period = hours >= 12 ? "pm" : "am";
  const displayHour = hours % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
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

function doctorDisplayName(doctor: DoctorOption | null) {
  if (!doctor) return "Doctor";
  if (doctor.full_name?.trim()) return doctor.full_name.trim();
  if (doctor.name?.trim()) return doctor.name.trim();
  if (Array.isArray(doctor.profiles)) return doctor.profiles[0]?.full_name?.trim() || "Doctor";
  return doctor.profiles?.full_name?.trim() || "Doctor";
}

export default function SchedulesPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>(EMPTY_SETTINGS);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isSavingSchedule, startScheduleTransition] = useTransition();
  const [isSavingHours, startHoursTransition] = useTransition();

  const canManageSchedule = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const canManageClinicHours = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v2/doctors", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load doctors.");
        const payload = (await res.json()) as { doctors: DoctorOption[] };
        if (!active) return;
        setDoctors(payload.doctors ?? []);
        setSelectedDoctorId((current) => current || payload.doctors?.[0]?.id || "");
      } catch (error) {
        if (active) {
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load doctors.",
          });
        }
      } finally {
        if (active) setLoading(false);
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
        setScheduleLoading(true);
        const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load schedules.");
        const payload = (await res.json()) as { schedules: DoctorSchedule[] };
        if (!active) return;
        setSchedules(payload.schedules ?? []);
      } catch (error) {
        if (active) {
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load schedules.",
          });
        }
      } finally {
        if (active) setScheduleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, selectedDoctorId]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    (async () => {
      try {
        setSettingsLoading(true);
        const res = await fetch("/api/settings", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load clinic hours.");
        const payload = (await res.json()) as { data: SystemSettings };
        if (!active) return;
        setSettings(payload.data);
      } catch (error) {
        if (active && canManageClinicHours) {
          setFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Failed to load clinic hours.",
          });
        }
      } finally {
        if (active) setSettingsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, canManageClinicHours]);

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, DoctorSchedule[]>();
    for (const schedule of schedules) {
      const current = map.get(schedule.day_of_week) ?? [];
      map.set(schedule.day_of_week, [...current, schedule]);
    }
    for (const items of map.values()) {
      items.sort((left, right) => {
        if (left.schedule_mode !== right.schedule_mode) {
          return left.schedule_mode.localeCompare(right.schedule_mode);
        }
        return left.start_time.localeCompare(right.start_time);
      });
    }
    return map;
  }, [schedules]);

  const activeScheduleCount = schedules.filter((item) => item.is_active).length;
  const weeklyHoursText = `${settings.clinicOpenTime} - ${settings.clinicCloseTime}`;
  const selectedDoctorName = doctorDisplayName(selectedDoctor);
  const selectedDoctorSpecialty = selectedDoctor?.specialty ?? "Family Medicine and Aesthetic Medicine";
  const totalConfiguredMinutes = schedules
    .filter((item) => item.is_active)
    .reduce((sum, item) => {
      const start = Number(item.start_time.slice(0, 2)) * 60 + Number(item.start_time.slice(3, 5));
      const end = Number(item.end_time.slice(0, 2)) * 60 + Number(item.end_time.slice(3, 5));
      return sum + Math.max(end - start, 0);
    }, 0);
  const nextFormDayLabel = DAYS[form.day_of_week] ?? "Selected day";
  const existingDaySchedules = schedulesByDay.get(form.day_of_week) ?? [];
  const coveragePercent = Math.round((activeScheduleCount / 7) * 100);

  function updateField<K extends keyof ScheduleForm>(field: K, value: ScheduleForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function updateClinicHours<K extends "clinicOpenTime" | "clinicCloseTime">(
    field: K,
    value: SystemSettings[K],
  ) {
    setSettings((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function beginEdit(schedule: DoctorSchedule) {
    setEditingId(schedule.id);
    setForm({
      day_of_week: schedule.day_of_week,
      start_time: normalizeTime(schedule.start_time),
      end_time: normalizeTime(schedule.end_time),
      slot_minutes: schedule.slot_minutes,
      schedule_mode: schedule.schedule_mode,
      is_active: schedule.is_active,
    });
    setFeedback(null);
  }

  function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedDoctorId) return;

    startScheduleTransition(async () => {
      const method = editingId ? "PATCH" : "POST";
      const startTime = normalizeTimeInput(form.start_time);
      const endTime = normalizeTimeInput(form.end_time);
      const res = await fetch(`/api/v2/doctors/${selectedDoctorId}/schedule`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          schedule_id: editingId ?? undefined,
          day_of_week: form.day_of_week,
          start_time: startTime,
          end_time: endTime,
          slot_minutes: form.slot_minutes,
          schedule_mode: form.schedule_mode,
          is_active: form.is_active,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        schedule?: DoctorSchedule;
      };
      if (!res.ok || !body.schedule) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to save schedule." });
        return;
      }

      const savedSchedule = body.schedule;
      setSchedules((current) => {
        const withoutSaved = current.filter((item) => item.id !== savedSchedule.id);
        return [...withoutSaved, savedSchedule].sort((left, right) => {
          if (left.day_of_week !== right.day_of_week) return left.day_of_week - right.day_of_week;
          if (left.schedule_mode !== right.schedule_mode) {
            return left.schedule_mode.localeCompare(right.schedule_mode);
          }
          return left.start_time.localeCompare(right.start_time);
        });
      });
      setFeedback({
        tone: "success",
        message: editingId ? "Schedule updated." : "Schedule saved.",
      });
      resetForm();
    });
  }

  function deleteSchedule(schedule: DoctorSchedule) {
    if (!accessToken || !selectedDoctorId) return;

    startScheduleTransition(async () => {
      const res = await fetch(
        `/api/v2/doctors/${selectedDoctorId}/schedule?schedule_id=${schedule.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to delete schedule." });
        return;
      }

      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      setFeedback({ tone: "success", message: "Schedule deleted." });
      if (editingId === schedule.id) resetForm();
    });
  }

  function saveClinicHours(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    if (settings.clinicOpenTime >= settings.clinicCloseTime) {
      setFeedback({
        tone: "error",
        message: "Clinic opening time must be earlier than clinic closing time.",
      });
      return;
    }

    startHoursTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(settings),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: SystemSettings;
        message?: string;
      };
      if (!res.ok || !body.data) {
        setFeedback({ tone: "error", message: body.message ?? "Failed to save reference hours." });
        return;
      }
      setSettings(body.data);
      setFeedback({
        tone: "success",
        message: `Reference hours updated to ${body.data.clinicOpenTime} - ${body.data.clinicCloseTime}.`,
      });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_74%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-700">Schedule Management</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Manage doctor schedules, leave, and booking rules</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This workspace now covers weekly schedule CRUD, booking windows, blocked leave dates,
              and clinic-wide reference hours in one green scheduling flow.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryBadge
              label="Active days"
              value={`${activeScheduleCount}/7`}
              tone={schedules.length > 0 ? "success" : "neutral"}
            />
            <SummaryBadge
              label="Reference hours"
              value={weeklyHoursText}
              tone={Boolean(settings.clinicOpenTime && settings.clinicCloseTime) ? "success" : "neutral"}
            />
            <SummaryBadge
              label="Date blocking"
              value="Ready"
              tone="success"
            />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-neutral-200 bg-neutral-50 text-neutral-700"
              : "border border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-4xl border border-neutral-100 bg-[linear-gradient(135deg,#fbfeff_0%,#f1fbff_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Schedule Snapshot</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedDoctorName}</h2>
              <p className="mt-1 text-sm font-medium text-neutral-700">{selectedDoctorSpecialty}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Manage recurring weekly hours here, then use blocked dates for leave, holidays, and one-off exceptions.
              </p>
            </div>
            <Link
              href="/schedules/slots"
              className="inline-flex rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Manage Blocked Dates
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactStat
              label="Active Days"
              value={`${activeScheduleCount}/7`}
              helper={`${coveragePercent}% weekly coverage`}
            />
            <CompactStat
              label="Configured Hours"
              value={formatMinutes(totalConfiguredMinutes)}
              helper="Across active saved days"
            />
            <CompactStat
              label="Reference Hours"
              value={weeklyHoursText}
              helper="General clinic settings only"
            />
            <CompactStat
              label="Next Target"
              value={nextFormDayLabel}
              helper={existingDaySchedules.length ? `${existingDaySchedules.length} saved schedule(s)` : "Not scheduled yet"}
            />
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-neutral-100 bg-white px-4 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-semibold text-slate-900">Quick flow</p>
              <p className="text-sm text-slate-600">1. Save clinic or virtual rows  2. Review the weekly board  3. Block exceptions when needed</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.6rem] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-800">
            Booking rule: patients can only book on days that already have an
            <span className="font-semibold"> active saved schedule</span>. If a day is not configured yet, booking stays closed for that day.
          </div>
        </section>

        <section className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Reference Hours</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">General clinic operating hours</h2>
              <p className="mt-2 text-sm text-slate-600">
                These settings are used as a general clinic reference. The schedule editor enforces the actual booking rules for clinic and virtual consults.
              </p>
            </div>
            {settingsLoading ? <span className="text-sm text-slate-500">Loading...</span> : null}
          </div>

          <form className="mt-6 space-y-5" onSubmit={saveClinicHours}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clinic Opens">
                <input
                  type="time"
                  value={settings.clinicOpenTime}
                  onChange={(event) => updateClinicHours("clinicOpenTime", event.target.value)}
                  disabled={!canManageClinicHours || isSavingHours || settingsLoading}
                  className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
                />
              </Field>

              <Field label="Clinic Closes">
                <input
                  type="time"
                  value={settings.clinicCloseTime}
                  onChange={(event) => updateClinicHours("clinicCloseTime", event.target.value)}
                  disabled={!canManageClinicHours || isSavingHours || settingsLoading}
                  className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
                />
              </Field>
            </div>

            <div className="rounded-[1.4rem] border border-neutral-100 bg-neutral-50/70 px-4 py-3 text-sm text-neutral-800">
              Current scheduling guardrail: use the weekday rule cards below to define clinic and virtual consult hours.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManageClinicHours || isSavingHours || settingsLoading}
                className="rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingHours ? "Saving..." : "Save Reference Hours"}
              </button>
              <Link
                href="/settings"
                className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Open Full Settings
              </Link>
            </div>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Editor</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Weekly availability setup</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create or update the recurring hours that open booking for each weekday.
              </p>
            </div>
            {!canManageSchedule ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">View only</span>
            ) : null}
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-neutral-100 bg-[linear-gradient(135deg,#f5f5f5_0%,#effcf3_100%)] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Editing {nextFormDayLabel}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {existingDaySchedules.length
                    ? `${existingDaySchedules.length} saved schedule(s) for this weekday.`
                    : "No schedule is saved for this weekday yet, so patients cannot book it."}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm">
                {editingId ? "Editing saved availability" : "Creating a new schedule row"}
              </span>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={saveSchedule}>
            <Field label="Doctor">
              <select
                value={selectedDoctorId}
                onChange={(event) => setSelectedDoctorId(event.target.value)}
                disabled={loading || !canManageSchedule}
                className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctorDisplayName(doctor)} - {doctor.specialty}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Weekday">
                <select
                  value={form.day_of_week}
                  onChange={(event) => updateField("day_of_week", Number(event.target.value))}
                  disabled={!canManageSchedule || isSavingSchedule}
                  className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Schedule Mode">
                <select
                  value={form.schedule_mode}
                  onChange={(event) => updateField("schedule_mode", event.target.value as ScheduleMode)}
                  disabled={!canManageSchedule || isSavingSchedule}
                  className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
                >
                  <option value="Both">Clinic + Online</option>
                  <option value="Clinic">Clinic only</option>
                  <option value="Online">Online only</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TimeField
                label="Start Time"
                value={form.start_time}
                onChange={(value) => updateField("start_time", value)}
                onBlur={(value) => updateField("start_time", normalizeTimeInput(value))}
                disabled={!canManageSchedule || isSavingSchedule}
              />

              <TimeField
                label="End Time"
                value={form.end_time}
                onChange={(value) => updateField("end_time", value)}
                onBlur={(value) => updateField("end_time", normalizeTimeInput(value))}
                disabled={!canManageSchedule || isSavingSchedule}
              />

              <Field label="Slot Minutes">
                <select
                  value={form.slot_minutes}
                  onChange={(event) => updateField("slot_minutes", Number(event.target.value))}
                  disabled={!canManageSchedule || isSavingSchedule}
                  className="mt-2 w-full rounded-[1.15rem] border border-neutral-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
                >
                  {[30, 45, 60, 90, 120].map((value) => (
                    <option key={value} value={value}>
                      {value} min
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-[1.25rem] border border-neutral-100 bg-neutral-50/60 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => updateField("is_active", event.target.checked)}
                disabled={!canManageSchedule || isSavingSchedule}
                className="h-4 w-4 rounded border-slate-300 text-neutral-400 focus:ring-neutral-300"
              />
              Keep this weekday active for booking
            </label>

            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Schedules are validated against the weekday booking rules first; these settings are only a clinic-wide reference.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManageSchedule || isSavingSchedule || !selectedDoctorId}
                className="rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSchedule ? "Saving..." : editingId ? "Update Schedule" : "Save Schedule"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Coverage Board</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {selectedDoctorName} weekly availability
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Active days are open for booking. Off or inactive days stay unavailable until configured.
                </p>
              </div>
              {scheduleLoading ? <span className="text-sm text-slate-500">Refreshing...</span> : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StateLegend
                tone="active"
                title="Active"
                detail="Patients can book inside the saved hours for this weekday."
              />
              <StateLegend
                tone="inactive"
                title="Inactive"
                detail="A schedule exists, but booking is turned off for this weekday."
              />
              <StateLegend
                tone="off"
                title="Not Configured"
                detail="No saved weekday schedule yet, so booking stays closed."
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {DAYS.map((day, index) => {
                const daySchedules = schedulesByDay.get(index) ?? [];
                const hasActive = daySchedules.some((schedule) => schedule.is_active);
                return (
                  <div
                    key={day}
                    className={`rounded-3xl border p-4 transition ${
                      hasActive
                        ? "border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] shadow-[0_10px_24px_rgba(17,17,17,0.08)]"
                        : daySchedules.length
                          ? "border-neutral-200 bg-[linear-gradient(180deg,#fffdf7_0%,#fafafa_100%)]"
                          : "border-slate-200 bg-slate-50/85"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{day}</p>
                        {daySchedules.length ? (
                          <div className="mt-2 space-y-2">
                            {daySchedules.map((schedule) => (
                              <div key={schedule.id} className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3 shadow-sm">
                                <p className="text-sm font-semibold text-slate-700">
                                  {normalizeTime(schedule.start_time)} - {normalizeTime(schedule.end_time)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatMode(schedule.schedule_mode)} | {schedule.slot_minutes} min slots
                                </p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {schedule.is_active ? "Active" : "Inactive"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Not configured for booking yet.</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          hasActive
                            ? "bg-neutral-100 text-neutral-700"
                            : daySchedules.length
                              ? "bg-neutral-100 text-neutral-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {daySchedules.length ? (hasActive ? "Active" : "Inactive") : "Off"}
                      </span>
                    </div>

                    {daySchedules.length && canManageSchedule ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {daySchedules.map((schedule) => (
                          <div key={schedule.id} className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => beginEdit(schedule)}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit {formatMode(schedule.schedule_mode)}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSchedule(schedule)}
                              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!daySchedules.length ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-xs font-medium text-slate-500">
                        Patients cannot book this day until a schedule is saved
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Blocked Dates</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Leave and blocked days</h2>
            <p className="mt-2 text-sm text-slate-600">
              Weekly hours cover the normal routine. One-off leave, holidays, and blocked dates
              should be managed on the blocking screen.
            </p>
            <Link
              href="/schedules/slots"
              className="mt-5 inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Manage Blocked Dates
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "neutral";
}) {
  return (
    <div
      className={`rounded-[1.4rem] border px-4 py-3 shadow-sm ${
        tone === "success"
          ? "border-neutral-200 bg-white text-neutral-800"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-bold">{value}</p>
    </div>
  );
}

function CompactStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-neutral-100 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function StateLegend({
  tone,
  title,
  detail,
}: {
  tone: "active" | "inactive" | "off";
  title: string;
  detail: string;
}) {
  const styles =
    tone === "active"
      ? "border-neutral-200 bg-neutral-50 text-neutral-800"
      : tone === "inactive"
        ? "border-neutral-200 bg-neutral-50 text-neutral-800"
        : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-[1.25rem] border px-4 py-3 ${styles}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}

const TIME_PRESETS = ["09:00", "10:00", "12:00", "15:00", "18:00", "20:00"];

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
      <div className="mt-2 space-y-2">
        <input
          type="text"
          inputMode="numeric"
          value={value ? formatTimeLabel(value) : ""}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onBlur(event.target.value)}
          disabled={disabled}
          placeholder="e.g. 10:00 am"
          className="w-full rounded-[1.15rem] border border-neutral-100 px-4 py-3 text-sm outline-none transition focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 disabled:bg-slate-50"
        />
        <div className="flex flex-wrap gap-2">
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              className="rounded-full border border-neutral-100 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {formatTimeLabel(preset)}
            </button>
          ))}
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Type a time like `10:00 am` or `14:00`, or tap a preset.
        </p>
      </div>
    </Field>
  );
}

