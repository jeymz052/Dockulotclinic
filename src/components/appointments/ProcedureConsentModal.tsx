"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FaArrowLeft, FaArrowRight, FaCheck, FaXmark } from "react-icons/fa6";
import { type AftercareGuide } from "@/src/lib/healthcare-content";

type ProcedureConsentModalProps = {
  procedureName: string;
  patientName: string;
  aftercareGuide: AftercareGuide | null;
  initialSignatureDataUrl?: string;
  initialSignatureName?: string;
  initialConsentAccepted?: boolean;
  initialAftercareAcknowledged?: boolean;
  onClose: () => void;
  onComplete: (result: {
    signatureDataUrl: string;
    signatureName: string;
    consentAccepted: boolean;
    aftercareAcknowledged: boolean;
  }) => void;
};

type ConsentTab = "consent" | "aftercare";

const PROCEDURE_OPTIONS = [
  "Botox",
  "Fillers",
  "Mesotherapy",
  "Sclerotherapy",
  "GLP Initiation",
  "Other procedure",
];

const CONSENT_POINTS = [
  "I confirm that all procedure/s to be done on me has been fully explained to me in a language that I understand, including the nature and purpose, expected benefits, possible risks, side effects, complications and possible alternatives, including doing nothing.",
  "I understand the intended outcome and that results may vary from person to person. No guarantees or promises have been made to me regarding specific results.",
  "I understand that while every effort will be made to ensure safety and the best possible care, no medical procedure is 100% risk-free.",
  "I am aware that the clinic and the attending physician, Doc Kulot, do not take responsibility for any uneventful incident, complication, or dissatisfaction that may occur despite proper care.",
  "I have been given the opportunity to ask questions. All procedures, benefits, risks, possible side effects, alternatives, and expected outcomes were explained to me.",
  "I am signing this consent form of my own free will.",
];

