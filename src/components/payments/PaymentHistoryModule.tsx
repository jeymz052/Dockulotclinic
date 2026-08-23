"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaArrowRight,
  FaClockRotateLeft,
  FaMagnifyingGlass,
  FaReceipt,
  FaRotateRight,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

type OnlinePaymentMethod = "Cash" | "GCash" | "QR" | "Card" | "BankTransfer";
type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";
type BillingStatus = "Draft" | "Issued" | "Paid" | "Void";
type HistoryTab = "all" | "online" | "pos";
type HistoryStatusFilter = "all" | "paid" | "pending" | "failed";

type PaymentAppointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type: "Clinic" | "Online";
  status: string;
};

type OnlinePaymentRecord = {
  id: string;
  appointment_id: string | null;
  billing_id: string | null;
  amount: number;
  method: OnlinePaymentMethod;
  status: PaymentStatus;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  paid_at: string | null;
  appointment?: PaymentAppointment | null;
};

type BillingRecord = {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: BillingStatus;
  issued_at: string | null;
  created_at: string;
};

type PatientProfile = {
  id: string;
  email: string | null;
  full_name: string;
};

type HistoryRow = {
  id: string;
  kind: "online" | "pos";
  patient: string;
  detail: string;
  amount: number;
  method: string;
  status: "Pending" | "Paid" | "Failed";
  statusLabel: string;
  dateLabel: string;
  timestamp: number;
  reference: string;
  receiptHref?: string;
};

