"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  FaArrowLeft,
  FaCalendarDay,
  FaCircleCheck,
  FaCircleXmark,
  FaClipboardCheck,
  FaClock,
  FaHospitalUser,
  FaPhone,
  FaUserDoctor,
  FaUserPlus,
} from "react-icons/fa6";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import type { PatientRecordItem } from "@/src/lib/clinic";
import { GENDER_OPTIONS, validatePatientRegistrationFields } from "@/src/lib/patient-registration";
import { getClinicToday } from "@/src/lib/timezone";

type WalkInForm = Omit<PatientRecordItem, "id" | "status">;
type IntakeForm = WalkInForm & {
  date: string;
  start: string;
  reason: string;
};

const DEFAULT_DOCTOR_ID = "doctora-kulot-md";
const today = getClinicToday();

const INITIAL_FORM: IntakeForm = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  familyHistory: "",
  allergies: "",
  medicalHistory: "",
  isWalkIn: true,
  patientCategory: "New",
  date: today,
  start: "",
  reason: "",
};

export default function WalkInIntakePage() {
  const { accessToken, role, isLoading: isRoleLoading } = useRole();
  const { doctors } = useDoctors();
  const [form, setForm] = useState<IntakeForm>(INITIAL_FORM);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  const maxBirthDate = new Date().toISOString().slice(0, 10);
  const canManage = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const primaryDoctor = doctors[0] ?? null;
  const activeDoctorId = primaryDoctor?.slug ?? DEFAULT_DOCTOR_ID;
  const selectedDoctor = primaryDoctor ?? getDoctorById(activeDoctorId);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(activeDoctorId, form.date, "Clinic");
  const selectedSlot = useMemo(
    () => slotStatuses.find((slot) => slot.start === form.start) ?? null,
    [form.start, slotStatuses],
  );
  const intakeReady = !!form.start && !!form.reason.trim();

  function updateField<K extends keyof IntakeForm>(field: K, value: IntakeForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setFeedback({ message: "Your session expired. Please sign in again.", tone: "error" });
      return;
    }

    const validationError = validatePatientRegistrationFields(form);
    if (validationError) {
      setFeedback({ message: validationError, tone: "error" });
      return;
    }
    if (!form.reason.trim()) {
      setFeedback({ message: "Please add the reason for today's walk-in visit.", tone: "error" });
      return;
    }
    if (!form.start) {
      setFeedback({ message: "Please choose an available clinic slot for the walk-in patient.", tone: "error" });
      return;
    }

    startTransition(async () => {
      const patientRecordResponse = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          address: form.address,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          familyHistory: form.familyHistory,
          allergies: form.allergies,
          medicalHistory: form.medicalHistory,
          isWalkIn: true,
          patientCategory: form.patientCategory,
        }),
      });

      if (!patientRecordResponse.ok) {
        const body = (await patientRecordResponse.json().catch(() => null)) as { message?: string } | null;
        setFeedback({ message: body?.message ?? "Unable to save walk-in patient.", tone: "error" });
        return;
      }

      const bookingResponse = await fetch("/api/appointments/walk-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientName: form.fullName,
          email: form.email,
          phone: form.phone,
          doctorId: activeDoctorId,
          date: form.date,
          start: form.start,
          type: "Clinic",
          reason: form.reason.trim(),
        }),
      });

      const bookingResult = (await bookingResponse.json().catch(() => null)) as
        | {
            message?: string;
            appointment?: {
              patientName: string;
              date: string;
              start: string;
              end: string;
              queueNumber: number;
            };
          }
        | null;

      if (!bookingResponse.ok || !bookingResult?.appointment) {
        setFeedback({
          message: `Patient record saved, but the walk-in could not be queued: ${bookingResult?.message ?? "Unknown booking error."}`,
          tone: "error",
        });
        return;
      }

      setForm({
        ...INITIAL_FORM,
        date: today,
      });
      setFeedback({
        message: `${bookingResult.appointment.patientName} is now checked in for ${formatDisplayDate(bookingResult.appointment.date)} at ${formatRange(bookingResult.appointment.start, bookingResult.appointment.end)}. Queue #${bookingResult.appointment.queueNumber}.`,
        tone: "success",
      });
    });
  }

  if (isRoleLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600 shadow-sm">
        Loading walk-in intake...
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-gold-200 bg-gold-50 px-5 py-4 text-sm text-gold-700">
        Only clinic staff can add walk-in patients.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-gold-100 bg-[radial-gradient(circle_at_top_left,_rgba(120,53,15,0.12),_transparent_34%),linear-gradient(135deg,_#fcf9ef,_#eff7ff_48%,_#f1de9e)] p-6 shadow-[0_30px_80px_rgba(120,53,15,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">Walk-In Intake</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900">Add walk-in patients and place them directly in today&apos;s clinic flow</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
              This intake screen is for patients who did not book online and already arrived at the clinic. The secretary can register the patient, choose a live slot, and check them into the queue in one pass.
            </p>
          </div>

          <Link
            href="/patients"
            className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-white px-5 py-3 text-sm font-semibold text-gold-700 transition hover:bg-gold-50"
          >
            <FaArrowLeft className="h-4 w-4" />
            Back to Patients
          </Link>
        </div>
      </section>

      {feedback ? (
        <div
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-gold-200 bg-gold-50 text-gold-700"
              : "border border-gold-200 bg-gold-50 text-gold-800"
          }`}
        >
            {feedback.tone === "success" ? (
              <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
            ) : (
              <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            )}
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <IntakeMetric label="Visit Type" value="Clinic" detail="Walk-ins use clinic-only flow" icon={<FaHospitalUser className="h-4 w-4" />} />
        <IntakeMetric label="Assigned Doctor" value={selectedDoctor?.name?.replace(/^Dra\.\s*/, "Dra. ") ?? "Assigned doctor"} detail={selectedDoctor?.specialty ?? "Family Medicine and Aesthetic Medicine"} icon={<FaUserDoctor className="h-4 w-4" />} />
        <IntakeMetric label="Selected Date" value={formatDisplayDate(form.date)} detail={blockedReason ?? "Live slot availability is active"} icon={<FaCalendarDay className="h-4 w-4" />} />
        <IntakeMetric label="Queue Preview" value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"} detail={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} icon={<FaClipboardCheck className="h-4 w-4" />} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]">
        <form onSubmit={handleSubmit} className="rounded-4xl border border-gold-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-gold-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-700">
                  <FaUserPlus className="h-3.5 w-3.5" />
                  Step 1
                </span>
                <h2 className="text-lg font-bold text-neutral-900">Patient details</h2>
              </div>
              <p className="mt-2 text-sm text-neutral-600">Create or refresh the patient record before placing them in the active clinic queue.</p>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Full Name"><input type="text" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Juan Dela Cruz" required /></Field>
                <Field label="Email"><input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="juan@example.com" required /></Field>
                <Field label="Phone"><input type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="+63 912 345 6789" required /></Field>
                <Field label="Date of Birth"><input type="date" max={maxBirthDate} value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" required /></Field>
                <Field label="Gender">
                  <select value={form.gender} onChange={(event) => updateField("gender", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" required>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Patient Type"><div className="mt-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm font-semibold text-gold-700">Walk-in patient</div></Field>
                <Field label="Patient Pricing">
                  <select value={form.patientCategory} onChange={(event) => updateField("patientCategory", event.target.value as IntakeForm["patientCategory"])} className="mt-2 w-full rounded-2xl border border-gold-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" required>
                    <option value="New">New patient</option>
                    <option value="Regular">Regular / follow-up</option>
                    <option value="OldRecord">Old patient record</option>
                  </select>
                </Field>
              </div>

              <Field label="Address"><input type="text" value={form.address} onChange={(event) => updateField("address", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Street, barangay, city" required /></Field>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Emergency Contact Name"><input type="text" value={form.emergencyContactName} onChange={(event) => updateField("emergencyContactName", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Parent, spouse, sibling, guardian" /></Field>
                <Field label="Emergency Contact Phone"><input type="text" value={form.emergencyContactPhone} onChange={(event) => updateField("emergencyContactPhone", event.target.value)} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="+63 9XX XXX XXXX" /></Field>
              </div>
              <Field label="Medical History"><textarea value={form.medicalHistory} onChange={(event) => updateField("medicalHistory", event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Past illnesses, operations, maintenance medicines, pregnancy history, or other relevant medical history" /></Field>
              <Field label="Allergies"><textarea value={form.allergies} onChange={(event) => updateField("allergies", event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Drug allergies, food allergies, latex, or no known allergies" /></Field>
            </div>

            <div className="rounded-[1.75rem] border border-gold-100 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbff_100%)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-700">
                  <FaClock className="h-3.5 w-3.5" />
                  Step 2
                </span>
                <h2 className="text-lg font-bold text-neutral-900">Assign slot and reason for visit</h2>
              </div>
              <p className="mt-2 text-sm text-neutral-600">Pick from the same availability used by the booking system so walk-ins follow the normal slot capacity and queue rules.</p>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field label="Visit Date"><input type="date" min={today} value={form.date} onChange={(event) => { updateField("date", event.target.value); updateField("start", ""); }} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" required /></Field>
                <Field label="Assigned Doctor"><div className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">{selectedDoctor?.name ?? "Loading doctor..."}</div></Field>
              </div>

              <Field label="Reason for Visit"><textarea value={form.reason} onChange={(event) => updateField("reason", event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-gold-100 px-4 py-3 text-sm outline-none transition focus:border-gold-300 focus:ring-4 focus:ring-gold-100" placeholder="Fever follow-up, cough and colds, blood pressure check, prescription refill..." required /></Field>

              {blockedReason ? <div className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-700">{blockedReason}{nextAvailableSlot ? ` Next available slot: ${formatDisplayDate(nextAvailableSlot.date)} at ${formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}.` : ""}</div> : null}
              {availabilityError ? <div className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-700">{availabilityError}</div> : null}

              <div className="mt-5">
                <SharedSlotPicker slotStatuses={slotStatuses} selectedStart={form.start} onSelect={(start) => updateField("start", start)} disabled={isSubmitting} loading={availabilityLoading} title="Available clinic slots for walk-in intake" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={isSubmitting || !intakeReady} className="rounded-full bg-[linear-gradient(135deg,#67490c,#855d0c)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(120,53,15,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(120,53,15,0.2)] disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? "Saving Walk-In..." : "Add Walk-In Patient"}
              </button>
              <Link href="/patients" className="rounded-full border border-gold-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-gold-50">Cancel</Link>
            </div>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-4xl border border-gold-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">Walk-In Summary</p>
            <h2 className="mt-2 text-lg font-bold text-neutral-900">Ready for front desk handoff</h2>
            <div className="mt-4 space-y-3">
              <SummaryRow label="Patient">{form.fullName.trim() || "Waiting for patient name"}</SummaryRow>
              <SummaryRow label="Contact">{form.phone.trim() || form.email.trim() || "Waiting for contact details"}</SummaryRow>
              <SummaryRow label="Doctor">{selectedDoctor?.name ?? "Loading doctor..."}</SummaryRow>
              <SummaryRow label="Date">{formatDisplayDate(form.date)}</SummaryRow>
              <SummaryRow label="Slot">{selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose an available slot"}</SummaryRow>
              <SummaryRow label="Queue Number">{selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}</SummaryRow>
            </div>
          </div>

          <div className="rounded-4xl border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Secretary Flow</p>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              <FlowStep icon={<FaUserPlus className="h-4 w-4" />} title="Register the patient" body="Creates or refreshes the patient record using the provided contact details." />
              <FlowStep icon={<FaClipboardCheck className="h-4 w-4" />} title="Claim an open slot" body="Uses the same live booking availability, queue limits, and doctor schedule rules." />
              <FlowStep icon={<FaPhone className="h-4 w-4" />} title="Mark as arrived" body="The appointment is created already checked in, ready for the normal clinic queue and POS flow." />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function IntakeMetric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-gold-100 bg-white p-5 shadow-[0_16px_34px_rgba(120,53,15,0.06)]">
      <div className="flex items-center gap-2 text-gold-700">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-3 text-lg font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{detail}</p>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{children}</p>
    </div>
  );
}

function FlowStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-neutral-100 bg-white/80 px-4 py-3">
      <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-neutral-900">{title}</p>
        <p className="mt-1 leading-6">{body}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}
