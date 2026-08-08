"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PH");
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
    context.strokeStyle = "#111827";
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
      <div className="rounded-[0.85rem] border border-[#d9af72] bg-white p-3">
        <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#9a5f19]">{label}</h3>
        <img src={completedSignature} alt={`${label} signature`} className="mt-2 h-20 w-full rounded-md border border-[#ead6b6] object-contain object-left" />
        <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Printed Name: {completedName}</p>
        <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Date: {formatDate(completedAt)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[0.85rem] border border-[#d9af72] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#9a5f19]">{label}</h3>
          <p className="mt-1 text-[0.72rem] font-semibold leading-5 text-slate-500">{helper}</p>
        </div>
        <button type="button" onClick={clearSignature} disabled={disabled || !hasSignature} className="rounded-full border border-slate-300 px-3 py-1 text-[0.68rem] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label={`${label} pad`}
        onPointerDown={beginSignature}
        onPointerMove={drawSignature}
        onPointerUp={endSignature}
        onPointerCancel={endSignature}
        onPointerLeave={endSignature}
        className="mt-2 h-24 w-full touch-none rounded-md border border-dashed border-[#d7b98d] bg-white"
      />
      <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Printed Name: {printedName || "Signed-in staff"}</p>
      <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Date: {new Date().toLocaleDateString("en-PH")}</p>
      <button type="button" disabled={disabled || saving || !hasSignature} onClick={submitSignature} className="mt-3 w-full rounded-full bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
        {saving ? "Saving..." : `Save ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

export default function ProcedureConsentRegister() {
  const { accessToken, role, profile } = useRole();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const isDoctor = role === "DOCTOR";
  const printedName = profile?.full_name ?? "";

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
        if (active) setConsents(payload.consents ?? []);
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
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : "Unable to save signature.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8">
      <section className="rounded-[1.4rem] border border-[#e5c999] bg-[#fff8ec] p-5 shadow-sm">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#8a3b07]">Clinic Documents</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Procedure Consent Register</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Open each signed patient consent and complete the matching witness or physician section.</p>
      </section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}

      <div className="space-y-4">
        {consents.map((consent) => (
          <article key={consent.id} className="rounded-[1.2rem] border border-[#e5c999] bg-[#fff8ec] p-4 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-[#ead6b6] pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#8a3b07]">{consent.procedure_name}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{consent.patient_name}</h2>
              </div>
              <p className="text-xs font-semibold text-slate-500">Patient signed {formatDate(consent.signed_at)}</p>
            </div>

            {consent.aftercare_guide_title ? <p className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600">Aftercare acknowledged: {consent.aftercare_guide_title}</p> : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-[0.85rem] border border-[#d9af72] bg-white p-3">
                <h3 className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#9a5f19]">Patient Signature</h3>
                <img src={consent.patient_signature} alt={`${consent.patient_name} patient signature`} className="mt-2 h-24 w-full rounded-md border border-[#ead6b6] object-contain object-left" />
                <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Printed Name: {consent.patient_name}</p>
                <p className="mt-2 border-b border-slate-300 pb-1 text-[0.72rem] font-semibold text-slate-700">Date: {formatDate(consent.signed_at)}</p>
              </div>

              <StaffSignaturePad
                label="Witness Signature"
                helper={isDoctor ? "To be completed by the clinic secretary or witness." : "Sign this box as the clinic secretary / witness."}
                printedName={printedName}
                completedName={consent.witness_name}
                completedSignature={consent.witness_signature}
                completedAt={consent.witness_signed_at}
                disabled={isDoctor}
                saving={savingId === consent.id}
                onSubmit={(signature) => sign(consent, signature)}
              />

              <StaffSignaturePad
                label="Physician Signature"
                helper={isDoctor ? "Sign this box as Doc Kulot / attending physician." : "To be completed by Doc Kulot."}
                printedName={printedName}
                completedName={consent.physician_name}
                completedSignature={consent.physician_signature}
                completedAt={consent.physician_signed_at}
                disabled={!isDoctor}
                saving={savingId === consent.id}
                onSubmit={(signature) => sign(consent, signature)}
              />
            </div>
          </article>
        ))}
      </div>

      {!consents.length ? <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">No procedure consent records are waiting for review.</div> : null}
    </div>
  );
}
