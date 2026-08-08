"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaBan,
  FaBuildingColumns,
  FaCircleCheck,
  FaCircleExclamation,
  FaEnvelope,
  FaLock,
  FaPhone,
  FaReceipt,
  FaCreditCard,
  FaTriangleExclamation,
  FaXmark,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useDoctorFees } from "@/src/components/clinic/useDoctorFees";
import { useRole } from "@/src/components/layout/RoleProvider";
import { QrPhLogo } from "@/src/components/payments/QrPhLogo";
import { formatDisplayDate, formatRange, type AppointmentRecord } from "@/src/lib/appointments";
import { getAppointmentConsultKind } from "@/src/lib/appointment-context";
import {
  FOLLOW_UP_CLINIC_CONSULTATION_FEE,
  calculateConsultationCharge,
  formatDurationLabel,
} from "@/src/lib/consultation-pricing";

type PricingItem = {
  id: string;
  code: string;
  name: string;
  category: "Consultation" | "Lab" | "Medicine" | "Procedure" | "Other";
  price: number;
  is_active: boolean;
};

type ProductItem = {
  id: string;
  sku: string;
  name: string;
  brand_name: string | null;
  generic_name: string | null;
  dosage: string | null;
  category: string;
  selling_price: number;
  stock_qty: number;
  unit: string;
  is_active: boolean;
};

type Line = {
  tempId: string;
  pricing_id: string | null;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

type PaymentMethod = "Cash" | "QR" | "Card" | "BankTransfer";

type PaymentOptionConfig = {
  value: PaymentMethod;
  label: string;
  detail: string;
  icon: React.ReactNode;
  selectedClass: string;
  hoverClass: string;
  iconClass: string;
  available: boolean;
  unavailableNote?: string;
};

// Cashier discount UX. Senior Citizen / PWD apply a 20% discount and 0 VAT
// per RA 9994 / RA 10754 — the math is enforced on the server so the cashier
// can't accidentally undercharge or forget the VAT exemption.
type DiscountKind = "None" | "Manual" | "SeniorCitizen" | "PWD";

type RecentBilling = {
  id: string;
  appointment_id: string | null;
  total: number;
  status: "Draft" | "Issued" | "Paid" | "Void";
  created_at: string;
  issued_at: string | null;
};

const POS_CATEGORIES = ["Consultation", "Lab", "Medicine", "Procedure", "Other"] as const;
type POSCategory = (typeof POS_CATEGORIES)[number];

function isPOSCategory(category: PricingItem["category"]): category is POSCategory {
  return (POS_CATEGORIES as readonly string[]).includes(category);
}

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Quick-tender denominations the cashier is most likely to handle. The bill
// total is always the cleanest "Exact" option, surfaced first.
const QUICK_TENDER_AMOUNTS = [100, 200, 500, 1000] as const;

function roundUpToNearest(amount: number, step: number) {
  return Math.ceil(amount / step) * step;
}

function getCashShortcutAmounts(total: number) {
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
    .sort((left, right) => left - right)
    .slice(0, 6);
}

function getPaymentMethodLabel(method: PaymentMethod) {
  if (method === "QR") return "QR Ph";
  return method === "BankTransfer" ? "Transfer" : method;
}

function getReferenceLabel(method: PaymentMethod) {
  return method === "Card" ? "Card reference" : "Transfer reference";
}

function getReferencePlaceholder(method: PaymentMethod) {
  return method === "Card" ? "Terminal approval code" : "Bank / wallet reference no.";
}

const POS_PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    value: "Cash",
    label: "Cash",
    detail: "Accept cash at the cashier and compute change here in the POS.",
    icon: <span className="text-[11px] font-black">PHP</span>,
    selectedClass: "border-emerald-500 bg-emerald-700 text-white",
    hoverClass: "hover:border-emerald-400",
    iconClass: "h-8 w-8 bg-emerald-50 text-emerald-700",
    available: true,
  },
  {
    value: "QR",
    label: "QR Ph",
    detail: "Open PayMongo checkout so the patient can scan with GCash, Maya, or any supported banking app.",
    icon: <QrPhLogo className="h-auto w-full" />,
    selectedClass: "border-[#204884] bg-[#204884] text-white",
    hoverClass: "hover:border-[#204884]",
    iconClass: "h-8 w-16 border border-[#204884]/15 bg-white px-1.5",
    available: true,
  },
  {
    value: "BankTransfer",
    label: "Transfer",
    detail: "Direct online banking is already wired to PayMongo, but the merchant account is still pending activation.",
    icon: <FaBuildingColumns className="h-4 w-4 text-[#005baa]" aria-hidden="true" />,
    selectedClass: "border-[#005baa] bg-[#005baa] text-white",
    hoverClass: "hover:border-[#005baa]",
    iconClass: "h-8 w-8 bg-[#eaf3ff] text-[#005baa]",
    available: false,
    unavailableNote: "Not yet activated on PayMongo. Please use QR Ph for now.",
  },
  {
    value: "Card",
    label: "Card",
    detail: "Card checkout is already wired to PayMongo, but card processing is still pending activation on the merchant account.",
    icon: <FaCreditCard className="h-4 w-4 text-[#1a1f71]" aria-hidden="true" />,
    selectedClass: "border-[#1a1f71] bg-[#1a1f71] text-white",
    hoverClass: "hover:border-[#1a1f71]",
    iconClass: "h-8 w-8 bg-[#eef0ff] text-[#1a1f71]",
    available: false,
    unavailableNote: "Not yet activated on PayMongo. Please use QR Ph for now.",
  },
];

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function newLine(partial: Partial<Line> = {}): Line {
  return {
    tempId: crypto.randomUUID(),
    pricing_id: null,
    product_id: null,
    description: "",
    quantity: 1,
    unit_price: 0,
    ...partial,
  };
}

