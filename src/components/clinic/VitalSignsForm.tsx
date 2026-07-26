"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaTemperatureHalf, FaHeartPulse, FaLungs, FaWeightScale, FaRulerVertical, FaDroplet, FaWind, FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { VitalSigns } from "@/src/lib/db/types";

type FormState = {
  bp_systolic: string;
  bp_diastolic: string;
  temperature_c: string;
  pulse_rate: string;
  oxygen_saturation: string;
  respiratory_rate: string;
  weight_kg: string;
  height_cm: string;
  notes: string;
};

const EMPTY: FormState = {
  bp_systolic: "",
  bp_diastolic: "",
  temperature_c: "",
  pulse_rate: "",
  oxygen_saturation: "",
  respiratory_rate: "",
  weight_kg: "",
  height_cm: "",
  notes: "",
};

function fromVitals(v: VitalSigns | null): FormState {
  if (!v) return EMPTY;
  return {
    bp_systolic: v.bp_systolic == null ? "" : String(v.bp_systolic),
    bp_diastolic: v.bp_diastolic == null ? "" : String(v.bp_diastolic),
    temperature_c: v.temperature_c == null ? "" : String(v.temperature_c),
    pulse_rate: v.pulse_rate == null ? "" : String(v.pulse_rate),
    oxygen_saturation: v.oxygen_saturation == null ? "" : String(v.oxygen_saturation),
    respiratory_rate: v.respiratory_rate == null ? "" : String(v.respiratory_rate),
    weight_kg: v.weight_kg == null ? "" : String(v.weight_kg),
    height_cm: v.height_cm == null ? "" : String(v.height_cm),
    notes: v.notes ?? "",
  };
}

function toPayload(s: FormState) {
  // Empty string → null (un-set), non-empty → number for numeric fields.
  // Keeps the API payload tight and lets the secretary save partial vitals.
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    bp_systolic: num(s.bp_systolic),
    bp_diastolic: num(s.bp_diastolic),
    temperature_c: num(s.temperature_c),
    pulse_rate: num(s.pulse_rate),
    oxygen_saturation: num(s.oxygen_saturation),
    respiratory_rate: num(s.respiratory_rate),
    weight_kg: num(s.weight_kg),
    height_cm: num(s.height_cm),
    notes: s.notes.trim() || null,
  };
}

// Standard reference ranges (adult). Used for the colored "in range" hint
// next to each input, NOT for blocking input — emergency readings must be
// recordable.
const REFERENCE = {
  bp_systolic: { min: 90, max: 130, unit: "mmHg" },
  bp_diastolic: { min: 60, max: 85, unit: "mmHg" },
  temperature_c: { min: 36.1, max: 37.5, unit: "°C" },
  pulse_rate: { min: 60, max: 100, unit: "bpm" },
  oxygen_saturation: { min: 95, max: 100, unit: "%" },
  respiratory_rate: { min: 12, max: 20, unit: "/min" },
};

function inRangeBadge(value: string, ref: { min: number; max: number; unit: string }) {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const ok = n >= ref.min && n <= ref.max;
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-700">
      <FaCircleCheck className="h-2.5 w-2.5" aria-hidden="true" /> in range
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-700">
      <FaCircleXmark className="h-2.5 w-2.5" aria-hidden="true" /> out of range
    </span>
  );
}

export type VitalSignsFormProps = {
  appointmentId: string;
  // When true, fields are read-only (used on patient-facing views).
  readOnly?: boolean;
  // Optional onSaved callback so the parent (consultation editor / list) can
  // refresh row state or close a modal.
  onSaved?: (v: VitalSigns) => void;
  // Compact mode tightens spacing for use inside a row / modal.
  compact?: boolean;
};

