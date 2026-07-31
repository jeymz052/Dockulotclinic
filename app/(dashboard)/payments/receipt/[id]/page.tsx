"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { FaCircleCheck, FaPenToSquare, FaXmark } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type BillingItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  provider: string | null;
  provider_ref: string | null;
  tendered_amount: number | null;
};

type Patient = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type Doctor = {
  full_name: string;
  specialty: string;
};

type Billing = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  issued_at: string | null;
  created_at: string;
  discount_kind: "None" | "Manual" | "SeniorCitizen" | "PWD";
  discount_id_number: string | null;
  voided_at: string | null;
  void_reason: string | null;
  billing_items: BillingItem[];
  payments: Payment[];
  patient: Patient | null;
  doctor: Doctor | null;
};

type ClinicInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY_CLINIC: ClinicInfo = { name: "", email: "", phone: "", address: "" };

function money(value: number) {
  return `PHP ${Number(value).toFixed(2)}`;
}

/**
 * Generate a CODE-128-ish thin-line barcode pattern from a seed string.
 * Each character contributes one black bar followed by one white gap, both
 * 1-2px wide — that yields a fine-grained, evenly-distributed pattern that
 * reads like a real printed barcode rather than a chunky decorative one.
 */
function buildBarcodePattern(seed: string) {
  const cleaned = seed.replace(/[^A-Za-z0-9]/g, "").padEnd(30, "7");
  const bars: { key: string; width: number; isBlack: boolean }[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    bars.push({ key: `${i}b`, width: (code % 2) + 1, isBlack: true });
    bars.push({ key: `${i}w`, width: ((code >> 2) % 2) + 1, isBlack: false });
  }
  return bars;
}

