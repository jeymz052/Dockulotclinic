"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useDoctorUnavailability } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  formatDisplayDate,
  formatRange,
  type AppointmentType,
} from "@/src/lib/appointments";
import type { AvailabilityReason } from "@/src/lib/clinic";

type BlockForm = {
  date: string;
  reason: AvailabilityReason;
  note: string;
};

const INITIAL_FORM: BlockForm = {
  date: "2026-04-15",
  reason: "Not Available",
  note: "",
};

type LiveSlotStatus = {
  start: string;
  end: string;
  mode: "Clinic" | "Online" | "Both";
  bookedCount: number;
  queueNumbers: number[];
  activeType: AppointmentType | null;
  availableForType: boolean;
  isFull: boolean;
  reason: string;
  nextQueueNumber: number | null;
};

export default function TimeSlotsPage() {
  const { accessToken, role } = useRole();
  const { doctors } = useDoctors();
  const { data: blockedDates, setData: setBlockedDates, isLoading, error } = useDoctorUnavailability();
  const [form, setForm] = useState<BlockForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<AppointmentType>("Clinic");
  const [statuses, setStatuses] = useState<LiveSlotStatus[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [isSaving, startTransition] = useTransition();

  const doctor = doctors[0] ?? null;
  const doctorId = doctor?.slug ?? doctor?.id ?? "";
  const doctorBlocks = blockedDates
    .filter((item) => item.doctorId === doctorId)
    .sort((left, right) => left.date.localeCompare(right.date));
  const canManage = role !== "PATIENT";
  const blockedCount = doctorBlocks.length;

  useEffect(() => {
    if (!doctorId || !form.date) {
      setStatuses([]);
      setStatusMessage(null);
      return;
    }

    const controller = new AbortController();

    async function loadStatuses() {
      try {
        setStatusesLoading(true);
        const response = await fetch(
          `/api/v2/appointments/availability?doctor_id=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(form.date)}&type=${viewType}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to load live slot preview.");
        }

        const payload = (await response.json()) as {
          slots?: LiveSlotStatus[];
          blockedReason?: string | null;
        };

        if (!controller.signal.aborted) {
          setStatuses(payload.slots ?? []);
          setStatusMessage(payload.blockedReason ?? null);
        }
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        if (!controller.signal.aborted) {
          setStatuses([]);
          setStatusMessage(
            loadError instanceof Error ? loadError.message : "Failed to load live slot preview.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setStatusesLoading(false);
        }
      }
    }

    void loadStatuses();

    return () => {
      controller.abort();
    };
  }, [doctorId, form.date, viewType]);

  if (!doctor) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        Loading doctor schedule...
      </div>
    );
  }

  function updateField<K extends keyof BlockForm>(field: K, value: BlockForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function resetForm() {
    setEditingBlockId(null);
    setForm(INITIAL_FORM);
  }

  function saveBlockedDay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/unavailability", {
        method: editingBlockId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(
          editingBlockId
            ? { id: editingBlockId, doctorId: doctor.id, ...form }
            : { doctorId: doctor.id, ...form },
        ),
      });

      if (!response.ok) {
        setFeedback("Unable to save blocked date.");
        return;
      }

      const payload = (await response.json()) as { data: typeof blockedDates };
      setBlockedDates(payload.data);
      setFeedback(
        editingBlockId
          ? `Updated blocked date for ${doctor.name} on ${formatDisplayDate(form.date)}.`
          : `Saved ${form.reason.toLowerCase()} for ${doctor.name} on ${formatDisplayDate(form.date)}.`,
      );
      setForm((current) => ({ ...current, note: "" }));
      setEditingBlockId(null);
    });
  }

  function startEdit(record: (typeof blockedDates)[number]) {
    setEditingBlockId(record.id);
    setForm({
      date: record.date,
      reason: record.reason,
      note: record.note ?? "",
    });
    setFeedback(null);
  }

  function removeBlockedDay(id: string) {
    if (!accessToken) {
      setFeedback("Your session expired. Please sign in again.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/unavailability?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        setFeedback("Unable to remove blocked date.");
        return;
      }

      const payload = (await response.json()) as { data: typeof blockedDates };
      setBlockedDates(payload.data);
      setFeedback("Blocked date removed.");
      if (editingBlockId === id) {
        resetForm();
      }
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-yellow-200 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_30%),linear-gradient(135deg,#f5fbff_0%,#ffffff_74%)] p-6 shadow-[0_24px_60px_rgba(133,77,14,0.10)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-700">Blocked Dates</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Manage leave and blocked dates</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use this page to block one-off leave days or unavailable dates for the selected
              doctor while keeping live slot visibility in view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Doctor" value={doctor.name} />
            <HeroMetric label="Selected day" value={formatDisplayDate(form.date)} />
            <HeroMetric label="Blocked dates" value={String(blockedCount)} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="rounded-3xl border border-yellow-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Live schedule preview: <span className="font-semibold text-slate-900">{doctor.name}</span> on{" "}
          <span className="font-semibold text-slate-900">{formatDisplayDate(form.date)}</span>
        </div>
        <Link
          href="/schedules"
          className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-5 py-3 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-100"
        >
          Back to Schedule Management
        </Link>
      </div>

      {feedback ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-4xl border border-yellow-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700">Editor</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Set doctor leave or blocked dates</h2>
              <p className="mt-2 text-sm text-slate-600">
                These entries block bookings at both the interface and server layer.
              </p>
            </div>
            {!canManage ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">View only</span>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={saveBlockedDay}>
            <Field label="Doctor">
              <div className="mt-2 rounded-[1.15rem] border border-yellow-100 bg-yellow-50 px-4 py-3 font-semibold text-yellow-800">
                {doctor.name}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-yellow-100 px-4 py-3 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-50"
                />
              </Field>
              <Field label="Reason">
                <select
                  value={form.reason}
                  onChange={(event) => updateField("reason", event.target.value as AvailabilityReason)}
                  disabled={!canManage || isSaving}
                  className="mt-2 w-full rounded-[1.15rem] border border-yellow-100 bg-white px-4 py-3 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-50"
                >
                  <option value="Not Available">Not Available</option>
                  <option value="Leave">Leave</option>
                </select>
              </Field>
            </div>

            <Field label="Note">
              <textarea
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                disabled={!canManage || isSaving}
                className="mt-2 min-h-28 w-full rounded-[1.15rem] border border-yellow-100 px-4 py-3 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-50"
                placeholder="Optional note for the team"
              />
            </Field>

            <div className="rounded-[1.4rem] border border-yellow-100 bg-yellow-50/70 px-4 py-3 text-sm text-yellow-800">
              Tip: use <span className="font-semibold">Leave</span> for approved time off and{" "}
              <span className="font-semibold">Not Available</span> for holidays, closures, or ad hoc blocks.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canManage || isSaving}
                className="rounded-full bg-[linear-gradient(135deg,#854D0E,#A16207)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Saving..."
                  : editingBlockId
                    ? "Update Blocked Date"
                    : "Add Blocked Date"}
              </button>
              {editingBlockId ? (
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
        </div>

        <div className="rounded-4xl border border-yellow-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700">Operational Preview</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Live slot status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shared-slot conflict control still applies on available days.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["Clinic", "Online"] as AppointmentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setViewType(type)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    viewType === type
                      ? "border-amber-400 bg-yellow-400 text-white"
                      : "border-yellow-100 bg-white text-slate-700 hover:bg-yellow-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {statusesLoading ? (
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Loading live slot status...
              </div>
            ) : statuses.length ? (
              statuses.map((slot) => {
                const available = slot.availableForType;
                return (
                  <div
                    key={slot.start}
                    className={`rounded-[1.4rem] border px-4 py-4 ${
                      available
                        ? "border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fef9c3_100%)]"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{formatRange(slot.start, slot.end)}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          available ? "bg-yellow-100 text-yellow-700" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {slot.bookedCount}/5 booked
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {available
                        ? `Available for ${viewType.toLowerCase()} queue ${slot.nextQueueNumber}.`
                        : slot.reason}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                {statusMessage ?? "No active saved schedule is opening bookings for this date."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-4xl border border-yellow-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700">Saved Entries</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Blocked dates for {doctor.name}</h2>
          </div>
          {isLoading ? <p className="text-sm text-slate-500">Loading doctor availability...</p> : null}
        </div>

        <div className="mt-5 space-y-3">
          {doctorBlocks.length ? (
            doctorBlocks.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-3 rounded-[1.4rem] border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fef9c3_100%)] px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{formatDisplayDate(record.date)}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        record.reason === "Leave"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {record.reason}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{record.note || "No note provided."}</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(record)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlockedDay(record.id)}
                      className="rounded-full border border-yellow-200 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-yellow-200 bg-yellow-50/60 px-4 py-6 text-sm text-yellow-700">
              No blocked dates saved for this doctor yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-yellow-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}
