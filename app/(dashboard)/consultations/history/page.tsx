"use client";

import { useMemo, useState } from "react";
import {
  FaCalendarDay,
  FaClockRotateLeft,
  FaFileLines,
  FaFilter,
  FaMagnifyingGlass,
  FaPills,
  FaUserDoctor,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

export default function ConsultationHistoryPage() {
  const { role } = useRole();
  const { appointments } = useAppointments();
  const { data: notes, isLoading, error } = useConsultationNotes();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Completed" | "In Progress" | "Ready">("All");

  const entries = useMemo(
    () =>
      notes
        .map((note) => ({
          note,
          appointment: appointments.find((appointment) => appointment.id === note.appointmentId) ?? null,
        }))
        .sort((left, right) => right.note.updatedAt.localeCompare(left.note.updatedAt)),
    [notes, appointments],
  );

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return entries.filter(({ note, appointment }) => {
      if (statusFilter !== "All" && note.status !== statusFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const doctorName = getDoctorById(note.doctorId)?.name ?? "";
      const searchable = [
        note.patientName,
        doctorName,
        note.diagnosis,
        note.note,
        note.prescription,
        appointment ? formatDisplayDate(appointment.date) : "",
      ].join(" ").toLowerCase();

      return searchable.includes(normalized);
    });
  }, [entries, query, statusFilter]);

  const completedCount = entries.filter(({ note }) => note.status === "Completed").length;
  const inProgressCount = entries.filter(({ note }) => note.status === "In Progress").length;
  const readyCount = entries.filter(({ note }) => note.status === "Ready").length;
  const isPatient = role === "PATIENT";

  const statusOptions: Array<"All" | "Completed" | "In Progress" | "Ready"> = [
    "All",
    "Completed",
    "In Progress",
    "Ready",
  ];

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_70%_10%,rgba(245,245,245,0.12),transparent_35%),linear-gradient(135deg,#f8f8f7_0%,#ffffff_58%,#f5f5f5_100%)] p-6 shadow-[0_20px_60px_rgba(17,17,17,0.12)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700">
              {isPatient ? "My Medical Record" : "Clinical Archive"}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {isPatient ? "Your consultation timeline" : "Consultation history"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isPatient
                ? "See your previous consultations, doctor notes, and care plans in one patient-friendly timeline."
                : "Review completed and ongoing consultations with quick access to notes, plans, and visit context."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 self-start lg:self-auto">
            <SummaryChip label="Total" value={entries.length} tone="slate" />
            <SummaryChip label="Completed" value={completedCount} tone="emerald" />
            <SummaryChip
              label={isPatient ? "Ongoing" : "In Progress"}
              value={isPatient ? inProgressCount + readyCount : inProgressCount}
              tone="sky"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="group flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition focus-within:border-yellow-300 focus-within:bg-white lg:max-w-lg">
            <FaMagnifyingGlass className="text-slate-400 group-focus-within:text-amber-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              placeholder={isPatient ? "Search by doctor, date, note, or plan" : "Search by patient, date, note, or plan"}
            />
          </label>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <FaFilter /> Status
            </span>
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  statusFilter === option
                    ? "bg-black text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-yellow-200 hover:text-yellow-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {filteredEntries.length ? (
          filteredEntries.map(({ note, appointment }) => {
            const doctor = getDoctorById(note.doctorId);
            const statusTone =
              note.status === "Completed"
                ? "bg-yellow-100 text-yellow-700"
                : note.status === "In Progress"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-yellow-100 text-yellow-700";

            return (
              <article
                key={note.id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isPatient ? doctor?.name ?? "Assigned doctor" : note.patientName}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <FaCalendarDay className="text-slate-400" />
                        {appointment ? formatDisplayDate(appointment.date) : "Schedule unavailable"}
                      </span>
                      {appointment ? <span>{formatRange(appointment.start, appointment.end)}</span> : null}
                      {!isPatient ? (
                        <span className="inline-flex items-center gap-1">
                          <FaUserDoctor className="text-slate-400" />
                          {doctor?.name ?? "Assigned doctor"}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
                    {note.status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <FaFileLines />
                      Diagnosis
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {note.diagnosis || "No diagnosis recorded."}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <FaFileLines />
                      {isPatient ? "Visit Summary" : "Consultation Note"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {note.note || (isPatient ? "No summary has been recorded yet." : "No consultation note recorded.")}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <FaPills />
                      {isPatient ? "Medication / Care Plan" : "Prescription / Plan"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {note.prescription || "No prescription recorded."}
                    </p>
                  </section>
                </div>

                <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
                  <FaClockRotateLeft className="text-slate-400" />
                  Updated {new Date(note.updatedAt).toLocaleString("en-US")}
                </p>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm text-slate-500">
            {entries.length === 0
              ? "No consultation notes have been saved yet."
              : "No consultation entries match your current search or filter."}
          </div>
        )}
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading consultation history...</p> : null}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "sky";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : tone === "sky"
        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-2xl border px-3 py-2 text-center ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-black leading-none">{value}</p>
    </div>
  );
}
