"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowUpRightFromSquare, FaCheck, FaFileMedical, FaFileSignature, FaFolderOpen } from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getAppointmentPrimaryLabel, isProcedureServiceTitle } from "@/src/lib/appointment-context";
import { resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import ProcedureConsentRegister from "@/src/components/appointments/ProcedureConsentRegister";

type PatientFile = {
  id: string;
  appointment_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
};

type ProcedureConsent = {
  id: string;
  appointment_id: string | null;
  procedure_name: string;
  patient_name: string;
  patient_signature: string;
  witness_name: string | null;
  witness_signature: string | null;
  witness_signed_at: string | null;
  physician_name: string | null;
  physician_signature: string | null;
  physician_signed_at: string | null;
  consent_form_url: string;
  consent_snapshot: Record<string, unknown>;
  aftercare_acknowledged: boolean;
  aftercare_guide_title: string | null;
  aftercare_image_url: string | null;
  signed_at: string;
};

const FALLBACK_CONSENT_POINTS = [
  "The procedure, purpose, expected benefits, possible risks, side effects, complications, and possible alternatives were explained in a language I understand.",
  "I understand that results vary and that no exact result, cosmetic outcome, or medical response can be guaranteed.",
  "I understand that no medical or aesthetic procedure is completely risk-free, even when proper care is provided.",
  "I had the opportunity to ask questions and confirm that my questions were answered before signing.",
  "I voluntarily authorize Doc Kulot, Family Medicine Specialist and Aesthetic Medicine, to perform the selected procedure.",
];

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", options);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : "";
}

function SignatureBlock({
  label,
  name,
  signature,
  signedAt,
}: {
  label: string;
  name: string | null;
  signature: string | null;
  signedAt: string | null;
}) {
  return (
    <div className="border border-neutral-300 bg-white p-3">
      <h4 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-black">{label}</h4>
      {signature ? (
        <img src={signature} alt={`${label} signature`} className="mt-2 h-20 w-full rounded-md border border-neutral-300 bg-white object-contain object-left" />
      ) : (
        <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-xs font-semibold text-neutral-500">Pending signature</div>
      )}
      <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Printed Name: {name || "Pending"}</p>
      <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Date: {formatDate(signedAt) || "Pending"}</p>
    </div>
  );
}

function ConsentQueueItem({
  consent,
  selected,
  onSelect,
}: {
  consent: ProcedureConsent;
  selected: boolean;
  onSelect: () => void;
}) {
  const completedSignatures = [consent.patient_signature, consent.witness_signature, consent.physician_signature].filter(Boolean).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${selected ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black hover:border-black hover:bg-neutral-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-sm font-black ${selected ? "text-white" : "text-black"}`}>{consent.procedure_name}</p>
          <p className={`mt-1 text-xs font-semibold ${selected ? "text-neutral-200" : "text-neutral-600"}`}>Signed {formatDate(consent.signed_at, { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] ${selected ? "border-white/40 text-white" : "border-neutral-300 text-neutral-700"}`}>
          {completedSignatures}/3
        </span>
      </div>
      <p className={`mt-3 text-[0.68rem] font-black uppercase tracking-[0.1em] ${selected ? "text-neutral-200" : "text-neutral-600"}`}>
        {consent.aftercare_acknowledged ? "Aftercare acknowledged" : "Aftercare pending"}
      </p>
    </button>
  );
}