export function VitalSignsForm({ appointmentId, readOnly, onSaved, compact }: VitalSignsFormProps) {
  const { accessToken, isLoading: authLoading } = useRole();
  const [state, setState] = useState<FormState>(EMPTY);
  const [original, setOriginal] = useState<FormState>(EMPTY);
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!accessToken) {
      setLoading(false);
      return;
    }

    if (fetchedFor.current === appointmentId) {
      setLoading(false);
      return;
    }

    fetchedFor.current = appointmentId;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v2/appointments/${appointmentId}/vitals`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as { vitals: VitalSigns | null };
        if (!active) return;
        const initial = fromVitals(payload.vitals);
        setState(initial);
        setOriginal(initial);
        setRecordedAt(payload.vitals?.updated_at ?? null);
      } catch {
        // Silent — empty form is the right initial state.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [appointmentId, accessToken, authLoading]);

  const dirty = useMemo(
    () => (Object.keys(state) as Array<keyof FormState>).some((k) => state[k] !== original[k]),
    [state, original],
  );

  // BMI auto-calc — kept entirely in the UI; we don't persist it because it's
  // derivable and storing it just creates a drift risk if weight or height
  // is corrected later.
  const bmi = useMemo(() => {
    const w = Number(state.weight_kg);
    const h = Number(state.height_cm);
    if (!w || !h) return null;
    const meters = h / 100;
    return Number((w / (meters * meters)).toFixed(1));
  }, [state.weight_kg, state.height_cm]);

  const bmiLabel = useMemo(() => {
    if (bmi == null) return null;
    if (bmi < 18.5) return { label: "Underweight", tone: "amber" as const };
    if (bmi < 25) return { label: "Normal", tone: "emerald" as const };
    if (bmi < 30) return { label: "Overweight", tone: "amber" as const };
    return { label: "Obese", tone: "red" as const };
  }, [bmi]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((cur) => ({ ...cur, [key]: value }));
    setFeedback(null);
  }

  async function handleSave() {
    if (!accessToken || saving || readOnly) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v2/appointments/${appointmentId}/vitals`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(toPayload(state)),
      });
      const payload = (await res.json().catch(() => ({}))) as { vitals?: VitalSigns; message?: string };
      if (!res.ok || !payload.vitals) {
        throw new Error(payload.message ?? "Failed to save vitals");
      }
      const next = fromVitals(payload.vitals);
      setState(next);
      setOriginal(next);
      setRecordedAt(payload.vitals.updated_at);
      setFeedback({ kind: "ok", msg: "Vitals saved." });
      onSaved?.(payload.vitals);
    } catch (e) {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : "Failed to save vitals" });
    } finally {
      setSaving(false);
    }
  }

  const cellClass = compact ? "p-2.5" : "p-3";
  const inputClass =
    "w-full rounded-lg border border-yellow-100 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  if (loading) {
    return <div className={`rounded-xl border border-yellow-100 bg-white ${cellClass} text-sm text-slate-500`}>Loading vitals…</div>;
  }

  return (
    <div className={`rounded-xl border border-yellow-100 bg-white ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Vital Signs</h3>
        {recordedAt ? (
          <p className="text-[11px] text-slate-500">
            Last updated {new Date(recordedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500">Not yet recorded</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Blood Pressure: two inputs in one cell since systolic/diastolic
            are always recorded together (e.g. 120/80). */}
        <div className={`rounded-lg border border-yellow-100 bg-yellow-50/40 ${cellClass}`}>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            <FaDroplet className="h-3 w-3 text-yellow-500" aria-hidden="true" />
            Blood Pressure (mmHg)
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              placeholder="120"
              value={state.bp_systolic}
              disabled={readOnly}
              onChange={(e) => set("bp_systolic", e.target.value)}
              className={inputClass}
              aria-label="Systolic"
            />
            <span className="text-slate-400 font-bold">/</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={200}
              placeholder="80"
              value={state.bp_diastolic}
              disabled={readOnly}
              onChange={(e) => set("bp_diastolic", e.target.value)}
              className={inputClass}
              aria-label="Diastolic"
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {inRangeBadge(state.bp_systolic, REFERENCE.bp_systolic)}
            {inRangeBadge(state.bp_diastolic, REFERENCE.bp_diastolic)}
          </div>
        </div>

        <Field
          icon={<FaTemperatureHalf className="h-3 w-3 text-amber-300" aria-hidden="true" />}
          label="Temperature"
          unit="°C"
          step="0.1"
          min={25}
          max={45}
          placeholder="36.5"
          value={state.temperature_c}
          readOnly={readOnly}
          onChange={(v) => set("temperature_c", v)}
          rangeBadge={inRangeBadge(state.temperature_c, REFERENCE.temperature_c)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        <Field
          icon={<FaHeartPulse className="h-3 w-3 text-yellow-500" aria-hidden="true" />}
          label="Pulse Rate"
          unit="bpm"
          min={0}
          max={300}
          placeholder="72"
          value={state.pulse_rate}
          readOnly={readOnly}
          onChange={(v) => set("pulse_rate", v)}
          rangeBadge={inRangeBadge(state.pulse_rate, REFERENCE.pulse_rate)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        <Field
          icon={<FaLungs className="h-3 w-3 text-amber-300" aria-hidden="true" />}
          label="Oxygen (SpO2)"
          unit="%"
          min={0}
          max={100}
          placeholder="98"
          value={state.oxygen_saturation}
          readOnly={readOnly}
          onChange={(v) => set("oxygen_saturation", v)}
          rangeBadge={inRangeBadge(state.oxygen_saturation, REFERENCE.oxygen_saturation)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        <Field
          icon={<FaWind className="h-3 w-3 text-amber-300" aria-hidden="true" />}
          label="Respiratory Rate"
          unit="/min"
          min={0}
          max={100}
          placeholder="16"
          value={state.respiratory_rate}
          readOnly={readOnly}
          onChange={(v) => set("respiratory_rate", v)}
          rangeBadge={inRangeBadge(state.respiratory_rate, REFERENCE.respiratory_rate)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        <Field
          icon={<FaWeightScale className="h-3 w-3 text-amber-400" aria-hidden="true" />}
          label="Weight"
          unit="kg"
          step="0.1"
          min={0}
          max={600}
          placeholder="65.0"
          value={state.weight_kg}
          readOnly={readOnly}
          onChange={(v) => set("weight_kg", v)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        <Field
          icon={<FaRulerVertical className="h-3 w-3 text-amber-400" aria-hidden="true" />}
          label="Height"
          unit="cm"
          step="0.1"
          min={0}
          max={300}
          placeholder="165"
          value={state.height_cm}
          readOnly={readOnly}
          onChange={(v) => set("height_cm", v)}
          cellClass={cellClass}
          inputClass={inputClass}
        />

        {/* BMI is derived; show as a non-editable stat tile. */}
        <div className={`rounded-lg border border-yellow-100 bg-yellow-50/40 ${cellClass}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">BMI (auto)</p>
          {bmi != null ? (
            <>
              <p className="mt-1.5 text-lg font-bold text-slate-900">
                {bmi}
                <span className="ml-1 text-xs font-medium text-slate-500">kg/m²</span>
              </p>
              {bmiLabel ? (
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    bmiLabel.tone === "emerald"
                      ? "bg-yellow-100 text-yellow-700"
                      : bmiLabel.tone === "amber"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {bmiLabel.label}
                </span>
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500">Enter weight and height</p>
          )}
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          Other observations
        </label>
        <textarea
          value={state.notes}
          disabled={readOnly}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="e.g., patient looks pale, edema on lower legs"
          className="mt-1.5 w-full rounded-lg border border-yellow-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>

      {feedback ? (
        <p className={`text-xs font-semibold ${feedback.kind === "ok" ? "text-yellow-700" : "text-yellow-700"}`}>
          {feedback.msg}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-yellow-100 pt-2">
          {dirty ? (
            <span className="text-[11px] font-semibold text-yellow-700">Unsaved changes</span>
          ) : recordedAt ? (
            <span className="text-[11px] text-slate-500">All changes saved</span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-full bg-yellow-400 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Vitals"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Single-input cell with icon, label, unit, and optional in-range badge.
// Extracted to keep the main JSX readable — every numeric field follows
// this same layout.
function Field({
  icon,
  label,
  unit,
  value,
  onChange,
  readOnly,
  placeholder,
  min,
  max,
  step,
  rangeBadge,
  cellClass,
  inputClass,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
  rangeBadge?: React.ReactNode;
  cellClass: string;
  inputClass: string;
}) {
  return (
    <div className={`rounded-lg border border-yellow-100 bg-yellow-50/40 ${cellClass}`}>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {icon}
        {label} <span className="font-normal text-slate-400">({unit})</span>
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 ${inputClass}`}
      />
      {rangeBadge ? <div className="mt-1">{rangeBadge}</div> : null}
    </div>
  );
}
