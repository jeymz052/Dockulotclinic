"use client";

import { useState } from "react";

export type AppointmentReference = {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string | null;
  date: string;
  start?: string;
  end?: string;
  type: string;
  reason: string;
  status: string;
  diagnosis?: string | null;
  notes?: string | null;
  prescription?: string | null;
};

type Props = {
  reference: AppointmentReference;
  onInsertFollowUp?: (text: string) => void;
  onDismiss?: () => void;
};

export function AppointmentReferenceCard({
  reference,
  onInsertFollowUp,
  onDismiss,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [inserted, setInserted] = useState(false);

  const handleInsert = () => {
    const chiefIssue = reference.diagnosis || reference.reason || "your consultation";
    const template = `Hello ${reference.patientName}, this is Doc Kulot following up on your virtual consultation today (${reference.date}). Regarding ${chiefIssue}: please follow your medication instructions carefully and get adequate rest. Feel free to message me directly here if you have any questions or updates on your condition!`;
    
    if (onInsertFollowUp) {
      onInsertFollowUp(template);
      setInserted(true);
      setTimeout(() => setInserted(false), 2500);
    }
  };

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-neutral-50/90 text-neutral-900 transition-all">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100/70 border-b border-neutral-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black text-white text-[11px]">
            🩺
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 truncate">
            Virtual Consultation Reference
          </span>
          <span className="hidden sm:inline-flex rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
            {reference.status || "Completed"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 transition"
            title={collapsed ? "Expand clinical details" : "Collapse clinical details"}
          >
            {collapsed ? "Expand Details ▼" : "Collapse ▲"}
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition"
              aria-label="Dismiss reference card"
              title="Close reference"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary strip when collapsed */}
      {collapsed ? (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-neutral-600">
          <div className="flex items-center gap-3 truncate">
            <span className="font-semibold text-neutral-900">{reference.patientName}</span>
            <span>•</span>
            <span>{reference.date}</span>
            {reference.diagnosis && (
              <>
                <span>•</span>
                <span className="truncate font-medium text-neutral-700">Dx: {reference.diagnosis}</span>
              </>
            )}
          </div>
          {onInsertFollowUp && (
            <button
              type="button"
              onClick={handleInsert}
              className="shrink-0 rounded-md bg-black px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800 transition"
            >
              {inserted ? "✓ Template Inserted" : "Insert Follow-up"}
            </button>
          )}
        </div>
      ) : (
        /* Full Details Grid */
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Patient Info */}
            <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                Patient
              </span>
              <p className="font-bold text-neutral-900 truncate">{reference.patientName}</p>
              <p className="text-neutral-500 text-[11px] truncate">{reference.patientEmail || "No email"}</p>
            </div>

            {/* Visit Schedule */}
            <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                Visit Schedule
              </span>
              <p className="font-semibold text-neutral-900">{reference.date}</p>
              <p className="text-neutral-500 text-[11px]">
                {reference.start ? `${reference.start} - ${reference.end || ""}` : "Virtual Visit"}
              </p>
            </div>

            {/* Chief Complaint / Reason */}
            <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                Chief Complaint
              </span>
              <p className="font-semibold text-neutral-900 line-clamp-2">{reference.reason || "General Consultation"}</p>
            </div>

            {/* Diagnosis */}
            <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                Clinical Diagnosis
              </span>
              <p className="font-bold text-neutral-900 line-clamp-2">
                {reference.diagnosis || "No diagnosis charted yet"}
              </p>
            </div>
          </div>

          {/* Prescriptions / Doctor Notes row if present */}
          {(reference.prescription || reference.notes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {reference.prescription && (
                <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                    Prescriptions / Plan
                  </span>
                  <p className="text-neutral-700 text-[11px] line-clamp-2 whitespace-pre-line font-mono">
                    {reference.prescription}
                  </p>
                </div>
              )}
              {reference.notes && (
                <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block mb-0.5">
                    Consultation Notes
                  </span>
                  <p className="text-neutral-700 text-[11px] line-clamp-2 whitespace-pre-line">
                    {reference.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-neutral-500">
              💡 Doc Kulot can reference this context while messaging or insert a quick follow-up message below.
            </p>

            {onInsertFollowUp && (
              <button
                type="button"
                onClick={handleInsert}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-95 transition"
              >
                <span>💬</span>
                <span>{inserted ? "✓ Inserted in Message Box" : "Insert Follow-up Template"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