function PatientConsentDocument({ consent }: { consent: ProcedureConsent }) {
  const snapshot = consent.consent_snapshot ?? {};
  const consentTitle = readSnapshotText(snapshot, "consentTitle") || "Patient Consent Form";
  const consentSummary = readSnapshotText(snapshot, "consentSummary") || "Procedure patients must complete and sign the consent form before treatment.";
  const consentPoints = asStringArray(snapshot.consentBullets).length ? asStringArray(snapshot.consentBullets) : FALLBACK_CONSENT_POINTS;
  const signatureName = readSnapshotText(snapshot, "signatureName") || consent.patient_name;

  return (
    <article className="rounded-lg border border-neutral-300 bg-white shadow-sm">
      <div className="border-b border-neutral-300 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-neutral-600">Signed Procedure Consent</p>
            <h3 className="mt-1 text-xl font-black text-black">{consent.procedure_name}</h3>
            <p className="mt-1 text-sm font-semibold text-neutral-600">Signed {formatDate(consent.signed_at)}</p>
          </div>
          <span className="inline-flex w-max items-center gap-2 rounded-full border border-black bg-black px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-white">
            <FaCheck className="h-3 w-3" />
            Patient signed
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-3xl border border-neutral-400 bg-white p-5 text-black sm:p-7">
          <div className="border-b-2 border-black pb-4 text-center">
            <p className="text-2xl font-black uppercase tracking-[0.08em]">{consentTitle}</p>
            <p className="mt-2 text-[0.72rem] font-black uppercase tracking-[0.18em] text-neutral-700">Informed consent for medical / aesthetic procedure</p>
          </div>

          <section className="mt-5 grid gap-3 border-b border-neutral-300 pb-5 text-[0.82rem] leading-6 text-neutral-800 sm:grid-cols-2">
            <p><span className="font-black text-black">Patient:</span> {consent.patient_name}</p>
            <p><span className="font-black text-black">Procedure:</span> {consent.procedure_name}</p>
            <p><span className="font-black text-black">Date signed:</span> {formatDate(consent.signed_at, { month: "short", day: "numeric", year: "numeric" })}</p>
            <p><span className="font-black text-black">Aftercare:</span> {consent.aftercare_guide_title ?? "Not attached"}</p>
          </section>

          <section className="mt-5">
            <h4 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Consent Statement</h4>
            <p className="mt-3 text-[0.84rem] leading-6 text-neutral-800">
              I, <span className="font-black text-black">{consent.patient_name}</span>, voluntarily give consent to undergo <span className="font-black text-black">{consent.procedure_name}</span> to be performed by Doc Kulot, Family Medicine Specialist and Aesthetic Medicine.
            </p>
            <p className="mt-3 text-[0.84rem] leading-6 text-neutral-800">{consentSummary}</p>
          </section>

          <section className="mt-5">
            <h4 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Patient Acknowledgements</h4>
            <ol className="mt-3 space-y-2 text-[0.82rem] leading-6 text-neutral-800">
              {consentPoints.map((point, index) => (
                <li key={`${point}-${index}`} className="grid grid-cols-[1.4rem,1fr] gap-2">
                  <span className="font-black text-black">{index + 1}.</span>
                  <span>{point}</span>
                </li>
              ))}
            </ol>
          </section>

          {consent.aftercare_acknowledged ? (
            <section className="mt-5 border border-neutral-300 p-3">
              <h4 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Aftercare Acknowledgement</h4>
              <p className="mt-2 text-[0.82rem] leading-6 text-neutral-800">I reviewed and acknowledged the procedure-specific aftercare guide: <span className="font-black text-black">{consent.aftercare_guide_title ?? "Procedure aftercare"}</span>.</p>
            </section>
          ) : null}

          <section className="mt-6 grid gap-3 border-t-2 border-black pt-5 lg:grid-cols-3">
            <SignatureBlock label="Patient Signature" name={signatureName} signature={consent.patient_signature} signedAt={consent.signed_at} />
            <SignatureBlock label="Witness Signature" name={consent.witness_name} signature={consent.witness_signature} signedAt={consent.witness_signed_at} />
            <SignatureBlock label="Physician Signature" name={consent.physician_name} signature={consent.physician_signature} signedAt={consent.physician_signed_at} />
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            <a href={consent.consent_form_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-black hover:text-black">
              Open original image
              <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
            </a>
            {consent.aftercare_image_url ? (
              <a href={consent.aftercare_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800">
                Open aftercare image
                <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function PatientFilesPage() {
  const { accessToken, role } = useRole();
  const { appointments, isLoading: isAppointmentsLoading } = useAppointments();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [consents, setConsents] = useState<ProcedureConsent[]>([]);
  const [selectedConsentId, setSelectedConsentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/v2/patient-files", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await res.json().catch(() => ({}))) as { files?: PatientFile[]; message?: string };
        if (!res.ok) throw new Error(payload.message ?? "Unable to load medical files.");
        if (active) {
          setFiles(payload.files ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load medical files.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadConsents() {
      try {
        const res = await fetch("/api/v2/procedure-consents", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await res.json().catch(() => ({}))) as { consents?: ProcedureConsent[] };
        if (active && res.ok) {
          const nextConsents = payload.consents ?? [];
          setConsents(nextConsents);
          setSelectedConsentId((current) => current && nextConsents.some((consent) => consent.id === current) ? current : nextConsents[0]?.id ?? null);
        }
      } catch {
        if (active) setConsents([]);
      }
    }

    void loadConsents();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const aftercareItems = appointments
    .filter((appointment) => appointment.status === "Completed")
    .map((appointment) => {
      const service = getAppointmentPrimaryLabel(appointment.reason, appointment.type);
      if (!isProcedureServiceTitle(service)) return null;
      const guide = resolveAftercareGuideForService(service);
      if (!guide) return null;
      return { appointment, service, guide };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const selectedConsent =
    consents.find((consent) => consent.id === selectedConsentId)
    ?? consents[0]
    ?? null;

  if (role !== "PATIENT") return <ProcedureConsentRegister />;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-neutral-100 bg-linear-to-br from-neutral-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-700">Patient Portal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Medical Documents</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          View files the clinic has released to your portal, including signed procedure consents, aftercare, and visit attachments.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/consultations/history" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          Consultation History
        </Link>
        <Link href="/prescriptions" className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          Prescriptions
        </Link>
      </div>

      {error ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{error}</div> : null}

      {isAppointmentsLoading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      ) : aftercareItems.length ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">Post Procedure Care</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Aftercare Guides</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {aftercareItems.map(({ appointment, service, guide }) => (
              <article key={`${appointment.id}-${guide.title}`} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                <div className="grid gap-0 sm:grid-cols-[140px_1fr]">
                  <img src={guide.image} alt={guide.title} className="h-44 w-full object-cover sm:h-full" />
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">{service}</p>
                    <h3 className="mt-1 text-base font-black text-slate-950">{guide.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Completed {new Date(`${appointment.date}T00:00:00`).toLocaleDateString("en-US")}
                    </p>
                    <a
                      href={guide.image}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Open Guide
                      <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {consents.length ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700">Procedure Consent</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Signed Consent Records</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Select a consent record to view the filled consent form, signatures, and aftercare acknowledgement.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[18rem,minmax(0,1fr)]">
            <aside className="h-fit rounded-lg border border-neutral-300 bg-neutral-50 p-3 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <h3 className="text-sm font-black text-black">Consent Queue</h3>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">Only one form opens at a time.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[0.68rem] font-black text-neutral-700">
                  <FaFileSignature className="h-3 w-3" />
                  {consents.length}
                </span>
              </div>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {consents.map((consent) => (
                  <ConsentQueueItem
                    key={consent.id}
                    consent={consent}
                    selected={selectedConsent?.id === consent.id}
                    onSelect={() => setSelectedConsentId(consent.id)}
                  />
                ))}
              </div>
            </aside>

            {selectedConsent ? <PatientConsentDocument consent={selectedConsent} /> : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
        ) : files.length ? (
          files.map((file) => (
            <article key={file.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
                    <FaFileMedical className="text-neutral-400" />
                    {file.file_name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {file.file_type || "Medical document"} • Uploaded {new Date(file.created_at).toLocaleString("en-US")}
                  </p>
                </div>
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Open File
                  <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <FaFolderOpen className="text-xl text-neutral-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-900">No medical files available yet</p>
            <p className="mt-2">Files will appear here once clinic staff uploads and releases them to your portal.</p>
          </div>
        )}
      </section>
    </div>
  );
}