function Barcode({ value }: { value: string }) {
  const bars = useMemo(() => buildBarcodePattern(value), [value]);
  return (
    <div className="mt-3 flex flex-col items-center">
      <div className="flex h-10 items-stretch overflow-hidden">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className={bar.isBlack ? "bg-black" : "bg-white"}
            style={{ width: `${bar.width}px` }}
          />
        ))}
      </div>
      <p className="mt-1 font-mono text-[9px] tracking-[0.16em] text-slate-700">{value}</p>
    </div>
  );
}

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { accessToken, isLoading: authLoading, role } = useRole();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [clinic, setClinic] = useState<ClinicInfo>(EMPTY_CLINIC);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline clinic-header edit state. Only super_admin / doctor can flip into
  // edit mode; cashier and patient see the read-only header.
  const [isEditingClinic, setIsEditingClinic] = useState(false);
  const [clinicDraft, setClinicDraft] = useState<ClinicInfo>(EMPTY_CLINIC);
  const [clinicFeedback, setClinicFeedback] = useState<string | null>(null);
  const [isSavingClinic, startSavingClinic] = useTransition();

  const canEditClinic = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    (async () => {
      try {
        // Fetch billing + clinic header in parallel — both belong on the
        // receipt and either failing means we can't render a useful page.
        const [billingRes, clinicRes] = await Promise.all([
          fetch(`/api/v2/billings/${id}`, {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`/api/v2/clinic-info`, {
            cache: "no-store",
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (!billingRes.ok) {
          const body = (await billingRes.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Receipt not found");
        }
        const billingPayload = (await billingRes.json()) as { billing: Billing };

        // Clinic header is best-effort: a missing row shouldn't block the
        // receipt — fall back to placeholders.
        const clinicPayload = clinicRes.ok
          ? ((await clinicRes.json()) as { clinic: ClinicInfo })
          : { clinic: EMPTY_CLINIC };

        if (active) {
          setBilling(billingPayload.billing);
          setClinic(clinicPayload.clinic);
          setError(null);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load receipt");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, id]);

  function beginEditClinic() {
    setClinicDraft(clinic);
    setClinicFeedback(null);
    setIsEditingClinic(true);
  }

  function closeEditClinic() {
    setIsEditingClinic(false);
  }

  function saveClinic() {
    if (!accessToken) return;
    startSavingClinic(async () => {
      const res = await fetch(`/api/v2/clinic-info`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: clinicDraft.name,
          address: clinicDraft.address,
          phone: clinicDraft.phone,
          email: clinicDraft.email,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        clinic?: ClinicInfo;
        message?: string;
      };
      if (!res.ok || !body.clinic) {
        setClinicFeedback(body.message ?? "Could not save clinic info.");
        return;
      }
      setClinic(body.clinic);
      setIsEditingClinic(false);
      setClinicFeedback("Clinic header updated.");
    });
  }

  if (loading) {
    return <div className="rounded-2xl border border-yellow-100 bg-white p-6 text-sm text-slate-500">Loading receipt...</div>;
  }

  if (error || !billing) {
    return <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-700">{error ?? "Receipt not found."}</div>;
  }

  const paidPayment = billing.payments.find((payment) => payment.status === "Paid") ?? null;

  const change = paidPayment?.tendered_amount != null
    ? Math.max(0, paidPayment.tendered_amount - paidPayment.amount)
    : null;

  return (
    <div className="space-y-4 pb-8 print:pb-0">
      {/*
        Thermal-printer-friendly print stylesheet. Defaults to 80mm receipt
        rolls (the most common in PH clinics) but `size: 80mm auto` lets the
        user override via their print dialog if they pick A4 / Letter — the
        browser will treat 80mm as a hint and use the chosen paper instead.
        margin: 0 removes the browser's default A4 margins so the receipt
        starts flush at the top and doesn't waste paper.
      */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 80mm !important;
            min-height: auto !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-receipt, .print-receipt * {
            visibility: visible !important;
          }
          .print-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 !important;
            padding: 1.5mm 1.5mm 2mm !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            font-size: 9px !important;
            line-height: 1.3 !important;
          }
        }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Receipt</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Clinic POS Receipt</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/payments/history"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50"
          >
            Back to History
          </Link>
          {canEditClinic && !isEditingClinic ? (
            <button
              type="button"
              onClick={beginEditClinic}
              className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-white px-3 py-2 text-xs font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-50"
            >
              <FaPenToSquare className="h-3 w-3" aria-hidden="true" />
              Edit Clinic Header
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {canEditClinic && isEditingClinic ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 print:hidden">
          <button
            type="button"
            aria-label="Close clinic header editor"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={closeEditClinic}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-yellow-200 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">Edit Clinic Header</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Popup editor for the receipt header</h2>
                <p className="mt-1 text-sm text-slate-500">Update the name, phone, email, and address shown on every receipt.</p>
              </div>
              <button
                type="button"
                onClick={closeEditClinic}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <FaXmark className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clinic name</span>
                <input
                  value={clinicDraft.name}
                  onChange={(e) => setClinicDraft((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Doc Kulot"
                  className="rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-yellow-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clinic phone</span>
                <input
                  value={clinicDraft.phone}
                  onChange={(e) => setClinicDraft((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                  className="rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-yellow-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clinic email</span>
                <input
                  value={clinicDraft.email}
                  onChange={(e) => setClinicDraft((c) => ({ ...c, email: e.target.value }))}
                  placeholder="admin@dockulot.clinic"
                  type="email"
                  className="rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-yellow-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clinic address</span>
                <textarea
                  value={clinicDraft.address}
                  onChange={(e) => setClinicDraft((c) => ({ ...c, address: e.target.value }))}
                  placeholder="123 Medical Avenue, Quezon City"
                  rows={2}
                  className="rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-yellow-200"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditClinic}
                disabled={isSavingClinic}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <FaXmark className="h-3 w-3" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveClinic}
                disabled={isSavingClinic}
                className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                {isSavingClinic ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Changes apply to every receipt and the clinic-wide settings.
            </p>
          </div>
        </div>
      ) : null}

      {clinicFeedback ? (
        <div className="mx-auto max-w-md rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-center text-xs font-semibold text-yellow-700 print:hidden">
          {clinicFeedback}
        </div>
      ) : null}

      {/*
        THE RECEIPT — narrow thermal-printer style, monospace, dotted dividers.
        In print mode we lock width to 76mm (80mm paper minus 2mm margins each
        side), strip the on-screen border/shadow, and add a tiny top padding
        so the very first line doesn't touch the printer's tear-off edge.
      */}
      <div
        className="print-receipt mx-auto w-[260px] max-w-full border border-slate-300 bg-white px-3 py-4 font-mono text-[9px] leading-snug text-slate-900 shadow-sm print:mx-0 print:w-[72mm] print:max-w-none print:border-0 print:px-1.5 print:py-1.5 print:shadow-none"
      >
        {/* Clinic header — centered cap-style heading like a real OR. */}
        <div className="text-center">
          <p className="text-[13px] font-black uppercase tracking-[0.16em] leading-tight">
            {clinic.name || "CLINIC NAME"}
          </p>
          {clinic.address ? (
            <p className="mt-0.5 whitespace-pre-line text-[9px] leading-tight text-slate-700">
              {clinic.address}
            </p>
          ) : null}
          {clinic.phone ? <p className="text-[9px] text-slate-700">{clinic.phone}</p> : null}
          {clinic.email ? <p className="text-[9px] text-slate-700">{clinic.email}</p> : null}
        </div>

        {/* Issued date prominent, like the reference receipt's "14/10/2025 11:55" line. */}
        <p className="mt-2 text-center font-bold tracking-wide">
          {formatThermalDate(billing.issued_at ?? billing.created_at)}
        </p>

        {/* Patient + physician + visit metadata block. */}
        <div className="mt-2 border-t border-dashed border-slate-400 pt-1.5 space-y-0 uppercase">
          <Row label="Patient" value={billing.patient?.full_name ?? "—"} />
          <Row label="Visit #" value={billing.appointment_id?.slice(0, 8).toUpperCase() ?? "—"} />
          {billing.doctor ? (
            <>
              <Row label="Physician" value={`Dr. ${billing.doctor.full_name}`} />
              {billing.doctor.specialty ? (
                <Row label="Dept" value={billing.doctor.specialty} />
              ) : null}
            </>
          ) : null}
          <Row label="Receipt #" value={billing.id.slice(0, 8).toUpperCase()} />
        </div>

        {/* Line items — name on left, amount on right. The server-prepended
            consultation line is already in billing_items, so nothing extra to do. */}
        <div className="mt-2 border-t border-dashed border-slate-400 pt-1.5 space-y-0 uppercase">
          {billing.billing_items.map((item) => (
            <div key={item.id} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 flex-1 truncate">
                {item.description}
                {item.quantity > 1 ? (
                  <span className="ml-1 text-slate-500">×{item.quantity}</span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums">{money(item.line_total)}</span>
            </div>
          ))}
        </div>

        {/* Totals block. */}
        <div className="mt-2 border-t border-dashed border-slate-400 pt-1.5 space-y-0 uppercase">
          <Row label="Subtotal" value={money(billing.subtotal)} />
          <Row
            label={
              billing.discount_kind === "SeniorCitizen"
                ? "SC Discount"
                : billing.discount_kind === "PWD"
                  ? "PWD Discount"
                  : "Discount"
            }
            value={`-${money(billing.discount)}`}
          />
          {billing.discount_id_number ? (
            <Row
              label={billing.discount_kind === "PWD" ? "PWD ID" : "SC ID"}
              value={billing.discount_id_number}
              muted
            />
          ) : null}
          <Row
            label={
              billing.discount_kind === "SeniorCitizen" || billing.discount_kind === "PWD"
                ? "VAT (Exempt)"
                : "Tax / VAT"
            }
            value={money(billing.tax)}
          />
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-dashed border-slate-400 pt-1 text-sm font-black uppercase">
            <span>Total</span>
            <span className="tabular-nums">{money(billing.total)}</span>
          </div>
        </div>

        {/* Payment details — mirrors the reference's CARD/TYPE/ENTRY/TIME/REF/STATUS block. */}
        <div className="mt-2 border-t border-dashed border-slate-400 pt-1.5 space-y-0 uppercase">
          <Row label="Method" value={paidPayment?.method ?? "—"} />
          {paidPayment?.tendered_amount != null ? (
            <>
              <Row label="Tendered" value={money(paidPayment.tendered_amount)} />
              <Row label="Change" value={money(change ?? 0)} />
            </>
          ) : null}
          <Row label="Time" value={formatThermalDate(paidPayment?.paid_at ?? null)} />
          <Row label="Ref" value={paidPayment?.provider_ref ?? "—"} />
          <Row
            label="Status"
            value={
              billing.status === "Void"
                ? "VOIDED"
                : billing.status === "Paid"
                  ? "APPROVED"
                  : billing.status.toUpperCase()
            }
          />
        </div>

        {/* VOIDED stamp — overlays for voided bills. */}
        {billing.status === "Void" ? (
          <div className="mt-3 border-2 border-dashed border-yellow-400 bg-yellow-50/60 px-3 py-2 text-center">
            <p className="text-lg font-black uppercase tracking-[0.32em] text-yellow-700">VOIDED</p>
            {billing.void_reason ? (
              <p className="mt-1 text-[10px] uppercase text-yellow-700">Reason: {billing.void_reason}</p>
            ) : null}
            {billing.voided_at ? (
              <p className="mt-0.5 text-[10px] text-yellow-600">{formatThermalDate(billing.voided_at)}</p>
            ) : null}
          </div>
        ) : null}

        {/* Footer message + barcode. */}
        <p className="mt-3 text-center text-[9px] uppercase leading-tight text-slate-700">
          Please keep this receipt for your medical and financial records.
        </p>

        <Barcode value={billing.id.slice(0, 12).toUpperCase()} />
      </div>
    </div>
  );
}

/**
 * Single label/value row — stretched to full width with the value
 * right-aligned in a tabular numeric font, matching the reference receipt.
 */
function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${muted ? "text-[10px] text-slate-500" : ""}`}>
      <span>{label}:</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Slash-separated date format the reference receipt uses (DD/MM/YYYY HH:MM).
 * We reuse this for issued / paid / voided timestamps so the receipt reads
 * consistently top-to-bottom.
 */
function formatThermalDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

