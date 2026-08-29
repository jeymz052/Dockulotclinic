"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FaCheck, FaClipboardCheck, FaFileSignature, FaPenNib, FaRotateLeft, FaTriangleExclamation } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type Consent = {
  id: string;
  procedure_name: string;
  patient_name: string;
  patient_signature: string;
  witness_name: string | null;
  witness_signature: string | null;
  witness_signed_at: string | null;
  physician_name: string | null;
  physician_signature: string | null;
  physician_signed_at: string | null;
  consent_snapshot?: Record<string, unknown> | null;
  aftercare_guide_title: string | null;
  signed_at: string;
};

type StaffSignaturePadProps = {
  label: string;
  helper: string;
  printedName: string;
  completedName?: string | null;
  completedSignature?: string | null;
  completedAt?: string | null;
  disabled?: boolean;
  saving?: boolean;
  onSubmit: (signature: string) => void;
};

const FALLBACK_CONSENT_POINTS = [
  "I confirm that all procedure/s to be done on me has been fully explained to me in a language that I understand, including the nature and purpose, expected benefits, possible risks, side effects, complications and possible alternatives, including doing nothing.",
  "I understand the intended outcome and that results may vary from person to person. No guarantees or promises have been made to me regarding specific results.",
  "I understand that while every effort will be made to ensure safety and the best possible care, no medical procedure is 100% risk-free.",
  "I am aware that the clinic and the attending physician (Doc Kulot) do not take responsibility for any uneventful incident, complication, or dissatisfaction that may occur despite proper care.",
  "I hereby consent willingly and voluntarily to undergo the above-stated procedure(s). I will not hold the clinic, its staff, or the attending physician liable for any adverse outcome, and I will not initiate any legal action or claim against them.",
  "I understand that I may withdraw my consent at any time prior to the procedure. Once the procedure has started, I understand that I may not be able to withdraw my consent.",
];

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH", options);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : "";
}

function SignatureImage({ src, alt, tall = false }: { src: string; alt: string; tall?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`mt-2 w-full rounded-md border border-neutral-300 bg-white object-contain object-left ${tall ? "h-24" : "h-20"}`}
    />
  );
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${done ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-neutral-600"}`}>
      {done ? <FaCheck className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full border border-current" />}
      {label}
    </span>
  );
}

function getConsentStatus(consent: Consent) {
  if (!consent.witness_signature) return "Needs witness";
  if (!consent.physician_signature) return "Needs physician";
  return "Complete";
}

function getConsentProgress(consent: Consent) {
  return [true, Boolean(consent.witness_signature), Boolean(consent.physician_signature)].filter(Boolean).length;
}

function ConsentQueueItem({
  consent,
  selected,
  onSelect,
}: {
  consent: Consent;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = getConsentStatus(consent);
  const progress = getConsentProgress(consent);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${selected ? "border-black bg-black text-white shadow-sm" : "border-neutral-300 bg-white text-black hover:border-black hover:bg-neutral-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-sm font-black ${selected ? "text-white" : "text-black"}`}>{consent.patient_name}</p>
          <p className={`mt-1 truncate text-xs font-semibold ${selected ? "text-neutral-200" : "text-neutral-600"}`}>{consent.procedure_name}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] ${selected ? "border-white/40 text-white" : "border-neutral-300 text-neutral-700"}`}>
          {progress}/3
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={`text-[0.68rem] font-black uppercase tracking-[0.1em] ${selected ? "text-neutral-200" : "text-neutral-600"}`}>{status}</span>
        <span className={`text-[0.68rem] font-semibold ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
          {formatDate(consent.signed_at, { month: "short", day: "numeric" })}
        </span>
      </div>
    </button>
  );
}