function formatToday() {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function procedureMatchesOption(procedureName: string, option: string): boolean {
  const normalizedProcedure = procedureName.toLowerCase();
  const normalizedOption = option.toLowerCase();
  if (normalizedOption === "mesotherapy") return normalizedProcedure.includes("mesolipo") || normalizedProcedure.includes("mesotherapy");
  if (normalizedOption === "other procedure") return !PROCEDURE_OPTIONS.slice(0, -1).some((item) => procedureMatchesOption(procedureName, item));
  return normalizedProcedure.includes(normalizedOption.split(" ")[0]);
}

function AftercareSection({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-3">
      <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-neutral-950">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-[0.76rem] leading-5 text-neutral-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b89a4d]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProcedureConsentModal({
  procedureName,
  patientName,
  aftercareGuide,
  initialSignatureDataUrl = "",
  initialSignatureName = "",
  initialConsentAccepted = false,
  initialAftercareAcknowledged = false,
  onClose,
  onComplete,
}: ProcedureConsentModalProps) {
  const initialHasSignature = initialSignatureDataUrl.startsWith("data:image/png;base64,");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureHistoryRef = useRef<string[]>(initialHasSignature ? [initialSignatureDataUrl] : []);
  const signatureHistoryIndexRef = useRef(initialHasSignature ? 0 : -1);
  const [activeTab, setActiveTab] = useState<ConsentTab>("consent");
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(initialHasSignature);
  const [signatureHistoryIndex, setSignatureHistoryIndex] = useState(initialHasSignature ? 0 : -1);
  const [signatureHistoryLength, setSignatureHistoryLength] = useState(initialHasSignature ? 1 : 0);
  const [signatureName, setSignatureName] = useState(initialSignatureName || patientName);
  const [consentAccepted, setConsentAccepted] = useState(initialConsentAccepted);
  const [aftercareAcknowledged, setAftercareAcknowledged] = useState(initialAftercareAcknowledged);
  const todayLabel = useMemo(() => formatToday(), []);
  const canUndoSignature = signatureHistoryIndex >= 0;
  const canRedoSignature = signatureHistoryIndex < signatureHistoryLength - 1;

  function prepareCanvas(canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(bounds.width * ratio));
    const nextHeight = Math.max(1, Math.round(bounds.height * ratio));
    const previousImage = canvas.width && canvas.height ? canvas.toDataURL("image/png") : "";
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      if (previousImage) {
        const image = new Image();
        image.onload = () => {
          const context = canvas.getContext("2d");
          context?.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = previousImage;
      }
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.lineWidth = 2.5 * ratio;
  }

  function syncSignatureHistory(history: string[], index: number) {
    signatureHistoryRef.current = history;
    signatureHistoryIndexRef.current = index;
    setSignatureHistoryLength(history.length);
    setSignatureHistoryIndex(index);
    setHasSignature(index >= 0);
  }

  function restoreSignatureSnapshot(snapshot?: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    if (!snapshot) return;

    const image = new Image();
    image.onload = () => {
      const nextContext = canvas.getContext("2d");
      nextContext?.clearRect(0, 0, canvas.width, canvas.height);
      nextContext?.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
  }

  function recordSignatureSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nextSnapshot = canvas.toDataURL("image/png");
    const nextHistory = signatureHistoryRef.current.slice(0, signatureHistoryIndexRef.current + 1);
    nextHistory.push(nextSnapshot);
    syncSignatureHistory(nextHistory, nextHistory.length - 1);
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
    if (!canvas) return;
    prepareCanvas(canvas);
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
    if (!isSigning) return;
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
    if (isSigning) recordSignatureSnapshot();
    setIsSigning(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    syncSignatureHistory([], -1);
  }

  function undoSignature() {
    if (!canUndoSignature) return;
    const nextIndex = signatureHistoryIndexRef.current - 1;
    signatureHistoryIndexRef.current = nextIndex;
    setSignatureHistoryIndex(nextIndex);
    setHasSignature(nextIndex >= 0);
    restoreSignatureSnapshot(signatureHistoryRef.current[nextIndex]);
  }

  function redoSignature() {
    if (!canRedoSignature) return;
    const nextIndex = signatureHistoryIndexRef.current + 1;
    signatureHistoryIndexRef.current = nextIndex;
    setSignatureHistoryIndex(nextIndex);
    setHasSignature(true);
    restoreSignatureSnapshot(signatureHistoryRef.current[nextIndex]);
  }

  function saveConsent() {
    const signatureDataUrl =
      signatureHistoryRef.current[signatureHistoryIndexRef.current]
      ?? canvasRef.current?.toDataURL("image/png")
      ?? "";
    onComplete({
      signatureDataUrl,
      signatureName: signatureName.trim(),
      consentAccepted: true,
      aftercareAcknowledged: true,
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareCanvas(canvas);
    if (initialHasSignature) {
      restoreSignatureSnapshot(initialSignatureDataUrl);
    }
  }, [initialHasSignature, initialSignatureDataUrl]);

  const canSave = hasSignature && signatureName.trim().length > 0 && consentAccepted && aftercareAcknowledged && Boolean(aftercareGuide);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-3 py-4">
      <div className="flex max-h-[92vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/15">
        <header className="border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-[#9f832e]">Informed Procedure Consent</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-black">Consent for {procedureName}</h2>
              <p className="mt-1 text-sm leading-5 text-neutral-600">Review the consent first, then open the procedure-specific aftercare tab before saving.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close consent form" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-800 shadow-sm transition hover:border-[#b89a4d] hover:text-black">
              <FaXmark className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-full border border-neutral-300 bg-white p-1 text-xs font-black uppercase tracking-[0.12em] shadow-inner">
            <button type="button" onClick={() => setActiveTab("consent")} className={`rounded-full px-3 py-2 transition ${activeTab === "consent" ? "bg-black text-white ring-1 ring-[#b89a4d]" : "text-neutral-600 hover:bg-neutral-100"}`}>
              Patient Consent
            </button>
            <button type="button" onClick={() => setActiveTab("aftercare")} className={`rounded-full px-3 py-2 transition ${activeTab === "aftercare" ? "bg-black text-white ring-1 ring-[#b89a4d]" : "text-neutral-600 hover:bg-neutral-100"}`}>
              Post Aftercare
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {activeTab === "consent" ? (
            <article className="mx-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="text-center">
                <p className="font-serif text-4xl font-black uppercase tracking-[0.06em] text-black">Patient Consent</p>
                <p className="mt-1 text-[0.68rem] font-black uppercase tracking-[0.2em] text-neutral-700">Informed consent for medical / aesthetic procedure(s)</p>
              </div>

              <section className="mt-4 rounded-lg border border-neutral-300 bg-white p-3">
                <p className="mx-auto -mt-6 w-max rounded-full bg-black px-4 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white ring-1 ring-[#b89a4d]">Procedure(s) to be performed</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[0.72rem] font-semibold text-neutral-700 sm:grid-cols-3">
                  {PROCEDURE_OPTIONS.map((option) => (
                    <span key={option} className="inline-flex items-center gap-1.5">
                      <span className={`grid h-4 w-4 place-items-center rounded-full border text-[0.55rem] ${procedureMatchesOption(procedureName, option) ? "border-black bg-black text-white ring-1 ring-[#b89a4d]" : "border-neutral-300 text-transparent"}`}>
                        <FaCheck className="h-2.5 w-2.5" />
                      </span>
                      {option === "Other procedure" ? `${option}: ${procedureMatchesOption(procedureName, option) ? procedureName : ""}` : option}
                    </span>
                  ))}
                </div>
              </section>

              <p className="mt-4 text-[0.78rem] leading-5 text-neutral-700">I, the undersigned, hereby voluntarily give my consent to undergo the above-stated procedure(s) to be performed by <span className="font-bold text-black">Doc Kulot, Family Medicine Specialist and Aesthetic Medicine</span>.</p>

              <div className="mt-3 space-y-2">
                {CONSENT_POINTS.map((point) => (
                  <div key={point} className="grid grid-cols-[1.25rem,1fr] gap-2 text-[0.74rem] leading-5 text-neutral-700">
                    <span className="mt-0.5 grid h-4 w-4 place-items-center rounded bg-black text-[0.65rem] font-black text-white ring-1 ring-[#b89a4d]">
                      <FaCheck className="h-2.5 w-2.5" />
                    </span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <section className="mt-4 overflow-hidden rounded-lg border border-neutral-300 bg-white">
                <div className="grid sm:grid-cols-2">
                  <div className="border-b border-neutral-200 p-3 sm:border-r">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-black">Patient Signature</h3>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={undoSignature} disabled={!canUndoSignature} aria-label="Undo last signature stroke" title="Undo last stroke" className="grid h-7 w-7 place-items-center rounded-full border border-neutral-300 text-neutral-700 transition hover:border-[#b89a4d] hover:text-black disabled:cursor-not-allowed disabled:opacity-35">
                          <FaArrowLeft className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={redoSignature} disabled={!canRedoSignature} aria-label="Redo signature stroke" title="Redo stroke" className="grid h-7 w-7 place-items-center rounded-full border border-neutral-300 text-neutral-700 transition hover:border-[#b89a4d] hover:text-black disabled:cursor-not-allowed disabled:opacity-35">
                          <FaArrowRight className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={clearSignature} disabled={!hasSignature} className="rounded-full border border-neutral-300 px-3 py-1 text-[0.68rem] font-bold text-neutral-700 transition hover:border-[#b89a4d] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-35">Clear</button>
                      </div>
                    </div>
                    <canvas
                      ref={canvasRef}
                      aria-label="Patient signature pad"
                      onPointerDown={beginSignature}
                      onPointerMove={drawSignature}
                      onPointerUp={endSignature}
                      onPointerCancel={endSignature}
                      onPointerLeave={endSignature}
                      className="mt-2 h-24 w-full touch-none rounded-md border border-dashed border-neutral-400 bg-white"
                    />
                    <label className="mt-2 block text-[0.64rem] font-black uppercase tracking-[0.12em] text-neutral-500">
                      Printed Name
                      <input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} className="mt-1 w-full border-0 border-b border-neutral-300 bg-transparent px-0 py-1 text-sm font-semibold text-black outline-none focus:border-[#b89a4d]" />
                    </label>
                    <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.72rem] font-semibold text-neutral-700">Date: {todayLabel}</p>
                  </div>

                  <div className="border-b border-neutral-200 p-3">
                    <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-black">Witness Signature</h3>
                    <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-dashed border-neutral-400 bg-neutral-50 text-center text-[0.72rem] font-semibold leading-5 text-neutral-500">Clinic secretary / witness signs here from the staff consent register.</div>
                    <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.72rem] text-neutral-500">Printed Name</p>
                    <p className="mt-2 border-b border-neutral-300 pb-1 text-[0.72rem] text-neutral-500">Date</p>
                  </div>

                  <div className="p-3 sm:col-span-2">
                    <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-black">Physician (Doc Kulot) Signature</h3>
                    <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-neutral-400 bg-neutral-50 text-center text-[0.72rem] font-semibold leading-5 text-neutral-500">Doc Kulot signs this section from the doctor consent register.</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <p className="border-b border-neutral-300 pb-1 text-[0.72rem] text-neutral-500">Printed Name</p>
                      <p className="border-b border-neutral-300 pb-1 text-[0.72rem] text-neutral-500">Date</p>
                    </div>
                  </div>
                </div>
              </section>

              <label className="mt-4 flex items-start gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-[0.82rem] font-semibold leading-5 text-neutral-700">
                <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-black" />
                I have read and understood this consent and authorise the selected procedure.
              </label>
            </article>
          ) : (
            <article className="mx-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              {aftercareGuide ? (
                <>
                  <div className="text-center">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#9f832e]">Post Procedure Aftercare</p>
                    <h2 className="mt-1 font-serif text-3xl font-black uppercase tracking-[0.04em] text-black">{aftercareGuide.title}</h2>
                    <p className="mt-2 text-[0.78rem] leading-5 text-neutral-700">{aftercareGuide.summary}</p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <AftercareSection title="What to expect" items={aftercareGuide.expectations} />
                    <AftercareSection title="Skin / wound care" items={aftercareGuide.care} />
                    <AftercareSection title="Do" items={aftercareGuide.dos} />
                    <AftercareSection title="Do not" items={aftercareGuide.donts} />
                    <AftercareSection title="Key reminders" items={aftercareGuide.bullets} />
                    {aftercareGuide.followUp ? <p className="rounded-lg border border-neutral-200 bg-white p-3 text-[0.76rem] leading-5 text-neutral-700"><span className="font-black uppercase tracking-[0.12em] text-black">Follow-up: </span>{aftercareGuide.followUp}</p> : null}
                    {aftercareGuide.alert ? <p className="rounded-[0.85rem] border border-red-200 bg-red-50 p-3 text-[0.76rem] font-semibold leading-5 text-red-800">{aftercareGuide.alert}</p> : null}
                  </div>
                  <label className="mt-4 flex items-start gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-3 text-[0.82rem] font-semibold leading-5 text-neutral-700">
                    <input type="checkbox" checked={aftercareAcknowledged} onChange={(event) => setAftercareAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-black" />
                    I have read and understood the aftercare instructions for {procedureName}.
                  </label>
                </>
              ) : (
                <div className="rounded-[0.85rem] border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">Procedure-specific aftercare is not available for this selected procedure yet.</div>
              )}
            </article>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-neutral-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-neutral-500">{hasSignature ? "Patient signature captured." : "Patient must sign inside the Patient Signature box."}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-bold text-neutral-700 hover:bg-neutral-100">Cancel</button>
            {activeTab === "consent" ? (
              <button type="button" onClick={() => setActiveTab("aftercare")} className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white ring-1 ring-[#b89a4d] transition hover:bg-neutral-800">Next: aftercare</button>
            ) : (
              <button type="button" disabled={!canSave} onClick={saveConsent} className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ring-[#b89a4d] transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:ring-0">Sign & save consent</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