function buildLineFromPricing(item: PricingItem): Line {
  return newLine({
    pricing_id: item.id,
    product_id: null,
    description: item.name,
    quantity: 1,
    unit_price: Number(item.price),
  });
}

function productDisplayName(item: ProductItem) {
  return [item.brand_name ?? item.name, item.dosage].filter(Boolean).join(" - ");
}

function buildLineFromProduct(item: ProductItem): Line {
  return newLine({
    pricing_id: null,
    product_id: item.id,
    description: productDisplayName(item),
    quantity: 1,
    unit_price: Number(item.selling_price),
  });
}

function getLineSelectionValue(line: Line) {
  if (line.pricing_id) return `pricing:${line.pricing_id}`;
  if (line.product_id) return `product:${line.product_id}`;
  return "";
}

export default function POSBillingPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
  const { appointments } = useAppointments();
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [discountKind, setDiscountKind] = useState<DiscountKind>("None");
  const [discountIdNumber, setDiscountIdNumber] = useState<string>("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [issuedBillingId, setIssuedBillingId] = useState<string | null>(null);
  const [isWorking, startTransition] = useTransition();

  // Confirm-before-commit modals so an accidental click can't write to the DB.
  const [confirmingIssue, setConfirmingIssue] = useState(false);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  // Recent transactions strip — last few bills the cashier touched, for
  // quick reprint or void.
  const [recentBillings, setRecentBillings] = useState<RecentBilling[]>([]);
  const catalogSearchRef = useRef<HTMLInputElement | null>(null);

  // Live clock in the header — small detail, but every real POS has one,
  // and it doubles as a "your screen is alive" signal during quiet shifts.
  const [currentClock, setCurrentClock] = useState<string>(() => formatClock(new Date()));
  useEffect(() => {
    const tick = () => setCurrentClock(formatClock(new Date()));
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  const canUse = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";
  const canVoid = role === "SUPER_ADMIN" || role === "DOCTOR" || role === "SECRETARY";

  useEffect(() => {
    if (authLoading || !accessToken) return;
    (async () => {
      const pricingRes = await fetch("/api/v2/pricing", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (pricingRes.ok) {
        const payload = (await pricingRes.json()) as { pricing: PricingItem[] };
        setPricing(payload.pricing);
      }
      setProducts([]);
    })();
  }, [accessToken, authLoading]);

  const refreshRecent = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch("/api/v2/billings", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return;
    const payload = (await res.json()) as { billings: RecentBilling[] };
    setRecentBillings(payload.billings.slice(0, 6));
  }, [accessToken]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (typeof window === "undefined" || !accessToken) return;

    const params = new URLSearchParams(window.location.search);
    const billingPaid = params.get("billing_paid");
    if (!billingPaid) return;

    let cancelled = false;
    setFeedback({ message: "Finalizing POS payment with PayMongo…", tone: "success" });

    (async () => {
      try {
        const res = await fetch(`/api/v2/billings/${billingPaid}/reconcile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        if (cancelled) return;

        if (!res.ok) {
          setFeedback({
            message: payload.message ?? "Could not finalize the POS payment. Please reconcile it from the cashier screen.",
            tone: "error",
          });
          return;
        }

        setIssuedBillingId(billingPaid);
        setPaymentMethod("QR");
        setFeedback({
          message: "QR Ph payment confirmed through PayMongo. Receipt is ready and the clinic appointment is now completed.",
          tone: "success",
        });
        void refreshRecent();

        const url = new URL(window.location.href);
        url.searchParams.delete("billing_paid");
        window.history.replaceState({}, "", url.toString());
      } catch (error) {
        if (cancelled) return;
        setFeedback({
          message: error instanceof Error ? error.message : "Network error while finalizing the POS payment.",
          tone: "error",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshRecent]);

  const clinicAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.type === "Clinic")
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [appointments],
  );

  const billableAppointments = useMemo(
    () =>
      clinicAppointments.filter((a) => a.status === "In Progress" || a.status === "Completed"),
    [clinicAppointments],
  );

  const pendingClinicAppointments = useMemo(
    () => clinicAppointments.filter((a) => a.status !== "In Progress" && a.status !== "Completed"),
    [clinicAppointments],
  );

  const selectedAppt = billableAppointments.find((a) => a.id === selectedApptId) ?? null;
  const { fees: selectedDoctorFees } = useDoctorFees(selectedAppt?.doctorId);
  const posPricing = useMemo(
    () => pricing.filter((item) => item.is_active && isPOSCategory(item.category)),
    [pricing],
  );
  const posProducts = useMemo(
    () => products.filter((item) => item.is_active && Number(item.stock_qty) > 0),
    [products],
  );

  const catalogByCategory = useMemo(
    () =>
      POS_CATEGORIES.map((category) => ({
        category,
        items: posPricing
          .filter((item) => item.category === category)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [posPricing],
  );
  const productCatalogByCategory = useMemo(
    () =>
      Array.from(new Set(posProducts.map((item) => item.category || "Product")))
        .sort((left, right) => left.localeCompare(right))
        .map((category) => ({
          category,
          items: posProducts
            .filter((item) => (item.category || "Product") === category)
            .sort((a, b) => productDisplayName(a).localeCompare(productDisplayName(b))),
        })),
    [posProducts],
  );
  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return catalogByCategory;
    return catalogByCategory.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.name, item.code, item.category].some((value) => value.toLowerCase().includes(query)),
      ),
    }));
  }, [catalogByCategory, catalogQuery]);
  const filteredProductCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return productCatalogByCategory;
    return productCatalogByCategory.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [item.sku, item.category, item.name, item.brand_name ?? "", item.generic_name ?? "", item.dosage ?? ""]
          .some((value) => value.toLowerCase().includes(query)),
      ),
    }));
  }, [catalogQuery, productCatalogByCategory]);

  const validItems = lines.filter((line) => (line.pricing_id || line.product_id) && line.quantity > 0 && line.unit_price > 0);
  const selectedConsultKind = selectedAppt ? getAppointmentConsultKind(selectedAppt.reason) : undefined;
  const hasPriorClinicConsultation = selectedAppt
    ? appointments.some((appointment) =>
      appointment.id !== selectedAppt.id
      && appointment.type === "Clinic"
      && appointment.email.trim().toLowerCase() === selectedAppt.email.trim().toLowerCase()
      && `${appointment.date} ${appointment.start}` < `${selectedAppt.date} ${selectedAppt.start}`,
    )
    : false;
  const consultationRate = selectedConsultKind === "FollowUp" || (!selectedConsultKind && hasPriorClinicConsultation)
    ? FOLLOW_UP_CLINIC_CONSULTATION_FEE
    : selectedDoctorFees.clinic;
  const consultationBaseFee = selectedAppt
    ? calculateConsultationCharge(consultationRate, selectedAppt.start, selectedAppt.end)
    : 0;
  const subtotal = consultationBaseFee + validItems.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);

  // SC/PWD: 20% off, VAT exempt. Otherwise honour the cashier's manual values.
  const isStatutoryDiscount = discountKind === "SeniorCitizen" || discountKind === "PWD";
  const effectiveDiscount = isStatutoryDiscount ? Math.round(subtotal * 20) / 100 : discount;
  const effectiveTax = isStatutoryDiscount ? 0 : tax;
  const total = Math.max(0, subtotal - effectiveDiscount + effectiveTax);
  const discountExceedsSubtotal = !isStatutoryDiscount && discount > subtotal && subtotal > 0;

  const tenderedNumber = Number(tenderedInput || 0);
  const isCash = paymentMethod === "Cash";
  const isQR = paymentMethod === "QR";
  // For non-cash methods, the patient tenders exactly the total. Card and
  // bank transfer don't have "change."
  const effectiveTendered = isCash ? tenderedNumber : total;
  const changeDue = Math.max(0, effectiveTendered - total);
  const tenderShortfall = total - effectiveTendered;
  const trimmedPaymentReference = paymentReference.trim();
  const paymentMethodLabel = getPaymentMethodLabel(paymentMethod);
  const activePaymentOption = POS_PAYMENT_OPTIONS.find((option) => option.value === paymentMethod) ?? POS_PAYMENT_OPTIONS[0];
  const canAcceptPayment =
    total > 0 && (
      isCash
        ? tenderedNumber >= total
        : isQR
          ? !!issuedBillingId
          : activePaymentOption.available && trimmedPaymentReference.length > 0
    );
  const cashShortcutAmounts = useMemo(() => getCashShortcutAmounts(total), [total]);
  const currentStep = issuedBillingId ? 2 : 1;

  function updateLine(tempId: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.tempId === tempId ? { ...line, ...patch } : line)));
  }

  function addCatalogItem(item: PricingItem) {
    if (issuedBillingId) return;

    setLines((current) => {
      const matchingLine = current.find(
        (line) =>
          line.pricing_id === item.id &&
          line.description.trim().toLowerCase() === item.name.trim().toLowerCase() &&
          Number(line.unit_price) === Number(item.price),
      );

      if (matchingLine) {
        return current.map((line) =>
          line.tempId === matchingLine.tempId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      if (current.length === 1 && !current[0].description.trim() && current[0].unit_price === 0) {
        return [buildLineFromPricing(item)];
      }

      return [...current, buildLineFromPricing(item)];
    });
  }

  function addProductItem(item: ProductItem) {
    if (issuedBillingId) return;

    setLines((current) => {
      const matchingLine = current.find(
        (line) =>
          line.product_id === item.id &&
          line.description.trim().toLowerCase() === productDisplayName(item).trim().toLowerCase() &&
          Number(line.unit_price) === Number(item.selling_price),
      );

      if (matchingLine) {
        return current.map((line) =>
          line.tempId === matchingLine.tempId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      if (current.length === 1 && !current[0].description.trim() && current[0].unit_price === 0) {
        return [buildLineFromProduct(item)];
      }

      return [...current, buildLineFromProduct(item)];
    });
  }

  function removeLine(tempId: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.tempId !== tempId) : current));
  }

  function applyCatalogSelection(tempId: string, selectionValue: string) {
    const [kind, id] = selectionValue.split(":");
    if (!kind || !id) return;
    if (kind === "pricing") {
      const item = posPricing.find((entry) => entry.id === id);
      if (!item) return;
      updateLine(tempId, {
        pricing_id: item.id,
        product_id: null,
        description: item.name,
        unit_price: Number(item.price),
      });
      return;
    }

    const product = posProducts.find((entry) => entry.id === id);
    if (!product) return;
    updateLine(tempId, {
      pricing_id: null,
      product_id: product.id,
      description: productDisplayName(product),
      unit_price: Number(product.selling_price),
    });
  }

  function resetForm() {
    setSelectedApptId("");
    setLines([newLine()]);
    setDiscount(0);
    setTax(0);
    setDiscountKind("None");
    setDiscountIdNumber("");
    setPaymentMethod("Cash");
    setPaymentReference("");
    setTenderedInput("");
    setIssuedBillingId(null);
    setFeedback(null);
    setConfirmingIssue(false);
    setConfirmingVoid(false);
    setVoidReason("");
  }

  /**
   * Step 1 of "Generate Bill" — open the confirm modal. We never POST
   * directly from the button click so an accidental Enter keypress can't
   * commit a bill to the DB.
   */
  function openIssueConfirm() {
    if (!accessToken) return;
    if (!selectedAppt) {
      setFeedback({ message: "Pick a clinic consultation that is already in progress or already finished.", tone: "error" });
      return;
    }
    if (discountExceedsSubtotal) {
      setFeedback({ message: "Discount cannot exceed the subtotal. Adjust the discount before continuing.", tone: "error" });
      return;
    }
    if (isStatutoryDiscount && !discountIdNumber.trim()) {
      setFeedback({
        message: `${discountKind === "PWD" ? "PWD" : "Senior Citizen"} ID number is required.`,
        tone: "error",
      });
      return;
    }
    setFeedback(null);
    setConfirmingIssue(true);
  }

  function commitIssueBill() {
    if (!accessToken || !selectedAppt) return;
    startTransition(async () => {
      const res = await fetch("/api/v2/billings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          appointment_id: selectedAppt.id,
          discount: isStatutoryDiscount ? 0 : discount,
          tax: isStatutoryDiscount ? 0 : tax,
          discount_kind: discountKind,
          discount_id_number: isStatutoryDiscount ? discountIdNumber.trim() : null,
          items: validItems.map((line) => ({
            pricing_id: line.pricing_id,
            product_id: line.product_id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Failed to generate clinic billing.", tone: "error" });
        setConfirmingIssue(false);
        return;
      }

      const payload = (await res.json()) as { billing: { id: string } };
      setIssuedBillingId(payload.billing.id);
      setConfirmingIssue(false);
      setFeedback({ message: "Bill generated. Accept payment to print the receipt.", tone: "success" });
      void refreshRecent();
    });
  }

  function recordPayment() {
    if (!accessToken || !issuedBillingId) return;
    if (isCash && tenderedNumber < total) {
      setFeedback({ message: `Tendered amount must be at least ${peso(total)}.`, tone: "error" });
      return;
    }
    if (!isCash && !isQR && !trimmedPaymentReference) {
      setFeedback({ message: `${paymentMethodLabel} reference is required before payment can be recorded.`, tone: "error" });
      return;
    }
    startTransition(async () => {
      if (isQR) {
        const res = await fetch(`/api/v2/billings/${issuedBillingId}/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ checkout_option: "paymongo_qr" }),
        });

        const payload = (await res.json().catch(() => ({}))) as { message?: string; url?: string };
        if (!res.ok) {
          setFeedback({ message: payload.message ?? "Could not start PayMongo QR checkout.", tone: "error" });
          return;
        }
        if (!payload.url) {
          setFeedback({ message: "PayMongo checkout link was not returned.", tone: "error" });
          return;
        }

        window.location.href = payload.url;
        return;
      }

      const res = await fetch(`/api/v2/billings/${issuedBillingId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          method: paymentMethod,
          provider_ref: isCash ? null : trimmedPaymentReference,
          tendered_amount: isCash ? tenderedNumber : null,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Payment failed.", tone: "error" });
        return;
      }

      const changeMsg = isCash && changeDue > 0 ? ` Change due: ${peso(changeDue)}.` : "";
      setFeedback({
        message: `Payment accepted.${changeMsg} Receipt is ready and the clinic appointment is now completed.`,
        tone: "success",
      });
      setPaymentReference("");
      void refreshRecent();
    });
  }

  function commitVoid() {
    if (!accessToken || !issuedBillingId) return;
    if (voidReason.trim().length < 4) {
      setFeedback({ message: "Provide a void reason (at least 4 characters).", tone: "error" });
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/v2/billings/${issuedBillingId}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Void failed.", tone: "error" });
        return;
      }
      setFeedback({
        message: "Bill voided. A refund record was added for the original tender.",
        tone: "success",
      });
      setConfirmingVoid(false);
      setVoidReason("");
      // Keep the issued id so the receipt link still works; the cashier
      // will hit "Start New Bill" when they're ready.
      void refreshRecent();
    });
  }

  /**
   * Barcode-style add: hitting Enter in the catalog search adds the first
   * matching item to the cart. Lets the cashier type a code, hit Enter,
   * and move on without reaching for the mouse.
   */
  function handleCatalogKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return;
    const match = posPricing.find((item) =>
      [item.code, item.name].some((value) => value.toLowerCase().includes(query)),
    );
    if (match) {
      addCatalogItem(match);
      setCatalogQuery("");
      return;
    }
    const productMatch = posProducts.find((item) =>
      [item.sku, item.name, item.brand_name ?? "", item.generic_name ?? ""]
        .some((value) => value.toLowerCase().includes(query)),
    );
    if (productMatch) {
      addProductItem(productMatch);
      setCatalogQuery("");
    } else {
      setFeedback({ message: `No POS item matches "${catalogQuery.trim()}".`, tone: "error" });
    }
  }

  // Desktop keyboard shortcuts. We deliberately *don't* hijack ordinary
  // typing: the handler bails out when the user is in an editable field
  // (except for "/" which only fires when not already focused on text).
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }

    function onKey(e: KeyboardEvent) {
      // "/" focuses catalog search — only when not already typing.
      if (e.key === "/" && !isEditableTarget(e.target)) {
        e.preventDefault();
        catalogSearchRef.current?.focus();
        catalogSearchRef.current?.select();
        return;
      }

      // F2 = primary action (Generate Bill / Accept Payment).
      if (e.key === "F2") {
        e.preventDefault();
        if (confirmingIssue || confirmingVoid) return;
        if (!issuedBillingId) {
          if (canUse && !isWorking && selectedApptId && !discountExceedsSubtotal) {
            openIssueConfirm();
          }
        } else if (!isWorking && canAcceptPayment) {
          recordPayment();
        }
        return;
      }

      // F9 = void (only meaningful once a bill is issued).
      if (e.key === "F9") {
        e.preventDefault();
        if (issuedBillingId && canVoid && !confirmingVoid) {
          setVoidReason("");
          setConfirmingVoid(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    issuedBillingId,
    canAcceptPayment,
    isWorking,
    canUse,
    selectedApptId,
    discountExceedsSubtotal,
    canVoid,
    confirmingIssue,
    confirmingVoid,
  ]);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
            <FaReceipt className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">Clinic POS Billing</h1>
            <p className="text-xs text-slate-500">
              {role ? role.replace("_", " ").toLowerCase() : "Cashier"} terminal · Clinic appointments only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="hidden font-mono sm:inline">{currentClock}</span>
          <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 sm:inline">/</kbd>
          <span className="hidden sm:inline">search</span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 sm:inline">F2</kbd>
          <span className="hidden sm:inline">{issuedBillingId ? "pay" : "issue"}</span>
          {issuedBillingId && canVoid ? (
            <>
              <span className="hidden text-slate-300 sm:inline">·</span>
              <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 sm:inline">F9</kbd>
              <span className="hidden sm:inline">void</span>
            </>
          ) : null}
          <Link
            href="/payments/history"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-neutral-300 hover:text-neutral-700"
          >
            History
          </Link>
        </div>
      </header>

      {feedback ? (
        <div
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border border-neutral-200 bg-neutral-50 text-neutral-700"
              : "border border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
        >
          {feedback.tone === "success" ? (
            <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <FaCircleExclamation className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      {recentBillings.length > 0 ? (
        <section className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Transactions</p>
            <Link
              href="/payments/history"
              className="text-xs font-semibold text-neutral-700 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {recentBillings.map((bill) => (
              <Link
                key={bill.id}
                href={`/payments/receipt/${bill.id}`}
                className="shrink-0 rounded-2xl border border-neutral-100 bg-neutral-50/40 px-3 py-2 text-xs transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <span className="block font-mono font-bold text-slate-900">
                  #{bill.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-600">{peso(bill.total)}</span>
                <span
                  className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    bill.status === "Paid"
                      ? "bg-neutral-100 text-neutral-700"
                      : bill.status === "Issued"
                        ? "bg-neutral-100 text-neutral-700"
                        : bill.status === "Void"
                          ? "bg-slate-200 text-slate-700 line-through"
                          : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {bill.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">POS Flow</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">Build Bill, accept payment, then print the receipt.</h2>
          </div>
          <span className="rounded-full bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-700">
            {issuedBillingId ? "Step 2 of 3" : "Step 1 of 3"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <POSStepCard
            step={1}
            title="Build Bill"
            description="Select the clinic appointment and add services, medicines, or retail products before issuing the bill."
            state={currentStep === 1 ? "current" : "complete"}
          />
          <POSStepCard
            step={2}
            title="Accept Payment"
            description="Choose Cash, QR, Transfer, or Card. Enter amount received or the payment reference."
            state={currentStep === 2 ? "current" : "upcoming"}
          />
          <POSStepCard
            step={3}
            title="Print Receipt"
            description="Open the receipt and print once payment is accepted and the clinic visit is completed."
            state="upcoming"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Patient</h2>
              <span className="rounded-full bg-neutral-50 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">
                {billableAppointments.length} billable
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Clinic appointment</span>
                <select
                  value={selectedApptId}
                  onChange={(event) => setSelectedApptId(event.target.value)}
                  disabled={!canUse || !!issuedBillingId}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 disabled:bg-slate-50"
                >
                  <option value="">
                    {billableAppointments.length === 0
                      ? pendingClinicAppointments.length > 0
                        ? `${pendingClinicAppointments.length} clinic booking(s) found, but none are ready for POS yet`
                        : "No clinic visits ready for POS yet"
                      : "Select appointment"}
                  </option>
                  {billableAppointments.map((appt) => (
                    <AppointmentOption key={appt.id} appt={appt} />
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                {selectedAppt ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{selectedAppt.patientName}</p>
                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">Q#{selectedAppt.queueNumber}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-600">
                      <span>{formatDisplayDate(selectedAppt.date)} · {formatRange(selectedAppt.start, selectedAppt.end)}</span>
                      {selectedAppt.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <FaPhone className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
                          {selectedAppt.phone}
                        </span>
                      ) : null}
                      {selectedAppt.email ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <FaEnvelope className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
                          <span className="truncate">{selectedAppt.email}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-neutral-700">
                      <span className="font-semibold">Base:</span>
                      <span className="font-mono">{peso(consultationBaseFee)}</span>
                      <span className="text-slate-400">({formatDurationLabel(selectedAppt.start, selectedAppt.end)} @ {peso(selectedDoctorFees.clinic)}/hr)</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Pick an appointment to start billing.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Catalog</h2>
              <span className="text-xs text-slate-500">
                {posPricing.length + posProducts.length} item{posPricing.length + posProducts.length === 1 ? "" : "s"} in catalog
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={catalogSearchRef}
                  type="search"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  onKeyDown={handleCatalogKeyDown}
                  placeholder='Code, SKU, or name (try "/" to focus, Enter to add first match)'
                  disabled={!canUse || !!issuedBillingId}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pl-8 text-sm text-slate-900 outline-none transition focus:border-neutral-300 focus:ring-2 focus:ring-neutral-200 disabled:bg-slate-50"
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">⌕</span>
                {catalogQuery ? (
                  <button
                    type="button"
                    onClick={() => setCatalogQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <FaXmark className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {filteredCatalog.map((group) => (
                <div key={group.category} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{group.category}</p>
                    <span className="font-mono text-[10px] text-slate-500">{group.items.length}</span>
                  </div>

                  <div className="space-y-1">
                    {group.items.length > 0 ? (
                      group.items.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addCatalogItem(item)}
                          disabled={!canUse || !!issuedBillingId}
                          title={`${item.code} · ${item.name}`}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                        >
                          <span className="min-w-0 pr-2">
                            <span className="block truncate text-xs font-semibold text-slate-900">{item.name}</span>
                            <span className="block font-mono text-[10px] text-slate-500">{item.code}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold text-neutral-700">{peso(Number(item.price))}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-200 bg-white px-2 py-3 text-center text-[11px] text-slate-400">
                        No {group.category.toLowerCase()} services yet.
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredProductCatalog.map((group) => (
                <div key={`product-${group.category}`} className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-2">
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">{group.category}</p>
                    <span className="font-mono text-[10px] text-neutral-700">{group.items.length}</span>
                  </div>

                  <div className="space-y-1">
                    {group.items.length > 0 ? (
                      group.items.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addProductItem(item)}
                          disabled={!canUse || !!issuedBillingId}
                          title={`${item.sku} · ${productDisplayName(item)}`}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-left transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                        >
                          <span className="min-w-0 pr-2">
                            <span className="block truncate text-xs font-semibold text-slate-900">{productDisplayName(item)}</span>
                            <span className="block font-mono text-[10px] text-slate-500">
                              {item.sku} · {Number(item.stock_qty).toLocaleString()} {item.unit}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold text-neutral-700">{peso(Number(item.selling_price))}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-neutral-200 bg-white px-2 py-3 text-center text-[11px] text-neutral-700/70">
                        No {group.category.toLowerCase()} products in stock.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-12 md:col-span-5">Item</div>
                <div className="col-span-3 md:col-span-2 text-center">Qty</div>
                <div className="col-span-4 md:col-span-2 text-right">Unit</div>
                <div className="col-span-4 md:col-span-2 text-right">Line</div>
                <div className="col-span-1 text-right">×</div>
              </div>

              <div className="divide-y divide-slate-100 bg-white">
                {lines.map((line) => (
                  <div key={line.tempId} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                    <div className="col-span-12 md:col-span-5">
                      <select
                        value={getLineSelectionValue(line)}
                        onChange={(event) => {
                          if (event.target.value) applyCatalogSelection(line.tempId, event.target.value);
                          else updateLine(line.tempId, { pricing_id: null, product_id: null, description: "", unit_price: 0 });
                        }}
                        disabled={!canUse || !!issuedBillingId}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none transition focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200 disabled:bg-slate-50"
                      >
                        <option value="">— pick service or product —</option>
                        <optgroup label="Services">
                          {posPricing.map((item) => (
                            <option key={item.id} value={`pricing:${item.id}`}>
                              [{item.category[0]}] {item.name} · {peso(Number(item.price))}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Products">
                          {posProducts.map((item) => (
                            <option key={item.id} value={`product:${item.id}`}>
                              [{item.category}] {productDisplayName(item)} · {peso(Number(item.selling_price))}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    <div className="col-span-3 md:col-span-2">
                      <div className="flex items-center rounded-md border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => updateLine(line.tempId, { quantity: Math.max(1, line.quantity - 1) })}
                          disabled={!canUse || !!issuedBillingId}
                          className="px-2 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                        >−</button>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.tempId, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                          disabled={!canUse || !!issuedBillingId}
                          className="w-full border-x border-slate-200 px-1 py-1.5 text-center font-mono text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateLine(line.tempId, { quantity: line.quantity + 1 })}
                          disabled={!canUse || !!issuedBillingId}
                          className="px-2 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                        >+</button>
                      </div>
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        readOnly
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-right font-mono text-xs text-slate-700 outline-none"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2 text-right font-mono text-xs font-bold text-slate-900">
                      {peso(line.quantity * line.unit_price)}
                    </div>

                    <div className="col-span-1 flex justify-end">
                      {lines.length > 1 && !issuedBillingId ? (
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempId)}
                          className="rounded p-1 text-slate-400 transition hover:bg-neutral-50 hover:text-neutral-600"
                          aria-label="Remove line"
                        >
                          <FaXmark className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Discount:</span>
                {([
                  { value: "None", label: "None" },
                  { value: "Manual", label: "Manual" },
                  { value: "SeniorCitizen", label: "Senior 20%" },
                  { value: "PWD", label: "PWD 20%" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!canUse || !!issuedBillingId}
                    onClick={() => {
                      setDiscountKind(option.value);
                      if (option.value !== "Manual") setDiscount(0);
                      if (option.value !== "SeniorCitizen" && option.value !== "PWD") {
                        setDiscountIdNumber("");
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      discountKind === option.value
                        ? "border-neutral-400 bg-black text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-neutral-300 hover:bg-neutral-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {isStatutoryDiscount ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-700">{discountKind === "PWD" ? "PWD ID:" : "SC ID:"}</span>
                    <input
                      type="text"
                      value={discountIdNumber}
                      onChange={(event) => setDiscountIdNumber(event.target.value)}
                      disabled={!canUse || !!issuedBillingId}
                      placeholder="ID number"
                      className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                    />
                  </label>
                  <span className="rounded bg-neutral-50 px-2 py-1 font-mono text-xs font-bold text-neutral-700">
                    −{peso(effectiveDiscount)}
                  </span>
                  <span className="text-[11px] text-slate-500">VAT exempt · RA 9994 / RA 10754</span>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-700">Manual ₱</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
                      disabled={!canUse || !!issuedBillingId || discountKind === "None"}
                      className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-700">VAT ₱</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tax}
                      onChange={(event) => setTax(Math.max(0, Number(event.target.value) || 0))}
                      disabled={!canUse || !!issuedBillingId}
                      className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                    />
                  </label>
                </div>
              )}

              {discountExceedsSubtotal ? (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-neutral-700">
                  <FaTriangleExclamation className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  Discount exceeds subtotal ({peso(subtotal)}).
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="sticky top-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Cart</h2>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  !issuedBillingId
                    ? "bg-slate-200 text-slate-700"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {!issuedBillingId ? "Building" : "Awaiting Payment"}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto px-3 py-2">
              {validItems.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {/* Implicit consultation line — server adds it but we surface it here so the cashier sees the same total math. */}
                  {selectedAppt ? (
                    <li className="flex items-center justify-between gap-2 py-1.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">Consultation</p>
                        <p className="font-mono text-[10px] text-slate-500">1 × {peso(consultationBaseFee)}</p>
                      </div>
                      <p className="shrink-0 font-mono text-xs font-bold text-slate-900">{peso(consultationBaseFee)}</p>
                    </li>
                  ) : null}
                  {validItems.map((line) => (
                    <li key={line.tempId} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{line.description}</p>
                        <p className="font-mono text-[10px] text-slate-500">{line.quantity} × {peso(line.unit_price)}</p>
                      </div>
                      <p className="shrink-0 font-mono text-xs font-bold text-slate-900">{peso(line.quantity * line.unit_price)}</p>
                    </li>
                  ))}
                </ul>
              ) : selectedAppt ? (
                <p className="py-3 text-center text-xs text-slate-500">
                  Just the consultation so far — add services, medicines, or products above.
                </p>
              ) : (
                <p className="py-3 text-center text-xs text-slate-400">Pick an appointment to start a bill.</p>
              )}
            </div>

            <div className="space-y-1 border-t border-slate-200 bg-slate-50/60 px-3 py-2 font-mono text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span><span>{peso(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  Discount{discountKind === "SeniorCitizen" ? " · SC" : discountKind === "PWD" ? " · PWD" : ""}
                </span>
                <span>-{peso(effectiveDiscount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>VAT{isStatutoryDiscount ? " · exempt" : ""}</span>
                <span>{peso(effectiveTax)}</span>
              </div>
            </div>

            {/* Big total panel — POS-classic dark tile so the eye lands here. */}
            <div className="flex items-baseline justify-between bg-slate-900 px-4 py-3 text-white">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-300">Total Due</span>
              <span className="font-mono text-3xl font-black tabular-nums">{peso(total)}</span>
            </div>

            <div className="space-y-2 px-3 py-3">
              {/* Method selector — disabled until issued. */}
              <div className="grid grid-cols-2 gap-2">
                {POS_PAYMENT_OPTIONS.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    disabled={!issuedBillingId || !method.available}
                    onClick={() => {
                      setPaymentMethod(method.value);
                      if (method.value !== "Cash") setTenderedInput("");
                      if (method.value === "Cash" || method.value === "QR") setPaymentReference("");
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      paymentMethod === method.value
                        ? method.selectedClass
                        : method.available
                          ? `border-slate-300 bg-white text-slate-700 ${method.hoverClass}`
                          : "border-slate-200 bg-slate-100 text-slate-400"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center justify-center rounded-lg ${method.iconClass}`}>
                        {method.icon}
                      </span>
                      {!method.available ? (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          paymentMethod === method.value ? "bg-white/20 text-white" : "bg-white text-neutral-700"
                        }`}>
                          Soon
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-bold">{method.label}</p>
                    <p className={`mt-1 text-[10px] leading-4 ${
                      paymentMethod === method.value ? "text-white/80" : "text-slate-500"
                    }`}>
                      {method.available ? method.detail : method.unavailableNote ?? method.detail}
                    </p>
                  </button>
                ))}
              </div>

              {issuedBillingId ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Payment Entry</span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                      {paymentMethodLabel}
                    </span>
                  </div>

                  {isCash ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Amount received</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={tenderedInput}
                          onChange={(event) => setTenderedInput(event.target.value)}
                          placeholder={total.toFixed(2)}
                          className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-right font-mono text-base font-bold outline-none focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {cashShortcutAmounts.map((amount, index) => (
                          <button
                            key={`${amount}-${index}`}
                            type="button"
                            onClick={() => setTenderedInput(amount.toFixed(2))}
                            className={`rounded border px-1 py-1 text-[10px] font-bold ${
                              index === 0
                                ? "border-neutral-400 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                                : "border-slate-300 bg-white font-mono text-slate-700 hover:bg-neutral-50"
                            }`}
                          >
                            {index === 0 ? `Exact ${amount.toFixed(2)}` : amount.toFixed(2)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount due</p>
                          <p className="mt-1 font-mono text-lg font-black text-slate-900">{peso(total)}</p>
                        </div>
                        <div className="rounded-md bg-slate-900 px-3 py-2 text-white">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                            {tenderShortfall > 0 ? "Short" : "Change"}
                          </p>
                          <p className="mt-1 font-mono text-lg font-black tabular-nums">
                            {tenderShortfall > 0 ? peso(tenderShortfall) : peso(changeDue)}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : isQR ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-[#204884]/20 bg-[#f4f7fc] px-3 py-3 text-sm text-[#204884]">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex h-7 w-14 shrink-0 items-center rounded-md bg-white px-1.5 shadow-xs">
                            <QrPhLogo className="h-auto w-full" />
                          </span>
                          <div>
                            <p className="font-bold">QR Ph via PayMongo</p>
                            <p className="mt-1 text-xs leading-5 text-[#204884]/80">
                              This opens a PayMongo QR Ph checkout that works today for GCash, Maya, and banking apps while direct Card and Transfer activation is still pending.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount due</p>
                          <p className="mt-1 font-mono text-lg font-black text-slate-900">{peso(total)}</p>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Checkout</p>
                          <p className="mt-1 flex items-center gap-1 text-sm font-black text-slate-900">
                            <FaLock className="h-3 w-3" aria-hidden="true" />
                            Secure · PayMongo
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          {getReferenceLabel(paymentMethod)}
                        </span>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(event) => setPaymentReference(event.target.value)}
                          placeholder={getReferencePlaceholder(paymentMethod)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-neutral-300 focus:ring-1 focus:ring-neutral-200"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount due</p>
                          <p className="mt-1 font-mono text-lg font-black text-slate-900">{peso(total)}</p>
                        </div>
                        <div className="rounded-md bg-white px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recorded as</p>
                          <p className="mt-1 font-mono text-sm font-black text-slate-900">{paymentMethodLabel}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {!issuedBillingId ? (
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={openIssueConfirm}
                    disabled={!canUse || isWorking || !selectedApptId || discountExceedsSubtotal}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-black px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    Generate Bill
                    <kbd className="rounded border border-neutral-400 bg-black px-1 font-mono text-[9px] text-neutral-100">F2</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={recordPayment}
                    disabled={isWorking || !canAcceptPayment}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-black px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {isWorking ? "Processing…" : isQR ? "Open QR Ph Checkout" : `Accept ${paymentMethodLabel}`}
                    <kbd className="rounded border border-neutral-400 bg-black px-1 font-mono text-[9px] text-neutral-100">F2</kbd>
                  </button>
                  <Link
                    href={`/payments/receipt/${issuedBillingId}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    <FaReceipt className="h-3 w-3" aria-hidden="true" />
                    View Receipt
                  </Link>
                  <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
                    {isCash
                      ? "Enter the amount received from the patient, confirm the computed change, then accept cash."
                      : isQR
                        ? "This opens PayMongo's QR Ph checkout. When payment succeeds, the bill is finalized automatically when you land back here."
                        : `Enter the ${paymentMethodLabel.toLowerCase()} reference before recording the payment.`}
                  </p>
                  <div className="flex gap-1.5">
                    {canVoid ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVoidReason("");
                          setConfirmingVoid(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <FaBan className="h-3 w-3" aria-hidden="true" />
                        Void
                        <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1 font-mono text-[9px] text-neutral-700">F9</kbd>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      New Bill
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Confirm-issue modal — last gate before a Billing row is created. */}
      {confirmingIssue && selectedAppt ? (
        <ConfirmModal
          title="Confirm new bill"
          tone="sky"
          onClose={() => setConfirmingIssue(false)}
        >
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              Issue a clinic bill for <span className="font-bold">{selectedAppt.patientName}</span>?
            </p>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-slate-700">
              <div className="flex justify-between"><span>Subtotal</span><span>{peso(subtotal)}</span></div>
              <div className="flex justify-between">
                <span>
                  Discount
                  {discountKind === "SeniorCitizen" ? " · SC 20%" : null}
                  {discountKind === "PWD" ? " · PWD 20%" : null}
                </span>
                <span>- {peso(effectiveDiscount)}</span>
              </div>
              <div className="flex justify-between"><span>Tax</span><span>{peso(effectiveTax)}</span></div>
              <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-sm font-bold text-slate-900">
                <span>Total</span><span>{peso(total)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Once issued, line items can no longer be edited from this screen. You can still void the bill if needed.
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingIssue(false)}
              disabled={isWorking}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitIssueBill}
              disabled={isWorking}
              className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-60"
            >
              {isWorking ? "Issuing…" : "Confirm & Issue"}
            </button>
          </div>
        </ConfirmModal>
      ) : null}

      {/* Confirm-void modal — required for both unpaid and paid bills. */}
      {confirmingVoid && issuedBillingId ? (
        <ConfirmModal
          title="Void this bill"
          tone="red"
          onClose={() => setConfirmingVoid(false)}
        >
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              Voiding marks the bill as cancelled. If it was already paid, a refund record is added so the books reconcile.
            </p>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reason (required)</span>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Wrong patient, billed in error"
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingVoid(false)}
              disabled={isWorking}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Keep Bill
            </button>
            <button
              type="button"
              onClick={commitVoid}
              disabled={isWorking || voidReason.trim().length < 4}
              className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-60"
            >
              {isWorking ? "Voiding…" : "Confirm Void"}
            </button>
          </div>
        </ConfirmModal>
      ) : null}
    </div>
  );
}

function ConfirmModal({
  title,
  tone,
  children,
  onClose,
}: {
  title: string;
  tone: "sky" | "red";
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Close on Escape so a panicked cashier always has an out.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const headerClass =
    tone === "red"
      ? "border-neutral-100 bg-neutral-50 text-neutral-800"
      : "border-neutral-100 bg-neutral-50 text-neutral-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-5 py-3 ${headerClass}`}>
          <h3 id="pos-confirm-title" className="text-sm font-bold uppercase tracking-[0.18em]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-500 hover:bg-white/40 hover:text-slate-800"
          >
            <FaXmark className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function AppointmentOption({ appt }: { appt: AppointmentRecord }) {
  return (
    <option value={appt.id}>
      {appt.patientName} - {formatDisplayDate(appt.date)} - {formatRange(appt.start, appt.end)}
    </option>
  );
}

function POSStepCard({
  step,
  title,
  description,
  state,
}: {
  step: number;
  title: string;
  description: string;
  state: "complete" | "current" | "upcoming";
}) {
  const styles = {
    complete: {
      shell: "border-neutral-200 bg-neutral-50/70",
      badge: "bg-black text-white",
      title: "text-neutral-800",
      body: "text-neutral-700/80",
    },
    current: {
      shell: "border-slate-900 bg-slate-900",
      badge: "bg-white text-slate-900",
      title: "text-white",
      body: "text-slate-300",
    },
    upcoming: {
      shell: "border-slate-200 bg-slate-50",
      badge: "bg-white text-slate-500",
      title: "text-slate-700",
      body: "text-slate-500",
    },
  }[state];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${styles.shell}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${styles.badge}`}>
          {step}
        </span>
        <h3 className={`text-sm font-bold ${styles.title}`}>{title}</h3>
      </div>
      <p className={`mt-2 text-xs leading-5 ${styles.body}`}>{description}</p>
    </div>
  );
}