function StaffSignaturePad({
  label,
  helper,
  printedName,
  completedName,
  completedSignature,
  completedAt,
  disabled,
  saving,
  onSubmit,
}: StaffSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  function prepareCanvas(canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000000";
    context.lineWidth = 2.4 * ratio;
  }

  function getPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  }

  function beginSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    if (!hasSignature) prepareCanvas(canvas);
    const point = getPoint(event);
    if (!point) return;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsSigning(true);
    setHasSignature(true);
  }

  function drawSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isSigning || disabled) return;
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    setIsSigning(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function submitSignature() {
    const signature = canvasRef.current?.toDataURL("image/png") ?? "";
    onSubmit(signature);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || completedSignature) return;
    prepareCanvas(canvas);
  }, [completedSignature]);

  if (completedSignature) {
    return (
      <div className="border border-neutral-300 bg-white p-4">
        <h3 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-black">{label}</h3>
        <SignatureImage src={completedSignature} alt={`${label} signature`} />
        <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Printed Name: {completedName}</p>
        <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Date: {formatDate(completedAt)}</p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-black">{label}</h3>
          <p className="mt-1 text-[0.74rem] font-semibold leading-5 text-neutral-600">{helper}</p>
        </div>
        <button type="button" onClick={clearSignature} disabled={disabled || !hasSignature} aria-label={`Clear ${label.toLowerCase()}`} title={`Clear ${label.toLowerCase()}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">
          <FaRotateLeft className="h-3.5 w-3.5" />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={`${label} pad`}
        onPointerDown={beginSignature}
        onPointerMove={drawSignature}
        onPointerUp={endSignature}
        onPointerCancel={endSignature}
        onPointerLeave={endSignature}
        className="mt-3 h-24 w-full touch-none rounded-md border border-dashed border-neutral-400 bg-white"
      />
      <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Printed Name: {printedName || "Signed-in staff"}</p>
      <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Date: {new Date().toLocaleDateString("en-PH")}</p>
      <button type="button" disabled={disabled || saving || !hasSignature} onClick={submitSignature} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
        <FaPenNib className="h-3.5 w-3.5" />
        {saving ? "Saving..." : `Complete ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

function ConsentDocument({
  consent,
  printedName,
  isDoctor,
  saving,
  onSign,
}: {
  consent: Consent;
  printedName: string;
  isDoctor: boolean;
  saving: boolean;
  onSign: (signature: string) => void;
}) {
  const snapshot = consent.consent_snapshot ?? {};
  const consentTitle = readSnapshotText(snapshot, "consentTitle") || "Patient Consent Form";
  const consentSummary = readSnapshotText(snapshot, "consentSummary") || "Procedure patients must complete and sign the consent form before treatment.";
  const consentPoints = asStringArray(snapshot.consentBullets).length ? asStringArray(snapshot.consentBullets) : FALLBACK_CONSENT_POINTS;
  const signatureName = readSnapshotText(snapshot, "signatureName") || consent.patient_name;
  const isWitnessDone = Boolean(consent.witness_signature);
  const isPhysicianDone = Boolean(consent.physician_signature);

  return (
    <article className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm">
      <div className="border-b border-neutral-300 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-neutral-600">Informed Procedure Consent</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-black">{consent.patient_name}</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-700">{consent.procedure_name}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusPill done label="Patient signed" />
            <StatusPill done={isWitnessDone} label="Witness" />
            <StatusPill done={isPhysicianDone} label="Physician" />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr),20rem]">
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
              <h3 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Consent Statement</h3>
              <p className="mt-3 text-[0.84rem] leading-6 text-neutral-800">
                I, <span className="font-black text-black">{consent.patient_name}</span>, voluntarily give consent to undergo <span className="font-black text-black">{consent.procedure_name}</span> to be performed by Doc Kulot, Family Medicine Specialist and Aesthetic Medicine.
              </p>
              <p className="mt-3 text-[0.84rem] leading-6 text-neutral-800">{consentSummary}</p>
            </section>

            <section className="mt-5">
              <h3 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Patient Acknowledgements</h3>
              <ol className="mt-3 space-y-2 text-[0.82rem] leading-6 text-neutral-800">
                {consentPoints.map((point, index) => (
                  <li key={`${point}-${index}`} className="grid grid-cols-[1.4rem,1fr] gap-2">
                    <span className="font-black text-black">{index + 1}.</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Disclaimer Section */}
            <section className="mt-5 border border-neutral-300 bg-neutral-50 p-3.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-black text-xs font-black text-white">
                  +
                </div>
                <div>
                  <h3 className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-neutral-950">Disclaimer</h3>
                  <p className="mt-1 text-[0.78rem] leading-5 text-neutral-700">
                    By signing this form, I acknowledge that I have read, understood, and had the opportunity to ask questions. All procedures, benefits, risks, possible side effects, alternatives, and expected outcomes were explained to me. I am signing this consent form of my own free will.
                  </p>
                </div>
              </div>
            </section>

            {consent.aftercare_guide_title ? (
              <section className="mt-5 border border-neutral-300 p-3">
                <h3 className="text-[0.76rem] font-black uppercase tracking-[0.18em] text-black">Aftercare Acknowledgement</h3>
                <p className="mt-2 text-[0.82rem] leading-6 text-neutral-800">The patient reviewed and acknowledged the procedure-specific aftercare guide: <span className="font-black text-black">{consent.aftercare_guide_title}</span>.</p>
              </section>
            ) : null}

            <section className="mt-6 grid gap-3 border-t-2 border-black pt-5 lg:grid-cols-3">
              <div className="border border-neutral-300 p-3">
                <h3 className="text-[0.68rem] font-black uppercase tracking-[0.16em]">Patient Signature</h3>
                <SignatureImage src={consent.patient_signature} alt={`${consent.patient_name} patient signature`} tall />
                <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Printed Name: {signatureName}</p>
                <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.74rem] font-semibold text-neutral-800">Date: {formatDate(consent.signed_at)}</p>
              </div>

              <StaffSignaturePad
                label="Witness Signature"
                helper={isDoctor ? "Pending clinic secretary / witness completion." : "Review the consent statement, then sign as clinic witness."}
                printedName={printedName}
                completedName={consent.witness_name}
                completedSignature={consent.witness_signature}
                completedAt={consent.witness_signed_at}
                disabled={isDoctor}
                saving={saving}
                onSubmit={onSign}
              />

              <StaffSignaturePad
                label="Physician Signature"
                helper={isDoctor ? "Review the full consent, then complete the physician section." : "Pending Doc Kulot / attending physician completion."}
                printedName={printedName}
                completedName={consent.physician_name}
                completedSignature={consent.physician_signature}
                completedAt={consent.physician_signed_at}
                disabled={!isDoctor}
                saving={saving}
                onSubmit={onSign}
              />
            </section>
          </div>
        </div>

        <aside className="border-t border-neutral-300 bg-neutral-50 p-4 lg:border-l lg:border-t-0">
          <h3 className="flex items-center gap-2 text-[0.72rem] font-black uppercase tracking-[0.16em] text-black">
            <FaClipboardCheck className="h-4 w-4" />
            Completion Flow
          </h3>
          <div className="mt-4 space-y-3">
            <div className="border border-neutral-300 bg-white p-3">
              <p className="text-sm font-black text-black">1. Patient consent</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">Patient reviewed the consent statement, aftercare, and signed on booking.</p>
            </div>
            <div className={`border p-3 ${isWitnessDone ? "border-black bg-white" : "border-neutral-300 bg-white"}`}>
              <p className="text-sm font-black text-black">2. Witness review</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">{isWitnessDone ? `${consent.witness_name} signed ${formatDate(consent.witness_signed_at)}.` : "Clinic witness confirms the patient consent is complete."}</p>
            </div>
            <div className={`border p-3 ${isPhysicianDone ? "border-black bg-white" : "border-neutral-300 bg-white"}`}>
              <p className="text-sm font-black text-black">3. Physician completion</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">{isPhysicianDone ? `${consent.physician_name} signed ${formatDate(consent.physician_signed_at)}.` : "Physician reviews the signed consent before procedure completion."}</p>
            </div>
          </div>
          {isDoctor && !isWitnessDone ? (
            <p className="mt-4 flex gap-2 border border-neutral-300 bg-white p-3 text-xs font-semibold leading-5 text-neutral-700">
              <FaTriangleExclamation className="mt-0.5 h-4 w-4 shrink-0 text-black" />
              Witness signature is still pending. The physician can review the consent here, but the witness section must also be completed.
            </p>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

export default function ProcedureConsentRegister() {
  const { accessToken, role, profile } = useRole();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [selectedConsentId, setSelectedConsentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const isDoctor = role === "DOCTOR";
  const printedName = profile?.full_name ?? "";
  const selectedConsent =
    consents.find((consent) => consent.id === selectedConsentId)
    ?? consents[0]
    ?? null;

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/v2/procedure-consents", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({})) as { consents?: Consent[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Unable to load procedure consents.");
        if (active) {
          const nextConsents = payload.consents ?? [];
          setConsents(nextConsents);
          setSelectedConsentId((current) => current && nextConsents.some((consent) => consent.id === current) ? current : nextConsents[0]?.id ?? null);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load procedure consents.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function sign(consent: Consent, signature: string) {
    if (!accessToken) return;
    setSavingId(consent.id);
    setError(null);
    try {
      const response = await fetch(`/api/v2/procedure-consents/${consent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ signature }),
      });
      const payload = await response.json().catch(() => ({})) as { consent?: Consent; message?: string };
      if (!response.ok || !payload.consent) throw new Error(payload.message ?? "Unable to save signature.");
      setConsents((current) => current.map((item) => item.id === consent.id ? payload.consent! : item));
      setSelectedConsentId(consent.id);
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : "Unable to save signature.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <section className="rounded-lg border border-neutral-300 bg-white p-5 shadow-sm">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-neutral-600">Clinic Documents</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-black">Procedure Consent Register</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Select one patient consent from the queue, review the full document, then complete the witness or physician signature section.</p>
          </div>
          <span className="inline-flex w-max items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-neutral-700">
            <FaFileSignature className="h-3.5 w-3.5" />
            {consents.length} record{consents.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}

      {consents.length ? (
        <div className="grid gap-5 lg:grid-cols-[20rem,minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-neutral-300 bg-neutral-50 p-3 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <div>
                <h2 className="text-sm font-black text-black">Consent Queue</h2>
                <p className="mt-1 text-xs font-semibold text-neutral-500">Only the selected form opens.</p>
              </div>
              <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[0.68rem] font-black text-neutral-700">{consents.length}</span>
            </div>
            <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
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

          {selectedConsent ? (
            <ConsentDocument
              key={selectedConsent.id}
              consent={selectedConsent}
              printedName={printedName}
              isDoctor={isDoctor}
              saving={savingId === selectedConsent.id}
              onSign={(signature) => sign(selectedConsent, signature)}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">No procedure consent records are waiting for review.</div>
      )}
    </div>
  );
}
