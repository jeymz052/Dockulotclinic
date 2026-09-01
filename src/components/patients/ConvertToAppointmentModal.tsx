"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaCalendarPlus,
  FaXmark,
  FaCheck,
  FaHospital,
  FaClipboardList,
  FaCalendarDays,
  FaClock,
  FaStethoscope,
  FaTriangleExclamation,
  FaSyringe,
} from "react-icons/fa6";
import { createWalkInAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import {
  encodeAppointmentContext,
  type ClinicConsultKind,
} from "@/src/lib/appointment-context";
import {
  formatDisplayDate,
  formatDisplayTime,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import {
  isClinicProcedureBookingDate,
  resolveClinicLocationForDate,
  standardBookingDateMessage,
  CONSULTATION_SLOT_MINUTES,
  PROCEDURE_SLOT_MINUTES,
} from "@/src/lib/clinic-schedule";
import { clinicServices } from "@/src/lib/healthcare-content";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import type { PatientRecordItem } from "@/src/lib/clinic";

export type WalkInVisitPath = "Clinic" | "Procedure";
type ConsultKind = ClinicConsultKind;

const DEFAULT_DOCTOR_ID = "doctora-kulot-md";

const CONSULT_KIND_OPTIONS: Array<{ value: ConsultKind; label: string }> = [
  { value: "FirstConsult", label: "First Consult" },
  { value: "FollowUp", label: "Follow-up" },
];

const CLINIC_SERVICES = clinicServices
  .filter((s) => !s.appointmentOnly && (s.modes?.includes("Clinic") ?? true))
  .map((s) => s.title);

const PROCEDURE_SERVICES = clinicServices
  .filter((s) => s.appointmentOnly)
  .map((s) => s.title);

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function ConvertToAppointmentModal({
  patient,
  accessToken,
  onClose,
  onSuccess,
}: {
  patient: PatientRecordItem;
  accessToken: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const today = getClinicToday();

  const [visitPath, setVisitPath] = useState<WalkInVisitPath>("Clinic");
  const [consultKind, setConsultKind] = useState<ConsultKind>("FirstConsult");
  const [service, setService] = useState<string>(CLINIC_SERVICES[0] ?? "General Consultation");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const slotMinutes = visitPath === "Procedure" ? PROCEDURE_SLOT_MINUTES : CONSULTATION_SLOT_MINUTES;
  const currentServiceList = useMemo(
    () => (visitPath === "Procedure" ? PROCEDURE_SERVICES : CLINIC_SERVICES),
    [visitPath]
  );

  // Live slot availability from the API
  const {
    slotStatuses,
    blockedReason,
    isLoading: slotsLoading,
  } = useAppointmentAvailability(DEFAULT_DOCTOR_ID, date, "Clinic", slotMinutes);

  // Is this date valid for in-clinic face-to-face visits?
  const isValidDate = isClinicProcedureBookingDate(date);
  const dateWarning = !isValidDate ? standardBookingDateMessage(date) : null;

  // Reset service & time slot when visit path changes
  useEffect(() => {
    const list = visitPath === "Procedure" ? PROCEDURE_SERVICES : CLINIC_SERVICES;
    setService(list[0] ?? "General Consultation");
    setStart("");
  }, [visitPath]);

  // Reset start when date changes
  useEffect(() => {
    setStart("");
  }, [date]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSaving) return;

      if (!date) { setFormError("Please select a date."); return; }
      if (!isValidDate) { setFormError(dateWarning ?? "This date is not a valid clinic day."); return; }
      if (!start) { setFormError("Please select a time slot."); return; }
      if (!service) { setFormError("Please select a service."); return; }
      if (!reason.trim()) { setFormError("Please enter the patient's chief complaint or reason."); return; }
      if (!accessToken) { setFormError("Your session expired. Please sign in again."); return; }

      setFormError(null);
      setIsSaving(true);

      try {
        const encodedReason = encodeAppointmentContext(
          service,
          reason.trim(),
          visitPath === "Clinic" ? consultKind : undefined
        );

        const result = await createWalkInAppointmentAction(accessToken, {
          patientId: patient.id,
          patientName: patient.fullName,
          email: patient.email,
          phone: patient.phone,
          doctorId: DEFAULT_DOCTOR_ID,
          date,
          start,
          type: "Clinic",
          reason: encodedReason,
          patientStatus: patient.patientCategory,
          firstName: patient.firstName,
          middleName: patient.middleName,
          lastName: patient.lastName,
          suffixName: patient.suffixName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          civilStatus: patient.civilStatus,
          address: patient.address,
          religion: patient.religion,
          occupation: patient.occupation,
          guardianName: patient.guardianName,
        });

        if (!result.ok) {
          throw new Error(result.message ?? "Failed to create appointment.");
        }

        const visitTypeLabel = visitPath === "Procedure" ? "Medical Procedure" : "Clinic Visit";
        onSuccess(
          `${visitTypeLabel} appointment created for ${patient.fullName} on ${formatDisplayDate(date)} at ${formatDisplayTime(start)}.`,
        );
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create appointment.");
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, date, isValidDate, dateWarning, start, service, accessToken, reason, consultKind, patient, visitPath, onSuccess],
  );

  const locationLabel = resolveClinicLocationForDate(date)?.label ?? "Doc Kulot Clinic";
  const selectedSlot = slotStatuses.find((s) => s.start === start);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-neutral-950/70 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Convert patient to appointment"
    >
      <div className="mx-auto my-4 w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-gradient-to-r from-teal-50 to-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
              <FaCalendarPlus className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Convert to Appointment</p>
              <h3 className="mt-0.5 text-xl font-black text-neutral-950">{patient.fullName}</h3>
              <p className="mt-0.5 text-sm text-neutral-500">
                {patient.patientNumber ? `#${patient.patientNumber} · ` : ""}
                {patient.patientCategory} patient{patient.phone ? ` · ${patient.phone}` : ""} · Face-to-Face Walk-In
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close modal"
          >
            <FaXmark className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-auto px-6 py-5">
          {formError ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
              {formError}
            </div>
          ) : null}

          {/* Walk-in Visit Type Selection */}
          <div className="mb-5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Face-to-Face Service Type</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisitPath("Clinic")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  visitPath === "Clinic"
                    ? "border-teal-300 bg-teal-50 shadow ring-2 ring-teal-100"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  visitPath === "Clinic" ? "bg-teal-600 text-white" : "bg-neutral-100 text-neutral-600"
                }`}>
                  <FaHospital className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-neutral-900">Clinic Visit</p>
                  <p className="mt-0.5 text-xs text-neutral-500">In-person consultation (30 min)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisitPath("Procedure")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  visitPath === "Procedure"
                    ? "border-amber-300 bg-amber-50 shadow ring-2 ring-amber-100"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  visitPath === "Procedure" ? "bg-amber-600 text-white" : "bg-neutral-100 text-neutral-600"
                }`}>
                  <FaSyringe className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-neutral-900">Medical Procedure</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Aesthetic / surgical (60 min)</p>
                </div>
              </button>
            </div>
          </div>

          {/* Service Dropdown */}
          <div className="mb-5">
            <label className="block">
              <span className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                <FaStethoscope className="h-3 w-3" />
                {visitPath === "Procedure" ? "Procedure Name" : "Consultation / Service"}
              </span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              >
                {currentServiceList.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Consult Kind (for Clinic Visit only) */}
          {visitPath === "Clinic" ? (
            <div className="mb-5">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Consultation Category</p>
              <div className="flex gap-2">
                {CONSULT_KIND_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setConsultKind(value)}
                    className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      consultKind === value
                        ? "border-neutral-800 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Date Picker */}
          <div className="mb-5">
            <label className="block">
              <span className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                <FaCalendarDays className="h-3 w-3" />
                Date
              </span>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-1 w-full rounded-2xl border px-4 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:ring-4 ${
                  !isValidDate
                    ? "border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100"
                    : "border-neutral-200 focus:border-neutral-400 focus:ring-neutral-100"
                }`}
                required
              />
            </label>

            {/* Date validity warning */}
            {dateWarning ? (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <FaTriangleExclamation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{dateWarning}</span>
              </div>
            ) : null}

            {/* Location resolved from date */}
            {isValidDate && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                <FaHospital className="h-3 w-3 shrink-0 text-teal-600" />
                <span>{locationLabel}</span>
              </div>
            )}
          </div>

          {/* Time Slot — Live Schedule & Availability */}
          <div className="mb-5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
              <FaClock className="h-3 w-3" />
              Time Slot ({slotMinutes} min)
              {slotsLoading && (
                <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              )}
            </p>

            {blockedReason ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <FaTriangleExclamation className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">No clinic on this day</p>
                  <p className="mt-0.5 text-xs">{blockedReason}</p>
                </div>
              </div>
            ) : !isValidDate ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                Select a valid clinic day to see available slots.
              </div>
            ) : slotStatuses.length === 0 && !slotsLoading ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                No slots found for this date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slotStatuses.map((slot) => {
                  const isSelected = start === slot.start;
                  const available = slot.availableForType;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={!available || slotsLoading}
                      onClick={() => setStart(slot.start)}
                      title={available ? "Available" : slot.reason}
                      className={`rounded-xl border px-2 py-2.5 text-center text-xs font-bold transition ${
                        isSelected
                          ? visitPath === "Procedure"
                            ? "border-amber-400 bg-amber-600 text-white shadow-sm"
                            : "border-teal-400 bg-teal-600 text-white shadow-sm"
                          : available
                            ? "border-neutral-200 bg-white text-neutral-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                            : "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300"
                      }`}
                    >
                      <p>{formatDisplayTime(slot.start)}</p>
                      <p className={`mt-0.5 font-normal ${isSelected ? "text-white/80" : available ? "text-neutral-400" : "text-neutral-200"}`}>
                        {formatDisplayTime(addMinutes(slot.start, slotMinutes))}
                      </p>
                      {!available && (
                        <p className="mt-0.5 truncate text-[9px] font-semibold text-neutral-400">
                          {slot.reason === "Slot already booked"
                            ? "Booked"
                            : slot.reason === "Past time"
                              ? "Past"
                              : "Closed"}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chief Complaint / Notes */}
          <div className="mb-5">
            <label className="block">
              <span className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                <FaClipboardList className="h-3 w-3" />
                Chief Complaint / Notes
                <span className="text-red-500">*</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (formError && e.target.value.trim()) setFormError(null);
                }}
                rows={3}
                required
                placeholder={
                  visitPath === "Procedure"
                    ? "e.g. Target areas for Botox, wart locations, specific aesthetic requests…"
                    : "e.g. Follow-up for hypertension management, cough for 3 days…"
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </label>
          </div>

          {/* Summary strip */}
          {date && start && isValidDate && selectedSlot?.availableForType ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
              <FaCalendarPlus className="h-4 w-4 shrink-0 text-teal-600" />
              <span className="text-sm font-semibold text-teal-900">
                {formatDisplayDate(date)} · {formatDisplayTime(start)} – {formatDisplayTime(addMinutes(start, slotMinutes))}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                visitPath === "Procedure"
                  ? "border-amber-300 bg-amber-100 text-amber-800"
                  : "border-teal-300 bg-white text-teal-700"
              }`}>
                {visitPath === "Procedure" ? "Medical Procedure" : "Clinic Visit"}
              </span>
              <span className="rounded-full border border-teal-300 bg-white px-2 py-0.5 text-xs font-bold text-teal-700">
                {service}
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                Walk-in · Checked In
              </span>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !start || !date || !isValidDate || !reason.trim()}
              id="convert-to-appointment-submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Creating appointment…
                </>
              ) : (
                <>
                  <FaCheck className="h-3.5 w-3.5" />
                  Create Appointment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
