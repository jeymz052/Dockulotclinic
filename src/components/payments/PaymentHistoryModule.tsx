"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

type OnlinePaymentMethod = "GCash" | "QR" | "Card" | "BankTransfer";

type OnlinePaymentRecord = {
  id: string;
  appointment_id: string | null;
  amount: number;
  method: OnlinePaymentMethod;
  status: "Pending" | "Paid" | "Failed";
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

type BillingRecord = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "Draft" | "Issued" | "Paid" | "Void";
  issued_at: string | null;
  created_at: string;
};

type HistoryTab = "online" | "pos";

const HISTORY_PAGE_SIZE = 8;

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PaymentHistoryModule() {
  const { accessToken } = useRole();
  const { appointments } = useAppointments();
  const [payments, setPayments] = useState<OnlinePaymentRecord[]>([]);
  const [billings, setBillings] = useState<BillingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("online");
  const [historyPage, setHistoryPage] = useState(1);
  const [billingLoading, setBillingLoading] = useState(true);

  const onlineAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.type === "Online"),
    [appointments],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadPayments() {
      const url = new URL("/api/v2/payments", window.location.origin);
      onlineAppointments.forEach((appointment) => {
        url.searchParams.append("appointment_id", appointment.id);
      });

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;

      const payload = (await res.json()) as { payments: OnlinePaymentRecord[] };
      if (active) {
        setPayments(payload.payments);
      }
    }

    void loadPayments();
    return () => {
      active = false;
    };
  }, [accessToken, onlineAppointments]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadBillings() {
      try {
        setBillingLoading(true);
        const res = await fetch("/api/v2/billings", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;

        const payload = (await res.json()) as { billings: BillingRecord[] };
        if (active) {
          setBillings(payload.billings);
        }
      } finally {
        if (active) setBillingLoading(false);
      }
    }

    void loadBillings();
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    setHistoryPage(1);
  }, [activeTab]);

  const appointmentById = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments],
  );
  const onlineRows = useMemo(
    () =>
      [...payments]
        .sort((left, right) => `${right.created_at}`.localeCompare(`${left.created_at}`))
        .map((payment) => {
          const appointment = payment.appointment_id ? appointmentById.get(payment.appointment_id) ?? null : null;
          const doctor = appointment ? getDoctorById(appointment.doctorId) : null;
          return {
            id: payment.id,
            patient: appointment?.patientName ?? "Online consultation payment",
            details: appointment
              ? `${doctor?.name ?? "Assigned doctor"} | ${formatDisplayDate(appointment.date)} | ${formatRange(appointment.start, appointment.end)}`
              : doctor?.name ?? "Assigned doctor",
            amount: peso(payment.amount),
            method: formatMethod(payment.method),
            status: payment.status,
            created: formatRecordDate(payment.created_at),
            paidAt: formatRecordDate(payment.paid_at),
          };
        }),
    [appointmentById, payments],
  );
  const posRows = useMemo(
    () =>
      [...billings]
        .sort((left, right) => `${right.created_at}`.localeCompare(`${left.created_at}`))
        .map((billing) => {
          const appointment = billing.appointment_id ? appointmentById.get(billing.appointment_id) ?? null : null;
          return {
            id: billing.id,
            patient: appointment?.patientName ?? `Billing ${billing.id.slice(0, 8).toUpperCase()}`,
            details: appointment
              ? `${formatDisplayDate(appointment.date)} | ${formatRange(appointment.start, appointment.end)}`
              : "Clinic billing record",
            total: peso(Number(billing.total)),
            status: billing.status,
            issued: formatRecordDate(billing.issued_at ?? billing.created_at),
            receiptHref: `/payments/receipt/${billing.id}`,
          };
        }),
    [appointmentById, billings],
  );

  const currentRows = activeTab === "online" ? onlineRows : posRows;
  const totalPages = Math.max(1, Math.ceil(currentRows.length / HISTORY_PAGE_SIZE));
  const paginatedRows = currentRows.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  return (
    <section className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Payment History</p>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">History</h1>
        </div>

        <div className="inline-flex rounded-full border border-neutral-100 bg-neutral-50/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("online")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "online"
                ? "bg-[linear-gradient(135deg,#67490c,#855d0c)] text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-700"
            }`}
          >
            Online Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "pos"
                ? "bg-[linear-gradient(135deg,#67490c,#855d0c)] text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-700"
            }`}
          >
            Clinic POS
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-neutral-100">
        {activeTab === "online" ? (
          <HistoryTable
            columns={["Patient", "Details", "Amount", "Method", "Status", "Created", "Paid At"]}
            loading={false}
            emptyLabel="No online payment records yet."
            rows={paginatedRows.map((row) => {
              const payment = row as (typeof onlineRows)[number];
              return [
                payment.patient,
                payment.details,
                payment.amount,
                payment.method,
                <StatusPill key={`${payment.id}-status`} tone={payment.status}>{payment.status}</StatusPill>,
                payment.created,
                payment.paidAt,
              ];
            })}
          />
        ) : (
          <HistoryTable
            columns={["Patient", "Details", "Total", "Status", "Issued", "Receipt"]}
            loading={billingLoading}
            emptyLabel="No POS billing records yet."
            rows={paginatedRows.map((row) => {
              const billing = row as (typeof posRows)[number];
              return [
                billing.patient,
                billing.details,
                billing.total,
                <StatusPill key={`${billing.id}-status`} tone={billing.status === "Void" ? "Failed" : billing.status === "Paid" ? "Paid" : "Pending"}>
                  {billing.status}
                </StatusPill>,
                billing.issued,
                <Link key={`${billing.id}-receipt`} href={billing.receiptHref} className="font-semibold text-neutral-700 hover:text-neutral-700">
                  Open receipt
                </Link>,
              ];
            })}
          />
        )}
      </div>

      <Pagination
        page={historyPage}
        totalPages={totalPages}
        onPrevious={() => setHistoryPage((current) => Math.max(1, current - 1))}
        onNext={() => setHistoryPage((current) => Math.min(totalPages, current + 1))}
      />
    </section>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "Pending" | "Paid" | "Failed";
  children: string;
}) {
  const classes =
    tone === "Paid"
      ? "bg-neutral-50 text-neutral-700"
      : tone === "Failed"
        ? "bg-neutral-50 text-neutral-700"
        : "bg-neutral-50 text-neutral-700";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}

function HistoryTable({
  columns,
  rows,
  emptyLabel,
  loading,
}: {
  columns: string[];
  rows: Array<Array<string | React.ReactNode>>;
  emptyLabel: string;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-32 animate-pulse bg-neutral-100" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-100 text-sm">
        <thead className="bg-neutral-50/70">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50 bg-white">
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-4 text-neutral-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-neutral-500">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="text-sm text-neutral-500">
        Page {page} of {totalPages}
      </p>
        <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page <= 1}
          className="rounded-full border border-neutral-100 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-full border border-neutral-100 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function formatRecordDate(value: string | null) {
  if (!value) return "Not yet";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMethod(method?: OnlinePaymentMethod) {
  if (method === "GCash") return "GCash / QR";
  if (method === "QR") return "QR Payment";
  if (method === "BankTransfer") return "Bank Transfer";
  if (method === "Card") return "Card Payment";
  return "No payment yet";
}
