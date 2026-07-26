"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FaCircleCheck, FaHeartPulse, FaNotesMedical, FaUserGroup, FaWeightScale } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";

type Payload = {
  patients: PatientRecordItem[];
  visits: PatientVisitRecord[];
};

export default function PatientRecordsPage() {
  const { accessToken, isLoading: authLoading } = useRole();
  const [patients, setPatients] = useState<PatientRecordItem[]>([]);
  const [visits, setVisits] = useState<PatientVisitRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [familyHistoryDraft, setFamilyHistoryDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    if (authLoading || !accessToken) return;

    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/patient-records", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await response.json().catch(() => null)) as Payload & { message?: string } | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.message ?? "Failed to load patient records.");
        }
        if (!active) return;
        setPatients(payload.patients);
        setVisits(payload.visits);
        setSelectedId((current) => current || payload.patients[0]?.id || "");
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load patient records.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter((patient) => {
      if (!query) return true;
      return (
        patient.fullName.toLowerCase().includes(query) ||
        patient.email.toLowerCase().includes(query) ||
        patient.phone.toLowerCase().includes(query)
      );
    });
  }, [patients, search]);

  const selectedPatient =
    filteredPatients.find((patient) => patient.id === selectedId)
    ?? patients.find((patient) => patient.id === selectedId)
    ?? filteredPatients[0]
    ?? null;

  useEffect(() => {
    setFamilyHistoryDraft(selectedPatient?.familyHistory ?? "");
  }, [selectedPatient?.id, selectedPatient?.familyHistory]);

  const patientVisits = useMemo(
    () => visits.filter((visit) => visit.patientId === selectedPatient?.id),
    [selectedPatient?.id, visits],
  );

  function saveFamilyHistory() {
    if (!accessToken || !selectedPatient) return;

    startTransition(async () => {
      const response = await fetch("/api/patient-records", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          familyHistory: familyHistoryDraft,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | { ok: true } | null;
      if (!response.ok) {
        const message =
          payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Unable to save family history.";
        setFeedback(message);
        return;
      }

      setPatients((current) =>
        current.map((patient) =>
          patient.id === selectedPatient.id
            ? { ...patient, familyHistory: familyHistoryDraft.trim() }
            : patient,
        ),
      );
      setFeedback("Family history saved.");
    });
  }

  const pendingFamilyHistorySave =
    selectedPatient != null && familyHistoryDraft !== (selectedPatient.familyHistory ?? "");

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-yellow-100 bg-[radial-gradient(circle_at_top_left,_rgba(133,77,14,0.24),_transparent_34%),linear-gradient(135deg,_#f0faff,_#eef9ff_48%,_#e0f6ff)] p-6 shadow-[0_30px_80px_rgba(133,77,14,0.14)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow-700">Patient Records</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Medical history, vitals, and family history in one view</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Use this screen to review a patient&apos;s visit timeline, see recorded vital signs per appointment, and keep the shared family history up to date.
        </p>
      </section>

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

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="rounded-4xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <label className="block text-sm font-medium text-slate-700">
            Search patient
              <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or phone"
                className="mt-2 w-full rounded-2xl border border-yellow-100 px-4 py-3 text-sm outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
            />
          </label>

          <div className="mt-5 space-y-3">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => setSelectedId(patient.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedPatient?.id === patient.id
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-slate-200 bg-white hover:border-yellow-200 hover:bg-yellow-50/40"
                }`}
              >
                <p className="font-semibold text-slate-900">{patient.fullName}</p>
                <p className="mt-1 text-sm text-slate-500">{patient.email}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span>{patient.isWalkIn ? "Walk-in" : "Registered"}</span>
                  <span>•</span>
                  <span>{patient.status}</span>
                </div>
              </button>
            ))}

            {!filteredPatients.length && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No patients match the current search.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="space-y-6">
          {selectedPatient ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoCard title="Patient Profile" icon={<FaUserGroup className="h-4 w-4" />}>
                  <p className="text-lg font-bold text-slate-900">{selectedPatient.fullName}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedPatient.email}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedPatient.phone || "No phone on file"}</p>
                </InfoCard>
                <InfoCard title="Demographics" icon={<FaNotesMedical className="h-4 w-4" />}>
                  <DetailRow label="DOB" value={selectedPatient.dateOfBirth || "-"} />
                  <DetailRow label="Gender" value={selectedPatient.gender || "-"} />
                  <DetailRow label="Address" value={selectedPatient.address || "-"} />
                </InfoCard>
                <InfoCard title="Visit Snapshot" icon={<FaCircleCheck className="h-4 w-4" />}>
                  <DetailRow label="Visits on record" value={String(patientVisits.length)} />
                  <DetailRow label="Latest status" value={patientVisits[0]?.status ?? "No visits yet"} />
                  <DetailRow label="Type" value={selectedPatient.isWalkIn ? "Walk-in patient" : "Registered patient"} />
                </InfoCard>
              </div>

              <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family History</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Shared patient background</h2>
                  </div>
                  <button
                    type="button"
                    onClick={saveFamilyHistory}
                    disabled={isSaving || !pendingFamilyHistorySave}
                    className="rounded-full bg-yellow-400 px-5 py-2 text-sm font-semibold text-white transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save Family History"}
                  </button>
                </div>
                <textarea
                  value={familyHistoryDraft}
                  onChange={(event) => {
                    setFamilyHistoryDraft(event.target.value);
                    setFeedback(null);
                  }}
                  rows={5}
                  placeholder="Document illnesses or conditions seen in the family, for example hypertension, diabetes, stroke, asthma, or cancer."
                  className="mt-4 w-full rounded-3xl border border-yellow-100 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visit Timeline</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Vitals and consultation records</h2>
                  </div>
                  <p className="text-sm text-slate-500">{patientVisits.length} visit(s)</p>
                </div>

                <div className="mt-5 space-y-4">
                  {patientVisits.length ? (
                    patientVisits.map((visit) => {
                      const doctor = getDoctorById(visit.doctorId);
                      return (
                        <article key={visit.appointmentId} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">
                                {formatDisplayDate(visit.date)} · {formatRange(visit.start, visit.end)}
                              </h3>
                              <p className="mt-1 text-sm text-slate-600">
                                {doctor?.name ?? "Assigned doctor"} · {visit.type} · Queue #{visit.queueNumber}
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                <span className="font-semibold">Reason:</span> {visit.reason || "No visit reason recorded."}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                              {visit.status}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <section className="rounded-2xl border border-yellow-100 bg-white p-4">
                              <div className="flex items-center gap-2 text-yellow-700">
                                <FaHeartPulse className="h-4 w-4" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em]">Vitals</p>
                              </div>
                              {visit.vitals ? (
                                <div className="mt-3 space-y-2 text-sm text-slate-700">
                                  <VitalsRow label="Blood Pressure" value={formatBloodPressure(visit.vitals.bpSystolic, visit.vitals.bpDiastolic)} />
                                  <VitalsRow label="Temperature" value={formatOptionalNumber(visit.vitals.temperatureC, "°C")} />
                                  <VitalsRow label="Pulse" value={formatOptionalNumber(visit.vitals.pulseRate, "bpm")} />
                                  <VitalsRow label="SpO2" value={formatOptionalNumber(visit.vitals.oxygenSaturation, "%")} />
                                  <VitalsRow label="Respiratory Rate" value={formatOptionalNumber(visit.vitals.respiratoryRate, "/min")} />
                                  <VitalsRow label="Weight" value={formatOptionalNumber(visit.vitals.weightKg, "kg")} />
                                  <VitalsRow label="Height" value={formatOptionalNumber(visit.vitals.heightCm, "cm")} />
                                  <p className="pt-2 text-xs text-slate-500">
                                    Updated {new Date(visit.vitals.updatedAt).toLocaleString("en-US")}
                                  </p>
                                  {visit.vitals.notes ? (
                                    <p className="rounded-2xl bg-yellow-50 px-3 py-2 text-sm text-slate-700">
                                      {visit.vitals.notes}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <EmptyBlock label="No vitals recorded for this visit." />
                              )}
                            </section>

                            <section className="rounded-2xl border border-yellow-100 bg-white p-4">
                              <div className="flex items-center gap-2 text-yellow-700">
                                <FaWeightScale className="h-4 w-4" />
                                <p className="text-xs font-semibold uppercase tracking-[0.16em]">Consultation</p>
                              </div>
                              {visit.consultation ? (
                                <div className="mt-3 space-y-3 text-sm text-slate-700">
                                  <div>
                                    <p className="font-semibold text-slate-900">Note</p>
                                    <p className="mt-1">{visit.consultation.note || "No consultation note recorded."}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">Prescription / Plan</p>
                                    <p className="mt-1">{visit.consultation.prescription || "No prescription recorded."}</p>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Updated {new Date(visit.consultation.updatedAt).toLocaleString("en-US")}
                                  </p>
                                </div>
                              ) : (
                                <EmptyBlock label="No consultation note recorded for this visit." />
                              )}
                            </section>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-500">
                      No appointments or visit records have been saved for this patient yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-500">
              {isLoading ? "Loading patient records..." : "Choose a patient to review their medical record."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-yellow-100 bg-white p-5 shadow-[0_16px_34px_rgba(133,77,14,0.08)]">
      <div className="flex items-center gap-2 text-yellow-700">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1 text-sm text-slate-700">
      <span className="font-semibold text-slate-900">{label}:</span> {value}
    </p>
  );
}

function VitalsRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-slate-900">{label}:</span> {value}
    </p>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return <p className="mt-3 text-sm text-slate-500">{label}</p>;
}

function formatOptionalNumber(value: number | null, unit: string) {
  return value == null ? "-" : `${value} ${unit}`;
}

function formatBloodPressure(systolic: number | null, diastolic: number | null) {
  if (systolic == null && diastolic == null) return "-";
  return `${systolic ?? "?"}/${diastolic ?? "?"} mmHg`;
}
