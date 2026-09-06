"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaBan,
  FaBuildingColumns,
  FaCircleCheck,
  FaCircleExclamation,
  FaMobileScreen,
  FaMoneyBillWave,
  FaQrcode,
  FaReceipt,
  FaXmark,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { ReceiptDocument } from "@/src/components/payments/ReceiptDocument";
import { formatDisplayDate, formatRange, type AppointmentRecord } from "@/src/lib/appointments";
import { getAppointmentConsultKind, isProcedureServiceTitle, parseAppointmentContext } from "@/src/lib/appointment-context";
import { FOLLOW_UP_CLINIC_CONSULTATION_FEE, NEW_PATIENT_CLINIC_CONSULTATION_FEE } from "@/src/lib/consultation-pricing";

type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";
  price: number;
  is_active: boolean;
};

type Line = {
  tempId: string;
  pricing_id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type DiscountKind = "None" | "Manual" | "SeniorCitizen" | "PWD";

type RecentBilling = {
  id: string;
  appointment_id: string | null;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  status: "Draft" | "Issued" | "Paid" | "Void";
  created_at: string;
  issued_at: string | null;
};

type PaymentSnapshot = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  provider_ref: string | null;
  provider?: string | null;
};

type PaymentAccountKind = "GCash" | "Maya" | "Bank" | "Other";

type ConfiguredPaymentAccount = {
  id: string;
  kind: PaymentAccountKind;
  label: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  qrCodeUrl?: string;
  isActive: boolean;
};

// Maps OnlinePaymentAccountKind to PaymentMethod used by the billing API
const KIND_TO_METHOD: Record<PaymentAccountKind, "GCash" | "QR" | "Card" | "BankTransfer"> = {
  GCash: "GCash",
  Maya: "QR",
  Bank: "BankTransfer",
  Other: "QR",
};

const POS_CATEGORIES = ["Procedure", "Lab", "Medicine", "Other"] as const;
const QUICK_TENDER_AMOUNTS = [100, 200, 500, 1000, 2000, 5000] as const;