const HISTORY_PAGE_SIZE = 10;

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRecordDate(value: string | null) {
  if (!value) return "Not yet";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMethod(method?: OnlinePaymentMethod) {
  if (method === "Cash") return "Cash";
  if (method === "GCash") return "GCash / QR";
  if (method === "QR") return "QR Ph";
  if (method === "BankTransfer") return "Bank Transfer";
  if (method === "Card") return "Card";
  return "Payment";
}

function statusFromBilling(status: BillingStatus): HistoryRow["status"] {
  if (status === "Paid") return "Paid";
  if (status === "Void") return "Failed";
  return "Pending";
}

function normalizePaymentStatus(status: PaymentStatus): HistoryRow["status"] {
  if (status === "Paid") return "Paid";
  if (status === "Failed" || status === "Refunded") return "Failed";
  return "Pending";
}

function shortRef(value: string | null | undefined, fallback: string) {
  const cleanValue = value?.trim();
  if (cleanValue) return cleanValue.length > 18 ? `${cleanValue.slice(0, 18)}...` : cleanValue;
  return fallback;
}

function timeValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function openReceiptPopup(href: string) {
  if (typeof window === "undefined") return;
  const popup = window.open(href, "receipt-popup", "popup=yes,width=540,height=760");
  popup?.focus();
}

export function PaymentHistoryModule() {
  const { accessToken, profile, role } = useRole();
  const { appointments, error: appointmentError } = useAppointments();
  const [payments, setPayments] = useState<OnlinePaymentRecord[]>([]);
  const [billings, setBillings] = useState<BillingRecord[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [patientLoading, setPatientLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canSeeAllPatients = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const isLoading = paymentLoading || billingLoading || patientLoading;

  const appointmentById = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments],
  );

  const patientById = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach((patient) => {
      map.set(patient.id, patient.full_name || patient.email || `Patient ${patient.id.slice(0, 8)}`);
    });
    if (profile?.id) {
      map.set(profile.id, profile.full_name || profile.email || "My account");
    }
    appointments.forEach((appointment) => {
      // AppointmentRecord does not expose patient_id, but it carries the
      // display name for records loaded through /api/appointments.
      map.set(appointment.email.toLowerCase(), appointment.patientName);
    });
    return map;
  }, [appointments, patients, profile]);

  const resolvePatientName = useCallback((patientId: string | null | undefined, fallback?: string | null) => {
    if (fallback?.trim()) return fallback.trim();
    if (!patientId) return canSeeAllPatients ? "Patient record" : "My record";
    return patientById.get(patientId) ?? `Patient ${patientId.slice(0, 8).toUpperCase()}`;
  }, [canSeeAllPatients, patientById]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadPayments() {
      try {
        setPaymentLoading(true);
        const res = await fetch("/api/v2/payments", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = (await res.json().catch(() => ({}))) as {
          payments?: OnlinePaymentRecord[];
          message?: string;
        };
        if (!res.ok) throw new Error(payload.message ?? "Failed to load online payments.");
        if (active) {
          setPayments(payload.payments ?? []);
          setLoadError(null);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Failed to load payment history.");
        }
      } finally {
        if (active) setPaymentLoading(false);
      }
    }

    void loadPayments();
    return () => {
      active = false;
    };
  }, [accessToken]);

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
        const payload = (await res.json().catch(() => ({}))) as {
          billings?: BillingRecord[];
          message?: string;
        };
        if (!res.ok) throw new Error(payload.message ?? "Failed to load POS billings.");
        if (active) {
          setBillings(payload.billings ?? []);
          setLoadError(null);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Failed to load billing history.");
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
    if (!accessToken || !canSeeAllPatients) return;
    let active = true;

    async function loadPatients() {
      try {
        setPatientLoading(true);
        const res = await fetch("/api/v2/users?role=patient&active=true", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { users?: PatientProfile[] };
        if (active) setPatients(payload.users ?? []);
      } finally {
        if (active) setPatientLoading(false);
      }
    }

    void loadPatients();
    return () => {
      active = false;
    };
  }, [accessToken, canSeeAllPatients]);

  useEffect(() => {
    setHistoryPage(1);
  }, [activeTab, query, statusFilter]);

  const rows = useMemo<HistoryRow[]>(() => {
    const onlineRows = payments.map((payment) => {
      const localAppointment = payment.appointment_id ? appointmentById.get(payment.appointment_id) ?? null : null;
      const dbAppointment = payment.appointment ?? null;
      const doctorId = localAppointment?.doctorId ?? dbAppointment?.doctor_id ?? "";
      const doctor = doctorId ? getDoctorById(doctorId) : null;
      const appointmentDate = localAppointment?.date ?? dbAppointment?.appointment_date ?? "";
      const appointmentStart = localAppointment?.start ?? dbAppointment?.start_time ?? "";
      const appointmentEnd = localAppointment?.end ?? dbAppointment?.end_time ?? "";
      const scheduleLabel = appointmentDate && appointmentStart && appointmentEnd
        ? `${formatDisplayDate(appointmentDate)} | ${formatRange(appointmentStart, appointmentEnd)}`
        : "Online reservation";
      const status = normalizePaymentStatus(payment.status);

      return {
        id: payment.id,
        kind: "online",
        patient: resolvePatientName(dbAppointment?.patient_id, localAppointment?.patientName),
        detail: `${doctor?.name ?? "Online consultation"} | ${scheduleLabel}`,
        amount: Number(payment.amount),
        method: formatMethod(payment.method),
        status,
        statusLabel: payment.status,
        dateLabel: formatRecordDate(payment.paid_at ?? payment.created_at),
        timestamp: timeValue(payment.paid_at ?? payment.created_at),
        reference: shortRef(payment.provider_ref, payment.id.slice(0, 8).toUpperCase()),
      } satisfies HistoryRow;
    });

    const posRows = billings.map((billing) => {
      const appointment = billing.appointment_id ? appointmentById.get(billing.appointment_id) ?? null : null;
      const detail = appointment
        ? `${formatDisplayDate(appointment.date)} | ${formatRange(appointment.start, appointment.end)}`
        : "Clinic billing record";

      return {
        id: billing.id,
        kind: "pos",
        patient: resolvePatientName(billing.patient_id, appointment?.patientName),
        detail,
        amount: Number(billing.total),
        method: "Clinic POS",
        status: statusFromBilling(billing.status),
        statusLabel: billing.status,
        dateLabel: formatRecordDate(billing.issued_at ?? billing.created_at),
        timestamp: timeValue(billing.issued_at ?? billing.created_at),
        reference: billing.id.slice(0, 8).toUpperCase(),
        receiptHref: `/payments/receipt/${billing.id}`,
      } satisfies HistoryRow;
    });

    return [...onlineRows, ...posRows].sort((left, right) => right.timestamp - left.timestamp);
  }, [appointmentById, billings, payments, resolvePatientName]);

  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTab = activeTab === "all" || row.kind === activeTab;
      const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter;
      const matchesQuery =
        !cleanQuery
        || [row.patient, row.detail, row.method, row.reference, row.statusLabel]
          .some((value) => value.toLowerCase().includes(cleanQuery));

      return matchesTab && matchesStatus && matchesQuery;
    });
  }, [activeTab, query, rows, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / HISTORY_PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );

  return (
    <div className="space-y-5 pb-8">
      <section className="border-b border-neutral-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Payment History</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950">Payment History</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {canSeeAllPatients
                ? "All patient payment records are listed here across online payments and clinic POS billings."
                : "Your online and clinic payment records are listed here."}
            </p>
          </div>

          {canSeeAllPatients ? (
            <Link
              href="/payments/pos"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
            >
              <FaReceipt className="h-4 w-4" aria-hidden="true" />
              POS Billing
            </Link>
          ) : null}
        </div>
      </section>

      {loadError || appointmentError ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError ?? appointmentError}
        </div>
      ) : null}

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="relative">
              <FaMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={canSeeAllPatients ? "Search patient, reference, method..." : "Search your payment history..."}
                className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-100"
              />
            </div>

            <div className="inline-grid grid-cols-3 rounded-md border border-neutral-200 bg-neutral-50 p-1">
              <FilterButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
                All
              </FilterButton>
              <FilterButton active={activeTab === "online"} onClick={() => setActiveTab("online")}>
                Online
              </FilterButton>
              <FilterButton active={activeTab === "pos"} onClick={() => setActiveTab("pos")}>
                POS
              </FilterButton>
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
              className="h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed / Void</option>
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {["Patient", "Payment", "Amount", "Status", "Date", "Reference", ""].map((column) => (
                  <th key={column} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              <HistoryRows rows={paginatedRows} loading={isLoading} />
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-neutral-100 lg:hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : paginatedRows.length > 0 ? (
            paginatedRows.map((row) => <MobileHistoryRow key={`${row.kind}-${row.id}`} row={row} />)
          ) : (
            <EmptyPanel />
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            Showing {filteredRows.length === 0 ? 0 : (historyPage - 1) * HISTORY_PAGE_SIZE + 1}
            {" - "}
            {Math.min(historyPage * HISTORY_PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </p>
          <Pagination
            page={historyPage}
            totalPages={totalPages}
            onPrevious={() => setHistoryPage((current) => Math.max(1, current - 1))}
            onNext={() => setHistoryPage((current) => Math.min(totalPages, current + 1))}
          />
        </div>
      </section>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function HistoryRows({ rows, loading }: { rows: HistoryRow[]; loading: boolean }) {
  if (loading) {
    return (
      <tr>
        <td colSpan={7}>
          <LoadingPanel />
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7}>
          <EmptyPanel />
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <tr key={`${row.kind}-${row.id}`} className="align-top transition hover:bg-neutral-50/70">
          <td className="px-4 py-4">
            <p className="font-semibold text-neutral-950">{row.patient}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
              {row.kind === "online" ? "Online" : "Clinic POS"}
            </p>
          </td>
          <td className="max-w-md px-4 py-4">
            <p className="font-medium text-neutral-800">{row.method}</p>
            <p className="mt-1 text-sm leading-5 text-neutral-500">{row.detail}</p>
          </td>
          <td className="px-4 py-4 font-mono font-bold text-neutral-950">{peso(row.amount)}</td>
          <td className="px-4 py-4">
            <StatusPill tone={row.status}>{row.statusLabel}</StatusPill>
          </td>
          <td className="px-4 py-4 text-neutral-600">{row.dateLabel}</td>
          <td className="px-4 py-4 font-mono text-xs font-semibold text-neutral-500">{row.reference}</td>
          <td className="px-4 py-4 text-right">
            {row.receiptHref ? (
              <button
                type="button"
                onClick={() => openReceiptPopup(row.receiptHref!)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
              >
                Receipt
                <FaArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </td>
        </tr>
      ))}
    </>
  );
}

function MobileHistoryRow({ row }: { row: HistoryRow }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-neutral-950">{row.patient}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">
            {row.kind === "online" ? "Online" : "Clinic POS"}
          </p>
        </div>
        <StatusPill tone={row.status}>{row.statusLabel}</StatusPill>
      </div>
      <div className="mt-3 space-y-2 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">{row.method}</p>
        <p>{row.detail}</p>
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
          <span className="font-mono text-base font-bold text-neutral-950">{peso(row.amount)}</span>
          <span>{row.dateLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-semibold text-neutral-500">{row.reference}</span>
          {row.receiptHref ? (
            <button type="button" onClick={() => openReceiptPopup(row.receiptHref!)} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-800">
              Receipt <FaArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: HistoryRow["status"];
  children: string;
}) {
  const classes =
    tone === "Paid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "Failed"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>
      {children}
    </span>
  );
}

function LoadingPanel() {
  return (
    <div className="flex min-h-44 items-center justify-center p-6">
      <div className="flex items-center gap-3 text-sm font-semibold text-neutral-500">
        <FaRotateRight className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading payment history...
      </div>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <FaClockRotateLeft className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 font-semibold text-neutral-900">No payment records found</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
        Try another status, tab, or search term.
      </p>
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <span className="rounded-md bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-600">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
