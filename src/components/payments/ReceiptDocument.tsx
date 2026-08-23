"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  provider_ref: string | null;
  provider?: string | null;
};

type Patient = {
  full_name: string;
};

type Doctor = {
  full_name: string;
};

type Billing = {
  id: string;
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

type ReceiptDocumentProps = {
  billingId: string;
  variant?: "page" | "popup";
  onClose?: () => void;
  paymentSnapshot?: Payment | null;
};

const LOGO_SRC = "/images/dockulotslogonobg.png";

function money(value: number) {
  return `PHP ${Number(value).toFixed(2)}`;
}

function formatThermalDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function resolvePaymentMethod(payment: Payment | null) {
  const method = payment?.method?.trim();
  if (method) return method;

  const provider = payment?.provider?.trim().toLowerCase() ?? "";
  if (!provider) return "Cash";
  if (provider.includes("cash")) return "Cash";
  if (provider.includes("gcash")) return "GCash";
  if (provider.includes("maya")) return "Maya";
  if (provider.includes("qr")) return "QR";
  if (provider.includes("stripe") || provider.includes("card")) return "Card";
  if (provider.includes("bank")) return "Bank Transfer";
  return provider.replace(/_/g, " ");
}

export function ReceiptDocument({
  billingId,
  variant = "page",
  onClose,
  paymentSnapshot = null,
}: ReceiptDocumentProps) {
  const { accessToken, isLoading: authLoading } = useRole();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (authLoading) return;

    if (!accessToken) {
      setError("Sign in to view this receipt.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(`/api/v2/billings/${billingId}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Receipt not found");
        }

        const payload = (await response.json()) as { billing: Billing };
        if (active) {
          setBilling(payload.billing);
          setError(null);
        }
      } catch (fetchError) {
        if (active) {
          setBilling(null);
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load receipt");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, billingId]);

  const fetchedPayment = useMemo(() => {
    if (!billing) return null;
    return billing.payments.find((payment) => payment.status === "Paid")
      ?? billing.payments[0]
      ?? null;
  }, [billing]);
  const displayPayment = paymentSnapshot ?? fetchedPayment;
  const displayMethod = resolvePaymentMethod(displayPayment);
  const displayTime = displayPayment?.paid_at ?? billing?.issued_at ?? billing?.created_at ?? null;
  const displayRef = displayPayment?.provider_ref?.trim()
    || (displayMethod === "Cash"
      ? `CASH-${billing?.id.slice(0, 8).toUpperCase() ?? ""}`
      : billing?.id.slice(0, 8).toUpperCase() ?? "-");
  const displayStatus =
    displayPayment?.status === "Paid"
      ? "PAID"
      : billing?.status === "Void"
        ? "VOIDED"
        : billing?.status === "Paid"
          ? "APPROVED"
          : billing?.status?.toUpperCase() ?? "-";

  const displayTotal = useMemo(() => {
    if (!billing) return 0;
    return Math.max(0, Number(billing.subtotal) - Number(billing.discount) + Number(billing.tax));
  }, [billing]);

  const shellClassName =
    variant === "popup"
      ? "space-y-3 p-3"
      : "space-y-4 pb-8 print:pb-0";
  const receiptClassName =
    variant === "popup"
      ? "mx-auto w-[80mm] max-w-[80mm] border border-slate-300 bg-white px-4 py-4 font-mono text-[11px] leading-6 text-slate-900 shadow-sm print:mx-0 print:w-[80mm] print:max-w-none print:border-0 print:px-3 print:py-3 print:shadow-none"
      : "mx-auto w-full max-w-[360px] border border-slate-300 bg-white px-5 py-5 font-mono text-[11px] leading-6 text-slate-900 shadow-sm print:mx-0 print:w-[80mm] print:max-w-none print:border-0 print:px-3 print:py-3 print:shadow-none";

  return (
    <div className={shellClassName}>
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
          .print-receipt,
          .print-receipt * {
            visibility: visible !important;
          }
          .print-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 3mm 4mm !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            font-size: 10px !important;
            line-height: 1.45 !important;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Receipt</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Clinic POS Receipt</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {variant === "page" ? (
            <Link
              href="/payments/history"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Back to History
            </Link>
          ) : null}
          {variant === "popup" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Close
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-neutral-400 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-500"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 text-sm text-slate-500">
          Loading receipt...
        </div>
      ) : error || !billing ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
          {error ?? "Receipt not found."}
        </div>
      ) : (
        <div className={receiptClassName + " print-receipt"}>
          <div className="border-b border-dashed border-slate-400 pb-3 text-center">
            <Image
              src={LOGO_SRC}
              alt="Doc Kulot logo"
              width={96}
              height={96}
              className="mx-auto h-20 w-20 object-contain"
              priority
            />
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-2 uppercase">
            <Row label="Date" value={formatThermalDate(billing.issued_at ?? billing.created_at)} />
            <Row label="Receipt #" value={billing.id.slice(0, 8).toUpperCase()} />
            <Row label="Patient" value={billing.patient?.full_name ?? "-"} />
            {billing.doctor ? <Row label="Physician" value={`Dr. ${billing.doctor.full_name}`} /> : null}
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-2 uppercase">
            {billing.billing_items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate">
                  {item.description}
                  {item.quantity > 1 ? <span className="ml-1 text-slate-500">x{item.quantity}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums">{money(Number(item.quantity) * Number(item.unit_price))}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-2 uppercase">
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
            <Row
              label={billing.discount_kind === "SeniorCitizen" || billing.discount_kind === "PWD" ? "VAT (Exempt)" : "Tax / VAT"}
              value={money(billing.tax)}
            />
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-dashed border-slate-400 pt-1 text-sm font-black uppercase">
              <span>Total</span>
              <span className="tabular-nums">{money(displayTotal)}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-slate-400 pt-2 uppercase">
            <Row label="Method" value={displayMethod} />
            <Row label="Time" value={formatThermalDate(displayTime)} />
            <Row label="Ref" value={displayRef} />
            <Row label="Status" value={displayStatus} />
          </div>

          <p className="mt-4 text-center text-[10px] uppercase leading-5 tracking-[0.08em] text-slate-700">
            Please keep this receipt for your medical and financial records.
          </p>

          {billing.status === "Void" ? (
            <div className="mt-4 border-2 border-dashed border-neutral-400 bg-neutral-50/60 px-3 py-2 text-center">
              <p className="text-lg font-black uppercase tracking-[0.32em] text-neutral-700">VOIDED</p>
              {billing.void_reason ? (
                <p className="mt-1 text-[10px] uppercase text-neutral-700">Reason: {billing.void_reason}</p>
              ) : null}
              {billing.voided_at ? (
                <p className="mt-0.5 text-[10px] text-neutral-600">{formatThermalDate(billing.voided_at)}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}:</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