function peso(amount: number) {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isPOSCategory(category: PricingItem["category"]): category is (typeof POS_CATEGORIES)[number] {
  return (POS_CATEGORIES as readonly string[]).includes(category);
}

function buildLine(item: PricingItem): Line {
  return {
    tempId: crypto.randomUUID(),
    pricing_id: item.id,
    description: item.name,
    quantity: 1,
    unit_price: Number(item.price),
  };
}

function roundUpToNearest(amount: number, step: number) {
  return Math.ceil(amount / step) * step;
}

function cashShortcuts(total: number) {
  if (total <= 0) return [];
  const candidates = [
    total,
    roundUpToNearest(total, 50),
    roundUpToNearest(total, 100),
    roundUpToNearest(total, 500),
    roundUpToNearest(total, 1000),
    ...QUICK_TENDER_AMOUNTS.filter((amount) => amount >= total),
  ];
  return [...new Set(candidates.map((value) => Math.round(value * 100) / 100))]
    .sort((a, b) => a - b)
    .slice(0, 6);
}

export default function POSBillingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const { appointments } = useAppointments();
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<ConfiguredPaymentAccount[]>([]);
  const [selectedApptId, setSelectedApptId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [discountKind, setDiscountKind] = useState<DiscountKind>("None");
  const [discountIdNumber, setDiscountIdNumber] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("cash"); // "cash" or account.id
  const [tenderedInput, setTenderedInput] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [issuedBillingId, setIssuedBillingId] = useState<string | null>(null);
  const [issuedBillingStatus, setIssuedBillingStatus] = useState<"Issued" | "Paid" | "Void" | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [recentBillings, setRecentBillings] = useState<RecentBilling[]>([]);
  const [billedAppointmentIds, setBilledAppointmentIds] = useState<Set<string>>(() => new Set());
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [receiptBillingId, setReceiptBillingId] = useState<string | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentSnapshot | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [reservationCredit, setReservationCredit] = useState(0);
  const [currentClock, setCurrentClock] = useState(() => formatClock(new Date()));
  const [isWorking, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Derive current payment method info
  const selectedAccount = paymentAccounts.find((a) => a.id === selectedMethodId) ?? null;
  const isCash = selectedMethodId === "cash";
  const activePaymentMethod = isCash ? "Cash" : KIND_TO_METHOD[selectedAccount?.kind ?? "Other"];

  const canUse = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const canVoid = canUse;

  useEffect(() => {
    const interval = setInterval(() => setCurrentClock(formatClock(new Date())), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    (async () => {
      const response = await fetch("/api/v2/pricing", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { pricing: PricingItem[] };
      setPricing(payload.pricing);
    })();
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    (async () => {
      const response = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { data: { onlinePaymentAccounts?: ConfiguredPaymentAccount[] } };
      const accounts = (payload.data?.onlinePaymentAccounts ?? []).filter((a) => a.isActive);
      setPaymentAccounts(accounts);
    })();
  }, [accessToken, authLoading]);

  const refreshRecent = useCallback(async () => {
    if (!accessToken) return;
    const response = await fetch("/api/v2/billings?appointment_type=Clinic", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { billings: RecentBilling[] };
    setRecentBillings(payload.billings.slice(0, 8));

    const billedIds = new Set<string>();
    for (const b of payload.billings) {
      if (b.appointment_id && (b.status === "Paid" || b.status === "Issued")) {
        billedIds.add(b.appointment_id);
      }
    }
    setBilledAppointmentIds(billedIds);
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    const timeout = window.setTimeout(() => {
      void refreshRecent();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [accessToken, authLoading, refreshRecent]);

  const billableAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.type === "Clinic" &&
            (appointment.status === "In Progress" || appointment.status === "Completed") &&
            !billedAppointmentIds.has(appointment.id),
        )
        .sort((a, b) => {
          const timeA = `${a.date} ${a.start}`;
          const timeB = `${b.date} ${b.start}`;
          const diff = timeB.localeCompare(timeA);
          if (diff !== 0) return diff;
          return Number(b.queueNumber || 0) - Number(a.queueNumber || 0);
        }),
    [appointments, billedAppointmentIds],
  );

  const selectedAppt = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedApptId) ?? null,
    [appointments, selectedApptId],
  );
  const selectedContext = selectedAppt ? parseAppointmentContext(selectedAppt.reason) : null;
  const selectedServiceLabel = selectedContext?.service || "Clinic Visit";
  const selectedIsProcedure = isProcedureServiceTitle(selectedContext?.service);
  const selectedConsultKind = selectedAppt ? getAppointmentConsultKind(selectedAppt.reason) : undefined;
  const hasPriorClinicConsultation = selectedAppt
    ? appointments.some((appointment) =>
      appointment.id !== selectedAppt.id
      && appointment.type === "Clinic"
      && appointment.email.trim().toLowerCase() === selectedAppt.email.trim().toLowerCase()
      && `${appointment.date} ${appointment.start}` < `${selectedAppt.date} ${selectedAppt.start}`,
    )
    : false;
  const consultationFee = !selectedAppt
    ? 0
    : selectedConsultKind === "FollowUp" || (!selectedConsultKind && hasPriorClinicConsultation)
      ? FOLLOW_UP_CLINIC_CONSULTATION_FEE
      : NEW_PATIENT_CLINIC_CONSULTATION_FEE;
  const consultationKindLabel = consultationFee === FOLLOW_UP_CLINIC_CONSULTATION_FEE ? "Follow-up" : "First-time";

  const posPricing = useMemo(
    () => pricing.filter((item) => item.is_active && isPOSCategory(item.category)),
    [pricing],
  );
  const filteredPricing = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return posPricing;
    return posPricing.filter((item) => [item.code, item.name, item.category].some((value) => value.toLowerCase().includes(query)));
  }, [catalogQuery, posPricing]);
  const groupedCatalog = useMemo(
    () =>
      POS_CATEGORIES.map((category) => ({
        category,
        items: filteredPricing.filter((item) => item.category === category).sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [filteredPricing],
  );

  const addOnsTotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  const subtotal = Math.max(0, consultationFee + addOnsTotal - reservationCredit);
  const isStatutoryDiscount = discountKind === "SeniorCitizen" || discountKind === "PWD";
  const effectiveDiscount = isStatutoryDiscount ? Math.round(subtotal * 20) / 100 : discount;
  const effectiveTax = isStatutoryDiscount ? 0 : tax;
  const total = Math.max(0, subtotal - effectiveDiscount + effectiveTax);
  const tenderedAmount = Number(tenderedInput || 0);
  const changeDue = Math.max(0, tenderedAmount - total);
  const canAcceptPayment =
    canUse &&
    !!selectedAppt &&
    total > 0 &&
    discount <= subtotal &&
    (!isStatutoryDiscount || !!discountIdNumber.trim()) &&
    issuedBillingStatus !== "Paid" &&
    (isCash ? tenderedAmount >= total : !!providerRef.trim());
  const shortcutAmounts = useMemo(() => cashShortcuts(total), [total]);

  function chooseAppointment(appointment: AppointmentRecord) {
    if (issuedBillingId) return;
    setSelectedApptId(appointment.id);
    setLines([]);
    setDiscount(0);
    setTax(0);
    setDiscountKind("None");
    setDiscountIdNumber("");
    setTenderedInput("");
    setProviderRef("");
    setSelectedMethodId("cash");
    setIssuedBillingStatus(null);
    setFeedback(null);
    setReservationCredit(0);

    if (accessToken) {
      void fetch(`/api/v2/appointments/${appointment.id}/reservation-credit`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.amount) setReservationCredit(Number(data.amount));
        })
        .catch(() => {});
    }
  }

  function addItem(item: PricingItem) {
    if (!selectedAppt || issuedBillingId) return;
    setLines((current) => {
      const existing = current.find((line) => line.pricing_id === item.id);
      if (existing) {
        return current.map((line) => line.tempId === existing.tempId ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, buildLine(item)];
    });
  }

  function updateQty(tempId: string, quantity: number) {
    setLines((current) => current.map((line) => line.tempId === tempId ? { ...line, quantity: Math.max(1, quantity) } : line));
  }

  function updateUnitPrice(tempId: string, unitPrice: number) {
    setLines((current) => current.map((line) => line.tempId === tempId ? { ...line, unit_price: Math.max(0, unitPrice) } : line));
  }

  function updateDescription(tempId: string, description: string) {
    setLines((current) => current.map((line) => line.tempId === tempId ? { ...line, description } : line));
  }

  function removeItem(tempId: string) {
    setLines((current) => current.filter((line) => line.tempId !== tempId));
  }

  function openReceiptModal(billingId: string, paymentSnapshot: PaymentSnapshot | null = null) {
    setReceiptBillingId(billingId);
    setReceiptPayment(paymentSnapshot);
    setReceiptModalOpen(true);
  }

  function closeReceiptModal() {
    setReceiptModalOpen(false);
    setReceiptBillingId(null);
    setReceiptPayment(null);
  }

  function resetSale() {
    setSelectedApptId("");
    setLines([]);
    setDiscount(0);
    setTax(0);
    setDiscountKind("None");
    setDiscountIdNumber("");
    setTenderedInput("");
    setProviderRef("");
    setSelectedMethodId("cash");
    setIssuedBillingId(null);
    setIssuedBillingStatus(null);
    setFeedback(null);
    setReservationCredit(0);
    setConfirmingVoid(false);
    setVoidReason("");
    closeReceiptModal();
  }

  function commitSale() {
    if (!accessToken || !selectedAppt) return;
    if (discount > subtotal) {
      setFeedback({ message: "Discount cannot exceed subtotal.", tone: "error" });
      return;
    }
    if (isStatutoryDiscount && !discountIdNumber.trim()) {
      setFeedback({ message: `${discountKind === "PWD" ? "PWD" : "Senior Citizen"} ID number is required.`, tone: "error" });
      return;
    }
    if (isCash && tenderedAmount < total) {
      setFeedback({ message: `Cash received must be at least ${peso(total)}.`, tone: "error" });
      return;
    }
    if (!isCash && !providerRef.trim()) {
      setFeedback({ message: "Reference number is required for digital payments.", tone: "error" });
      return;
    }

    startTransition(async () => {
      let billingId = issuedBillingId;

      try {
        if (!billingId) {
          const response = await fetch("/api/v2/billings", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              appointment_id: selectedAppt.id,
              discount: isStatutoryDiscount ? 0 : discount,
              tax: isStatutoryDiscount ? 0 : tax,
              discount_kind: discountKind,
              discount_id_number: isStatutoryDiscount ? discountIdNumber.trim() : null,
              items: lines.map((line) => ({
                pricing_id: line.pricing_id,
                product_id: null,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
              })),
            }),
          });
          const body = (await response.json().catch(() => ({}))) as { billing?: { id: string }; message?: string };
          if (!response.ok || !body.billing) {
            throw new Error(body.message ?? "Failed to create the bill.");
          }
          billingId = body.billing.id;
          setIssuedBillingId(billingId);
          setIssuedBillingStatus("Issued");
          setBilledAppointmentIds((prev) => new Set(prev).add(selectedAppt.id));
        }

        const payResponse = await fetch(`/api/v2/billings/${billingId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            method: activePaymentMethod,
            provider_ref: isCash ? null : providerRef.trim(),
            tendered_amount: isCash ? tenderedAmount : null,
          }),
        });
        const payBody = (await payResponse.json().catch(() => ({}))) as { message?: string; payment?: PaymentSnapshot };
        if (!payResponse.ok) {
          throw new Error(payBody.message ?? "Payment failed.");
        }

        setIssuedBillingStatus("Paid");
        const successMsg = isCash && changeDue > 0
          ? `Sale completed. Change due: ${peso(changeDue)}.`
          : "Sale completed.";
        setFeedback({ message: successMsg, tone: "success" });
        void refreshRecent();
        openReceiptModal(billingId, payBody.payment ?? null);
      } catch (error) {
        setFeedback({ message: error instanceof Error ? error.message : "Unable to complete the sale.", tone: "error" });
      }
    });
  }

  function commitVoid() {
    if (!accessToken || !issuedBillingId) return;
    if (voidReason.trim().length < 4) {
      setFeedback({ message: "Provide a void reason.", tone: "error" });
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/v2/billings/${issuedBillingId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setFeedback({ message: body.message ?? "Void failed.", tone: "error" });
        return;
      }
      setIssuedBillingStatus("Void");
      setFeedback({ message: "Bill voided.", tone: "success" });
      setConfirmingVoid(false);
      setVoidReason("");
      if (selectedApptId) {
        setBilledAppointmentIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedApptId);
          return next;
        });
      }
      void refreshRecent();
    });
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const first = filteredPricing[0];
    if (!first) {
      setFeedback({ message: `No add-on matches "${catalogQuery.trim()}".`, tone: "error" });
      return;
    }
    addItem(first);
    setCatalogQuery("");
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-4 bg-slate-100/70 pb-8">
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
              <FaReceipt className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">Cashier Terminal</p>
              <h1 className="text-xl font-black leading-tight">Clinic POS</h1>
              <p className="text-xs text-slate-400">Cash only. Per-consult fee with procedure add-ons.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[360px]">
            <MetricPill label="Clock" value={currentClock} />
            <MetricPill label="Ready" value={String(billableAppointments.length)} />
            <a href="#clinic-transactions" className="rounded-2xl border border-emerald-300/30 bg-emerald-400 px-3 py-2 text-slate-950 transition hover:bg-emerald-300">
              <p className="text-[10px] font-bold uppercase tracking-wider">Receipts</p>
              <p className="mt-1 font-black">Clinic Recent</p>
            </a>
          </div>
        </div>
        <div className="grid border-t border-white/10 bg-white/[0.03] text-xs font-bold uppercase tracking-[0.16em] text-slate-300 sm:grid-cols-3">
          <div className={`px-5 py-3 ${!issuedBillingId ? "bg-emerald-400 text-slate-950" : ""}`}>1. Build Cart</div>
          <div className={`px-5 py-3 ${!issuedBillingId || issuedBillingStatus === "Issued" ? "bg-emerald-400 text-slate-950" : ""}`}>2. Pay Cash</div>
          <div className={`px-5 py-3 ${issuedBillingStatus === "Paid" ? "bg-emerald-400 text-slate-950" : ""}`}>3. Receipt</div>
        </div>
      </header>

      {feedback ? (
        <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.tone === "success" ? <FaCircleCheck className="mt-0.5 h-4 w-4" /> : <FaCircleExclamation className="mt-0.5 h-4 w-4" />}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr_24rem]">
        <QueuePanel appointments={billableAppointments} selectedId={selectedApptId} disabled={!!issuedBillingId} onSelect={chooseAppointment} />

        <main className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Patient Sale</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{selectedAppt ? selectedAppt.patientName : "Choose a queue card"}</h2>
              </div>
              {selectedAppt ? (
                <div className="text-right">
                  <p className="font-mono text-xl font-black text-slate-950">{peso(consultationFee)}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{consultationKindLabel} consultation</p>
                </div>
              ) : null}
            </div>

            {selectedAppt ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InfoTile label="Visit Type" value={selectedIsProcedure ? "Medical Procedure" : "Clinic Visit"} />
                <InfoTile label="Service" value={selectedServiceLabel} />
                <InfoTile label="Contact" value={selectedAppt.phone || selectedAppt.email || "No contact"} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Select a patient. The consultation fee is added automatically as a locked flat line.
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Add-ons</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Procedures, Labs, Medicines</h2>
              </div>
              <input
                ref={searchRef}
                type="search"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search add-ons, then Enter"
                disabled={!selectedAppt || !!issuedBillingId}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 md:w-72"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {groupedCatalog.map((group) => (
                <div key={group.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">{group.category}</p>
                    <span className="font-mono text-[11px] font-bold text-slate-500">{group.items.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {group.items.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">No items</p>
                    ) : group.items.slice(0, 10).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addItem(item)}
                        disabled={!selectedAppt || !!issuedBillingId}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-900">{item.name}</span>
                          <span className="block font-mono text-[10px] text-slate-500">{item.code}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs font-black text-slate-900">{peso(Number(item.price))}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
            <div className="bg-slate-950 px-4 py-3 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Cart</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <h2 className="text-lg font-black">Cash Sale</h2>
                <span className="font-mono text-sm font-black">{lines.length + (selectedAppt ? 1 : 0)} lines</span>
              </div>
            </div>

            <div className="max-h-[24rem] overflow-y-auto px-4 py-3">
              {selectedAppt ? (
                <div className="space-y-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">Clinic consultation</p>
                        <p className="mt-1 text-xs font-semibold text-emerald-800">{consultationKindLabel} flat fee</p>
                      </div>
                      <p className="font-mono text-sm font-black text-slate-950">{peso(consultationFee)}</p>
                    </div>
                  </div>

                  {reservationCredit > 0 ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sky-950">Pre-paid Reservation Fee</p>
                          <p className="mt-1 text-xs font-semibold text-sky-700">Online PayMongo QR Ph (Credit)</p>
                        </div>
                        <p className="font-mono text-sm font-black text-sky-900">- {peso(reservationCredit)}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No patient selected.</p>
              )}

              <div className="mt-3 space-y-2">
                {lines.map((line) => {
                  const isGlp = line.description.toLowerCase().includes("glp") || line.pricing_id === pricing.find((p) => p.code === "PROC-GLP-INITIATION")?.id;
                  return (
                    <div key={line.tempId} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(event) => updateDescription(line.tempId, event.target.value)}
                            disabled={!!issuedBillingId}
                            placeholder="Description / Note"
                            className="w-full truncate rounded-lg border border-transparent px-1.5 py-0.5 text-sm font-bold text-slate-950 outline-none hover:border-slate-300 focus:border-emerald-400 focus:bg-emerald-50/40"
                            title="Click to edit item title or add remarks (e.g. Dose 1 of 8)"
                          />
                        </div>
                        {!issuedBillingId ? (
                          <button
                            type="button"
                            onClick={() => removeItem(line.tempId)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove item"
                          >
                            <FaXmark className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      {/* Quick preset chips for GLP Initiation / installment plans */}
                      {isGlp && !issuedBillingId && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plan:</span>
                          <button
                            type="button"
                            onClick={() => {
                              updateUnitPrice(line.tempId, 10000);
                              updateDescription(line.tempId, "GLP Initiation (Full Package)");
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900"
                          >
                            Full: ₱10,000
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateUnitPrice(line.tempId, 5000);
                              updateDescription(line.tempId, "GLP Initiation (50% Downpayment)");
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900"
                          >
                            50%: ₱5,000
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateUnitPrice(line.tempId, 1250);
                              updateDescription(line.tempId, "GLP Initiation (Per Visit / Weekly Dose)");
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900"
                          >
                            Per Visit: ₱1,250
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400">₱</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price}
                            onChange={(event) => updateUnitPrice(line.tempId, Number(event.target.value || 0))}
                            disabled={!!issuedBillingId}
                            aria-label="Unit Price"
                            title="Edit unit price directly"
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs font-black text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                          />
                          <span className="text-[11px] font-medium text-slate-400">each</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => updateQty(line.tempId, line.quantity - 1)}
                              disabled={!!issuedBillingId}
                              className="px-2.5 py-1 text-xs font-black disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="border-x border-slate-200 px-3 py-1 font-mono text-xs font-black">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(line.tempId, line.quantity + 1)}
                              disabled={!!issuedBillingId}
                              className="px-2.5 py-1 text-xs font-black disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <p className="font-mono text-sm font-black text-slate-950 text-right min-w-[70px]">
                            {peso(line.quantity * line.unit_price)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <TotalRow label="Subtotal" value={peso(subtotal)} />
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Discount" value={discount} onChange={setDiscount} disabled={issuedBillingId !== null || isStatutoryDiscount} />
                <NumberField label="VAT" value={tax} onChange={setTax} disabled={issuedBillingId !== null || isStatutoryDiscount} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as DiscountKind)} disabled={issuedBillingId !== null} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold outline-none disabled:bg-slate-100">
                  <option value="None">No discount</option>
                  <option value="Manual">Manual</option>
                  <option value="SeniorCitizen">Senior Citizen</option>
                  <option value="PWD">PWD</option>
                </select>
                <input value={discountIdNumber} onChange={(event) => setDiscountIdNumber(event.target.value)} disabled={issuedBillingId !== null || !isStatutoryDiscount} placeholder="ID number" className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none disabled:bg-slate-100" />
              </div>
              <TotalRow label="Discount" value={`-${peso(effectiveDiscount)}`} />
              <TotalRow label="VAT" value={peso(effectiveTax)} />
            </div>

            <div className="bg-slate-950 px-4 py-4 text-white">
              <div className="flex items-end justify-between">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total Due</span>
                <span className="font-mono text-3xl font-black">{peso(total)}</span>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4">
              {!issuedBillingId || issuedBillingStatus === "Issued" ? (
                <>
                  {/* Payment Method Selector */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Payment Method
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMethodId("cash")}
                        disabled={issuedBillingStatus === "Paid"}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          isCash
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <FaMoneyBillWave className={`h-3.5 w-3.5 ${isCash ? "text-emerald-700" : "text-slate-400"}`} />
                        <span>Cash</span>
                      </button>

                      {paymentAccounts.map((account) => {
                        const isSelected = selectedMethodId === account.id;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setSelectedMethodId(account.id)}
                            disabled={issuedBillingStatus === "Paid"}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {account.kind === "Bank" ? (
                              <FaBuildingColumns className={`h-3.5 w-3.5 ${isSelected ? "text-emerald-700" : "text-slate-400"}`} />
                            ) : account.qrCodeUrl ? (
                              <FaQrcode className={`h-3.5 w-3.5 ${isSelected ? "text-emerald-700" : "text-slate-400"}`} />
                            ) : (
                              <FaMobileScreen className={`h-3.5 w-3.5 ${isSelected ? "text-emerald-700" : "text-slate-400"}`} />
                            )}
                            <span className="truncate">{account.label || account.kind}</span>
                          </button>
                        );
                      })}
                    </div>
                    {paymentAccounts.length === 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Add GCash, Maya, or Bank accounts in Settings to show them here.
                      </p>
                    )}
                  </div>

                  {isCash ? (
                    <>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cash received</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={tenderedInput}
                          onChange={(event) => setTenderedInput(event.target.value)}
                          placeholder={total.toFixed(2)}
                          disabled={issuedBillingStatus === "Paid"}
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-right font-mono text-xl font-black outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {shortcutAmounts.map((amount, index) => (
                          <button
                            key={`${amount}-${index}`}
                            type="button"
                            onClick={() => setTenderedInput(amount.toFixed(2))}
                            disabled={issuedBillingStatus === "Paid"}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-xs font-black text-slate-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {index === 0 ? "Exact" : amount.toLocaleString("en-PH")}
                          </button>
                        ))}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${
                        issuedBillingStatus === "Void"
                          ? "bg-red-50 text-red-800"
                          : issuedBillingStatus === "Paid" || tenderedAmount >= total
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                      }`}>
                        <p className="text-[10px] font-black uppercase tracking-wider">
                          {issuedBillingStatus === "Void" ? "Voided" : issuedBillingStatus === "Paid" ? "Paid" : tenderedAmount >= total ? "Change" : "Short"}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-black">
                          {issuedBillingStatus === "Void"
                            ? "Closed"
                            : issuedBillingStatus === "Paid"
                              ? peso(total)
                              : peso(tenderedAmount >= total ? changeDue : total - tenderedAmount)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      {selectedAccount && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                                {selectedAccount.label || selectedAccount.kind}
                              </p>
                              {selectedAccount.bankName && (
                                <p className="mt-0.5 text-slate-600 font-medium">
                                  Bank: <span className="font-semibold text-slate-800">{selectedAccount.bankName}</span>
                                </p>
                              )}
                              <p className="mt-0.5 text-slate-600 font-medium">
                                Name: <span className="font-semibold text-slate-800">{selectedAccount.accountName || "Clinic"}</span>
                              </p>
                              <p className="mt-1 font-mono text-base font-black text-slate-900 tracking-wide">
                                {selectedAccount.accountNumber}
                              </p>
                            </div>
                            {selectedAccount.qrCodeUrl ? (
                              <a
                                href={selectedAccount.qrCodeUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Click to view QR code"
                                className="shrink-0 overflow-hidden rounded-lg border border-emerald-300 bg-white p-1 hover:shadow-md transition"
                              >
                                <img
                                  src={selectedAccount.qrCodeUrl}
                                  alt="Payment QR"
                                  className="h-16 w-16 object-contain"
                                />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      )}

                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Reference / Transaction No. <span className="text-rose-500">*</span>
                        </span>
                        <input
                          type="text"
                          value={providerRef}
                          onChange={(event) => setProviderRef(event.target.value)}
                          placeholder="e.g. 10029384758"
                          disabled={issuedBillingStatus === "Paid"}
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-2.5 font-mono text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={commitSale}
                    disabled={!canAcceptPayment || isWorking}
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {isWorking
                      ? "Processing..."
                      : issuedBillingId
                        ? "Retry Payment"
                        : isCash
                          ? "Complete Cash Sale"
                          : `Confirm ${selectedAccount?.label || selectedAccount?.kind || "Online"} Payment`}
                  </button>
                  <button type="button" onClick={resetSale} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Clear Sale</button>
                </>
              ) : (
                <>
                  <div className={`rounded-2xl px-4 py-3 ${
                    issuedBillingStatus === "Void"
                      ? "bg-red-50 text-red-800"
                      : "bg-emerald-50 text-emerald-800"
                  }`}>
                    <p className="text-[10px] font-black uppercase tracking-wider">
                      {issuedBillingStatus === "Void" ? "Voided" : "Paid"}
                    </p>
                    <p className="mt-1 font-mono text-2xl font-black">
                      {issuedBillingStatus === "Void" ? "Closed" : peso(total)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReceiptModal(issuedBillingId)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <FaReceipt className="h-3.5 w-3.5" /> Receipt
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {canVoid && issuedBillingStatus !== "Void" ? <button type="button" onClick={() => setConfirmingVoid(true)} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"><FaBan className="mr-1 inline h-3.5 w-3.5" /> Void</button> : null}
                    <button type="button" onClick={resetSale} className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">New Sale</button>
                  </div>
                </>
              )}
            </div>
          </section>

          <RecentPanel billings={recentBillings} onOpenReceipt={openReceiptModal} />
        </aside>
      </div>

      {receiptModalOpen && receiptBillingId ? (
        <ReceiptModal billingId={receiptBillingId} paymentSnapshot={receiptPayment} onClose={closeReceiptModal} />
      ) : null}

      {confirmingVoid ? (
        <ConfirmModal title="Void bill" onClose={() => setConfirmingVoid(false)}>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Reason</span>
            <textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} rows={3} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmingVoid(false)} className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
            <button type="button" onClick={commitVoid} disabled={isWorking} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">Void Bill</button>
          </div>
        </ConfirmModal>
      ) : null}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-mono font-black text-white">{value}</p>
    </div>
  );
}

function QueuePanel({
  appointments,
  selectedId,
  disabled,
  onSelect,
}: {
  appointments: AppointmentRecord[];
  selectedId: string;
  disabled: boolean;
  onSelect: (appointment: AppointmentRecord) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Queue</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Ready to Bill</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700">{appointments.length}</span>
      </div>
      <div className="mt-4 max-h-[calc(100vh-280px)] space-y-2 overflow-y-auto pr-1.5">
        {appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No started or completed clinic visits yet.
          </div>
        ) : appointments.map((appointment) => {
          const selected = appointment.id === selectedId;
          const context = parseAppointmentContext(appointment.reason);
          const procedure = isProcedureServiceTitle(context?.service);
          return (
            <button
              key={appointment.id}
              type="button"
              onClick={() => onSelect(appointment)}
              disabled={disabled}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                selected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{appointment.patientName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Q#{appointment.queueNumber} · {appointment.status}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${procedure ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                  {procedure ? "Procedure" : "Visit"}
                </span>
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-slate-700">{context?.service || "Clinic Visit"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{formatDisplayDate(appointment.date)} · {formatRange(appointment.start, appointment.end)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-right font-mono text-sm outline-none disabled:bg-slate-100"
      />
    </label>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "text-base font-black text-slate-950" : "text-sm font-bold text-slate-700"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function RecentPanel({
  billings,
  onOpenReceipt,
}: {
  billings: RecentBilling[];
  onOpenReceipt: (billingId: string) => void;
}) {
  return (
    <section id="clinic-transactions" className="scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Recent Transactions</p>
          <h2 className="mt-1 text-sm font-black text-slate-950">Clinic POS only</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">Clinic</span>
      </div>
      {billings.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-semibold text-slate-500">
          No clinic POS transactions yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {billings.slice(0, 8).map((bill) => {
            const billTotal =
              bill.total > 0
                ? bill.total
                : Math.max(0, (bill.subtotal ?? 0) - (bill.discount ?? 0) + (bill.tax ?? 0));
            return (
              <button
                key={bill.id}
                type="button"
                onClick={() => onOpenReceipt(bill.id)}
                className="block w-full rounded-2xl border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-black">#{bill.id.slice(0, 8).toUpperCase()}</span>
                  <span className="font-mono font-bold">{peso(billTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>{bill.status}</span>
                  <span>{new Date(bill.issued_at ?? bill.created_at).toLocaleDateString("en-PH")}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReceiptModal({
  billingId,
  paymentSnapshot,
  onClose,
}: {
  billingId: string;
  paymentSnapshot: PaymentSnapshot | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-2 py-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-[84mm] max-w-[84mm] overflow-y-auto rounded-[1.25rem] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <ReceiptDocument billingId={billingId} variant="popup" onClose={onClose} paymentSnapshot={paymentSnapshot} />
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Confirm</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <FaXmark className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
