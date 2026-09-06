"use client";

import Image from "next/image";
import { useState } from "react";

export type PatientContextAppointment = {
  id: string;
  date: string;
  start: string;
  end: string;
  type: "Online" | "Clinic" | string;
  reason: string;
  status: string;
  queueNumber?: number | null;
  meetingLink?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  prescription?: string | null;
};

export type PatientContextData = {
  patient: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    patientNumber?: string | null;
    dob?: string | null;
    age?: number | null;
    gender?: string | null;
    address?: string | null;
    allergies?: string | null;
    medicalHistory?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
  appointments: PatientContextAppointment[];
  selectedAppointmentId?: string | null;
};

type Props = {
  data: PatientContextData | null;
  loading: boolean;
  onClose: () => void;
  onInsertTemplate?: (text: string) => void;
};

export function PatientDetailsSidebar({
  data,
  loading,
  onClose,
  onInsertTemplate,
}: Props) {
  const [activeTab, setActiveTab] = useState<"bookings" | "info">("bookings");
  const [copiedApptId, setCopiedApptId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-sm sm:max-w-md flex-col border-l border-neutral-200 bg-white p-5 shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="h-5 w-32 animate-pulse rounded bg-neutral-100" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 hover:text-black"
          >
            ✕
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
          <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-sm sm:max-w-md flex-col items-center justify-center border-l border-neutral-200 bg-white p-6 text-center shadow-2xl animate-in slide-in-from-right duration-200">
        <span className="text-3xl">📋</span>
        <p className="mt-3 text-sm font-semibold text-neutral-800">No Patient Selected</p>
        <p className="mt-1 text-xs text-neutral-500">
          Select a patient conversation to view their medical profile and booking history.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Close
        </button>
      </div>
    );
  }

  const { patient, appointments } = data;

  const handleInsertAppt = (appt: PatientContextAppointment) => {
    const issue = appt.diagnosis || appt.reason || "your consultation";
    const template = `Hello ${patient.fullName}, regarding your ${appt.type} consultation on ${appt.date} (${issue}): please follow your prescribed guidelines and rest. Feel free to message here if you have any questions!`;
    if (onInsertTemplate) {
      onInsertTemplate(template);
      setCopiedApptId(appt.id);
      setTimeout(() => setCopiedApptId(null), 2500);
    }
  };

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-sm sm:max-w-md flex-col border-l border-neutral-200 bg-white text-neutral-900 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black text-xs text-white">
            📋
          </span>
          <h3 className="text-sm font-bold tracking-tight text-neutral-900">
            Patient & Booking Details
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-xs font-bold text-neutral-600 transition hover:border-black hover:bg-black hover:text-white"
          aria-label="Close details panel"
          title="Close panel"
        >
          ✕
        </button>
      </div>

      {/* ── Patient Profile Summary Strip ───────────────────── */}
      <div className="border-b border-neutral-200 bg-neutral-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 text-base font-bold text-white shadow-sm">
            {patient.avatarUrl ? (
              <Image src={patient.avatarUrl} alt={patient.fullName} fill className="object-cover" />
            ) : (
              patient.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-neutral-900">{patient.fullName}</h4>
            <p className="truncate text-xs text-neutral-500">{patient.email || "No email"}</p>
            {patient.phone && (
              <p className="text-xs text-neutral-500 font-mono mt-0.5">{patient.phone}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {patient.patientNumber && (
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-mono font-semibold text-neutral-700">
                  {patient.patientNumber}
                </span>
              )}
              {patient.age !== null && (
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                  {patient.age} yrs • {patient.gender || "Patient"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs: Bookings vs Medical Info ──────────────────── */}
      <div className="grid grid-cols-2 border-b border-neutral-200 bg-neutral-100/50 p-1 text-xs font-semibold text-neutral-600">
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
            activeTab === "bookings"
              ? "bg-white text-black shadow-sm"
              : "hover:text-black"
          }`}
        >
          <span>📅 Bookings</span>
          <span className="rounded-full bg-neutral-200 px-1.5 py-0.2 text-[10px] text-neutral-800">
            {appointments.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
            activeTab === "info"
              ? "bg-white text-black shadow-sm"
              : "hover:text-black"
          }`}
        >
          <span>👤 Medical Info</span>
        </button>
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {activeTab === "bookings" ? (
          /* Bookings History */
          <div className="space-y-3.5">
            {appointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-400">
                <span className="text-2xl block mb-2">🗓️</span>
                No appointment bookings found for this patient.
              </div>
            ) : (
              appointments.map((appt, idx) => {
                const isOnline = appt.type === "Online";
                const isLatest = idx === 0;

                return (
                  <div
                    key={appt.id}
                    className={`relative rounded-2xl border p-3.5 text-xs transition ${
                      isLatest
                        ? "border-black bg-white shadow-md ring-1 ring-black/5"
                        : "border-neutral-200 bg-neutral-50/50 hover:bg-white"
                    }`}
                  >
                    {/* Top Row: Date & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isOnline
                              ? "bg-neutral-900 text-white"
                              : "border border-neutral-300 bg-white text-neutral-800"
                          }`}
                        >
                          {isOnline ? "Virtual" : "Clinic Visit"}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-neutral-100 border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                            Latest
                          </span>
                        )}
                      </div>
                      <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {appt.status}
                      </span>
                    </div>

                    {/* Schedule Date & Time */}
                    <div className="font-bold text-neutral-900 flex items-center gap-2">
                      <span>{appt.date}</span>
                      {appt.start && (
                        <span className="text-neutral-500 font-normal">
                          • {appt.start}{appt.end ? ` - ${appt.end}` : ""}
                        </span>
                      )}
                    </div>

                    {/* Chief Complaint / Reason */}
                    <div className="mt-2 rounded-xl bg-neutral-100/70 p-2 text-neutral-700">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
                        Chief Complaint / Reason
                      </span>
                      <p className="font-medium text-neutral-900 leading-snug">
                        {appt.reason || "General Consultation"}
                      </p>
                    </div>

                    {/* Diagnosis if charted */}
                    {appt.diagnosis && (
                      <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
                          Clinical Diagnosis
                        </span>
                        <p className="font-semibold text-neutral-900">{appt.diagnosis}</p>
                      </div>
                    )}

                    {/* Prescriptions if charted */}
                    {appt.prescription && (
                      <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-2">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
                          Prescription / Medication Plan
                        </span>
                        <p className="text-neutral-700 font-mono text-[11px] whitespace-pre-line line-clamp-3">
                          {appt.prescription}
                        </p>
                      </div>
                    )}

                    {/* Action button */}
                    {onInsertTemplate && (
                      <button
                        type="button"
                        onClick={() => handleInsertAppt(appt)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white py-1.5 text-[11px] font-semibold text-neutral-800 shadow-sm transition hover:border-black hover:bg-black hover:text-white"
                      >
                        <span>💬</span>
                        <span>
                          {copiedApptId === appt.id ? "✓ Inserted into chat" : "Insert reference in chat"}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Patient Demographics & Medical Info */
          <div className="space-y-3 text-xs">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 space-y-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Full Name
                </span>
                <p className="font-semibold text-neutral-900">{patient.fullName}</p>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Email
                </span>
                <p className="text-neutral-800">{patient.email || "None recorded"}</p>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Phone Contact
                </span>
                <p className="text-neutral-800 font-mono">{patient.phone || "None recorded"}</p>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Residential Address
                </span>
                <p className="text-neutral-800">{patient.address || "None recorded"}</p>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Emergency Contact
                </span>
                <p className="text-neutral-800">
                  {patient.emergencyContactName ? (
                    <>
                      {patient.emergencyContactName}{" "}
                      {patient.emergencyContactPhone && `(${patient.emergencyContactPhone})`}
                    </>
                  ) : (
                    "None recorded"
                  )}
                </p>
              </div>
            </div>

            {/* Medical history & allergies */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 space-y-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Known Allergies
                </span>
                {patient.allergies ? (
                  <span className="inline-block rounded-md border border-neutral-400 bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-900">
                    ⚠️ {patient.allergies}
                  </span>
                ) : (
                  <p className="text-neutral-500">No known allergies</p>
                )}
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Past Medical History
                </span>
                <p className="text-neutral-700 whitespace-pre-line">
                  {patient.medicalHistory || "None documented"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
