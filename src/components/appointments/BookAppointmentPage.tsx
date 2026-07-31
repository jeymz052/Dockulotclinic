"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState, useEffect, useTransition, type ChangeEvent, type ReactNode } from "react";
import {
  FaQrcode,
  FaCircleXmark,
  FaBolt,
  FaClipboardList,
  FaHospital,
  FaVideo,
  FaCreditCard,
  FaLock,
  FaUser,
  FaCircleCheck,
  FaCheck,
  FaArrowRotateLeft,
  FaArrowLeft,
  FaArrowRight,
  FaCcVisa,
  FaCcMastercard,
  FaCcJcb,
  FaBuildingColumns,
} from "react-icons/fa6";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  encodeAppointmentContext,
  getDefaultServiceForType,
  getServiceOptionsForType,
} from "@/src/lib/appointment-context";
import { aftercareGuides, clinicServices, consentGuide } from "@/src/lib/healthcare-content";
import {
  addDays,
  formatDisplayDate,
  formatRange,
  getDoctorById,
  getWeekDates,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import { formatDurationLabel } from "@/src/lib/consultation-pricing";

type BookingForm = {
  patientStatus: BookingPatientStatus;
  service: string;
  clinicId: string;
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
  symptoms: string;
  durationMinutes: "60";
  paymentOption: OnlinePaymentOption;
};

type BookingPatientStatus = "Existing" | "New";

type BookingClinicOption = {
  value: string;
  label: string;
  note: string;
};

type UploadedConcernFile = {
  file_name: string;
  file_type: string;
  file_url: string;
};

const MAX_CONCERN_FILES = 3;
const MAX_CONCERN_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CONCERN_FILE_SIZE_LABEL = "10 MB";

const BOOKING_VISIT_OPTIONS: Array<{
  type: AppointmentType;
  label: string;
  helper: string;
}> = [
  {
    type: "Online",
    label: "Virtual Consult",
    helper: "Video call from home. Pay online before the session.",
  },
  {
    type: "Clinic",
    label: "Clinic Visit",
    helper: "In-person visit at the clinic. Pay at the front desk.",
  },
];

const BOOKING_CLINICS: BookingClinicOption[] = [
  {
    value: "premier-medical-center",
    label: "Premier Medical Center",
    note: "Room 420, Tuesday / Thursday / Saturday",
  },
  {
    value: "fammed-family-clinic",
    label: "FamMed Family Clinic",
    note: "Arquiza Building, Pasobolong, Zamboanga City. Fridays only.",
  },
  {
    value: "rt-lim-family-hospital",
    label: "RT Lim Family Hospital",
    note: "Room 4, every 1st and 3rd Sunday of the month.",
  },
];

const PROCEDURE_SERVICE_TITLES = new Set(
  clinicServices.filter((service) => service.appointmentOnly).map((service) => service.title),
);

type OnlinePaymentOption = "paymongo_gcash" | "paymongo_card" | "paymongo_bank";

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "doctora-kulot-md";

const INITIAL_FORM: BookingForm = {
  patientStatus: "New",
  service: getDefaultServiceForType("Clinic"),
  clinicId: BOOKING_CLINICS[0].value,
  patientName: "",
  email: "",
  phone: "",
  doctorId: DEFAULT_DOCTOR_ID,
  date: today,
  start: "",
  type: "Clinic",
  reason: "",
  symptoms: "",
  durationMinutes: "60",
  paymentOption: "paymongo_gcash",
};

type OnlinePaymentOptionConfig = {
  value: OnlinePaymentOption;
  label: string;
  detail: string;
  // Tailwind utility classes for the logo tile background + ring colour shown
  // in the selected state, so each option keeps its own brand accent.
  accent: {
    tileBg: string;
    ring: string;
    selectedBorder: string;
    selectedBg: string;
  };
  brands: Array<{ key: string; node: React.ReactNode }>;
  logo: React.ReactNode;
  // `available: false` keeps the option visible but disabled, with a "Not yet
  // available" badge. Flip to true once PayMongo activates the underlying
  // method on the merchant account (see comments in
  // src/lib/services/paymongo.ts for the full activation flip-list).
  available: boolean;
  // Optional explanation shown in the disabled state — kept short so the
  // button doesn't grow taller when toggled off.
  unavailableNote?: string;
};

// NOTE: only `paymongo_gcash` is activated today — it routes to PayMongo's
// QR Ph rail, which is universally scannable by GCash, Maya, and any
// InstaPay / Pesonet-enabled wallet or bank app. Card and Online Bank
// Transfer stay visible (with brand chips) but disabled, so patients can
// see what's coming and staff have a clear "flip to true" once PayMongo
// activates those methods on the merchant account. See the activation
// flip-list in src/lib/services/paymongo.ts.
const ONLINE_PAYMENT_OPTIONS: OnlinePaymentOptionConfig[] = [
  {
    value: "paymongo_gcash",
    label: "QR Ph (GCash, Maya, Banks)",
    detail: "Scan the QR with GCash, Maya, or any InstaPay/Pesonet-enabled wallet or bank app.",
    accent: {
      tileBg: "bg-linear-to-br from-yellow-300 to-yellow-400",
      ring: "ring-yellow-300",
      selectedBorder: "border-yellow-300",
      selectedBg: "bg-yellow-50/60",
    },
    logo: <GCashLogo />,
    brands: [
      {
        key: "qrph",
        node: (
          <BrandChip className="bg-yellow-100 text-yellow-700">
            <FaQrcode className="h-3 w-3" /> QR Ph
          </BrandChip>
        ),
      },
      { key: "gcash", node: <BrandChip className="bg-yellow-100 text-yellow-700">GCash</BrandChip> },
      { key: "maya", node: <BrandChip className="bg-yellow-100 text-yellow-700">Maya</BrandChip> },
      { key: "banks", node: <BrandChip className="bg-slate-100 text-slate-700">+ Banks</BrandChip> },
    ],
    available: true,
  },
  {
    value: "paymongo_card",
    label: "Credit / Debit Card",
    detail: "Pay with Visa, Mastercard, or JCB through PayMongo's secure checkout.",
    accent: {
      tileBg: "bg-linear-to-br from-slate-800 to-slate-950",
      ring: "ring-slate-300",
      selectedBorder: "border-slate-800",
      selectedBg: "bg-slate-50",
    },
    logo: <CardLogo />,
    brands: [
      {
        key: "visa",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcVisa className="h-5 w-auto text-[#451a03]" />
          </span>
        ),
      },
      {
        key: "mc",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcMastercard className="h-5 w-auto text-[#737373]" />
          </span>
        ),
      },
      {
        key: "jcb",
        node: (
          <span className="inline-flex items-center justify-center h-7 w-11 rounded-md bg-white border border-slate-200 shadow-xs">
            <FaCcJcb className="h-5 w-auto text-[#78350f]" />
          </span>
        ),
      },
    ],
    available: false,
    unavailableNote: "Card payments are pending PayMongo activation — please use QR Ph for now.",
  },
  {
    value: "paymongo_bank",
    label: "Online Bank Transfer",
    detail: "Pay directly from your online banking — BPI, UnionBank, RCBC, Chinabank and more.",
    accent: {
      tileBg: "bg-linear-to-br from-yellow-300 to-yellow-400",
      ring: "ring-yellow-300",
      selectedBorder: "border-yellow-300",
      selectedBg: "bg-yellow-50/60",
    },
    logo: <BankLogo />,
    brands: [
      { key: "bpi", node: <BrandChip className="bg-yellow-100 text-yellow-800">BPI</BrandChip> },
      { key: "ubp", node: <BrandChip className="bg-yellow-100 text-yellow-700">UnionBank</BrandChip> },
      { key: "rcbc", node: <BrandChip className="bg-yellow-100 text-yellow-700">RCBC</BrandChip> },
      {
        key: "chinabank",
        node: <BrandChip className="bg-yellow-100 text-yellow-800">Chinabank</BrandChip>,
      },
      { key: "more", node: <BrandChip className="bg-slate-100 text-slate-700">+ more</BrandChip> },
    ],
    available: false,
    unavailableNote: "Direct bank transfer is pending PayMongo activation — please use QR Ph (your bank app can scan it).",
  },
];

function BrandChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function GCashLogo() {
  // Stylised GCash brand mark — blue gradient tile with a stylised "G".
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-yellow-300 to-yellow-400 shadow-md">
      <span className="text-lg font-black tracking-tight text-white">G</span>
      <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-yellow-200">
        <FaQrcode className="h-3 w-3 text-yellow-600" />
      </span>
    </span>
  );
}

function CardLogo() {
  // Generic card-shape logo tile with two stripes evoking a chip card.
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-slate-800 to-slate-950 shadow-md">
      <svg
        viewBox="0 0 32 24"
        fill="none"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="1" y="3" width="30" height="18" rx="3" stroke="white" strokeWidth="1.5" />
        <rect x="1" y="7.5" width="30" height="3" fill="white" />
        <rect x="5" y="14" width="8" height="2" rx="0.5" fill="white" opacity="0.85" />
        <rect x="5" y="17" width="5" height="1.5" rx="0.5" fill="white" opacity="0.6" />
      </svg>
    </span>
  );
}

function BankLogo() {
  // Bank columns icon on blue gradient.
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-yellow-300 to-yellow-400 shadow-md">
      <FaBuildingColumns className="h-6 w-6 text-white" />
    </span>
  );
}

function getAppointmentTypeLabel(type: AppointmentType) {
  return type === "Clinic" ? "Clinic Visit" : "Virtual Consult";
}

// Inline icon + label used inside summary rows to identify the visit type
// without resorting to emojis.
function VisitTypeValue({ type }: { type: AppointmentType }) {
  if (type === "Clinic") {
    return (
      <>
        <FaHospital className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
        Clinic Visit
      </>
    );
  }
  return (
    <>
      <FaVideo className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
      Virtual Consult
    </>
  );
}

function paymentOptionLabel(option: OnlinePaymentOption) {
  return ONLINE_PAYMENT_OPTIONS.find((item) => item.value === option)?.label ?? "Online payment";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function isPreviewableImage(file: UploadedConcernFile) {
  return file.file_type.startsWith("image/") && file.file_url.startsWith("data:image/");
}

function resolveAftercareGuide(serviceTitle: string) {
  const normalized = serviceTitle.toLowerCase();
  if (normalized.includes("glp")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("glp")) ?? null;
  }
  if (normalized.includes("botox")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("botox")) ?? null;
  }
  if (normalized.includes("sclerotherapy")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("sclerotherapy")) ?? null;
  }
  if (normalized.includes("wart") || normalized.includes("cautery") || normalized.includes("skin tag")) {
    return aftercareGuides.find((guide) => guide.title.toLowerCase().includes("wart")) ?? null;
  }
  return null;
}

export default function BookAppointmentPage() {
  const pathname = usePathname();
  const requiresAuthForReview = pathname === "/";
  const { accessToken, role, user, profile } = useRole();
  const { setAppointments, isLoading, error } = useAppointments();
  const { doctors } = useDoctors();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [uploadedConcernFiles, setUploadedConcernFiles] = useState<UploadedConcernFile[]>([]);
  const [procedureConsentAccepted, setProcedureConsentAccepted] = useState(false);
  const [procedureConsentSignature, setProcedureConsentSignature] = useState("");
  const [procedureAftercareAcknowledged, setProcedureAftercareAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [visibleWeekStart, setVisibleWeekStart] = useState(today);

  const primaryDoctor = doctors[0] ?? null;
  const activeDoctorId = primaryDoctor?.slug ?? DEFAULT_DOCTOR_ID;
  const selectedDoctor = primaryDoctor ?? getDoctorById(activeDoctorId);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(activeDoctorId, formData.date, formData.type);
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;
  const serviceOptions = useMemo(() => getServiceOptionsForType(formData.type), [formData.type]);
  const isProcedureBooking = PROCEDURE_SERVICE_TITLES.has(formData.service);
  const requiresPayMongoCheckout = formData.type === "Online" || isProcedureBooking;
  const selectedSlotDuration = selectedSlot
    ? formatDurationLabel(selectedSlot.start, selectedSlot.end)
    : "1 hr";
  const selectedAftercareGuide = useMemo(() => resolveAftercareGuide(formData.service), [formData.service]);

  const BOOKING_STEP_LABELS = [
    "Patient Type",
    "Visit & Info",
    "Date & Time",
    "Review & Payment",
  ] as const;

  const calendarWeekStart = useMemo(() => {
    const datesInView = getWeekDates(visibleWeekStart);
    const lastDateInView = datesInView[datesInView.length - 1];
    if (formData.date < visibleWeekStart || formData.date > lastDateInView) {
      return formData.date;
    }
    return visibleWeekStart;
  }, [formData.date, visibleWeekStart]);
  const weekDates = useMemo(() => getWeekDates(calendarWeekStart), [calendarWeekStart]);
  const [activeStep, setActiveStep] = useState(1);

  // Restore any saved draft / reservation after auth or page reload.
  // We mark the very first restore so the write-side effect below doesn't
  // overwrite the saved draft with `INITIAL_FORM` before we've had a chance
  // to read it.
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bookingDraft");
      if (raw) {
        const parsed = JSON.parse(raw) as { formData?: Partial<BookingForm>; activeStep?: number };
        if (parsed?.formData) {
          setFormData((cur) => {
            const nextType = parsed.formData?.type ?? cur.type;
            return {
              ...cur,
              ...parsed.formData,
              service: parsed.formData?.service ?? getDefaultServiceForType(nextType),
            };
          });
        }
        if (parsed?.activeStep) {
        if (requiresAuthForReview && parsed.activeStep === 4 && !accessToken) {
          setActiveStep(3);
        } else {
          setActiveStep(parsed.activeStep);
        }
        }
      }
      const reservationId = localStorage.getItem("bookingReservation");
      if (reservationId) {
        setFeedback({ message: "We held your selected slot — please sign in to complete booking.", type: "success" });
      }
    } catch {
      // ignore
    } finally {
      setHasRestoredDraft(true);
    }
  }, [accessToken, requiresAuthForReview]);

  // Persist the draft as the user types so it survives tab switches, hard
  // refreshes, redirects to /login, and the PayMongo round-trip back to the
  // app. We only start writing AFTER the restore-from-localStorage effect
  // has run — otherwise the first render would clobber the saved draft with
  // `INITIAL_FORM`. The success/reset paths in handleSubmit explicitly
  // remove `bookingDraft`, so a finished booking won't pre-fill the next.
  useEffect(() => {
    if (!hasRestoredDraft) return;
    if (typeof window === "undefined") return;
    try {
      // Don't bother persisting an empty form (avoids leaving stale data
      // for a user who only opened the page and walked away).
      const isEmptyDraft =
        !formData.patientName.trim()
        && !formData.email.trim()
        && !formData.phone.trim()
        && !formData.start
        && !formData.reason.trim();
      if (isEmptyDraft && activeStep === 1) {
        localStorage.removeItem("bookingDraft");
        return;
      }
      localStorage.setItem(
        "bookingDraft",
        JSON.stringify({ formData, activeStep }),
      );
    } catch {
      // Quota errors / private mode → ignore, the in-memory state still works.
    }
  }, [formData, activeStep, hasRestoredDraft]);

  const patientDefaults = useMemo(
    () => ({
      patientName:
        profile?.full_name?.trim() ||
        user?.user_metadata?.full_name ||
        "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
    }),
    [profile, user],
  );
  const effectivePatientName =
    formData.patientStatus === "Existing" && role === "PATIENT"
      ? formData.patientName || patientDefaults.patientName
      : formData.patientName;
  const effectivePatientEmail =
    formData.patientStatus === "Existing" && role === "PATIENT"
      ? formData.email || patientDefaults.email
      : formData.email;
  const effectivePatientPhone =
    formData.patientStatus === "Existing" && role === "PATIENT"
      ? formData.phone || patientDefaults.phone
      : formData.phone;
  const selectedClinic = BOOKING_CLINICS.find((clinic) => clinic.value === formData.clinicId) ?? BOOKING_CLINICS[0];
  const consentSignatureMatches =
    procedureConsentSignature.trim().length > 0
    && procedureConsentSignature.trim().toLowerCase() === effectivePatientName.trim().toLowerCase();
  const canConfirmProcedure =
    !isProcedureBooking
    || (procedureConsentAccepted && procedureAftercareAcknowledged && consentSignatureMatches);

  const step1Valid = !!formData.patientStatus;
  const step2Valid =
    !!formData.type
    && !!formData.service.trim()
    && !!effectivePatientName.trim()
    && !!effectivePatientEmail.trim()
    && !!effectivePatientPhone.trim();
  const datePicked = !!formData.date && !blockedReason;
  const step3Valid = datePicked && !!formData.start;
  const step4Done = step1Valid && step2Valid && step3Valid && canConfirmProcedure;

  function canAccessStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) return step1Valid;
    if (step === 3) return step1Valid && step2Valid;
    if (step === 4) return step1Valid && step2Valid && step3Valid;
    return false;
  }

  function goToStep(step: number) {
    if (step < 1 || step > BOOKING_STEP_LABELS.length) return;
    if (!canAccessStep(step)) return;
    setActiveStep(step);
  }

  function goNext() {
    if (activeStep === 1 && step1Valid) goToStep(2);
    else if (activeStep === 2 && step2Valid) goToStep(3);
    else if (activeStep === 3 && step3Valid) {
      goToStep(4);
    }
  }

  function goBack() {
    if (activeStep > 1) setActiveStep((s) => s - 1);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };
      if (field === "patientStatus") {
        nextState.patientName = value === "Existing" && role === "PATIENT" ? patientDefaults.patientName : current.patientName;
        nextState.email = value === "Existing" && role === "PATIENT" ? patientDefaults.email : current.email;
        nextState.phone = value === "Existing" && role === "PATIENT" ? patientDefaults.phone : current.phone;
      }
      if (field === "doctorId" || field === "date" || field === "type") {
        nextState.start = "";
      }
      if (field === "type") {
        nextState.service = getDefaultServiceForType(value as AppointmentType);
        if (value === "Clinic") {
          nextState.clinicId = BOOKING_CLINICS[0].value;
        }
        if (value !== "Online") {
          nextState.symptoms = "";
        }
        setProcedureConsentAccepted(false);
        setProcedureConsentSignature("");
        setProcedureAftercareAcknowledged(false);
      }
      if (field === "service") {
        setProcedureConsentAccepted(false);
        setProcedureConsentSignature("");
        setProcedureAftercareAcknowledged(false);
      }
      return nextState;
    });
    if (field === "type" && value !== "Online") {
      setUploadedConcernFiles([]);
    }
    setFeedback(null);
  }

  async function handleConcernFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (uploadedConcernFiles.length + files.length > MAX_CONCERN_FILES) {
      setFeedback({
        message: `You can upload up to ${MAX_CONCERN_FILES} concern files or photos.`,
        type: "error",
      });
      event.target.value = "";
      return;
    }

    try {
      const nextFiles: UploadedConcernFile[] = [];
      for (const file of files) {
        if (file.size > MAX_CONCERN_FILE_SIZE_BYTES) {
          throw new Error(`${file.name} is too large. Please keep each file under ${MAX_CONCERN_FILE_SIZE_LABEL}.`);
        }
        const fileUrl = await readFileAsDataUrl(file);
        nextFiles.push({
          file_name: file.name,
          file_type: file.type || "attachment",
          file_url: fileUrl,
        });
      }
      setUploadedConcernFiles((current) => [...current, ...nextFiles]);
      setFeedback(null);
    } catch (fileError) {
      setFeedback({
        message: fileError instanceof Error ? fileError.message : "Unable to attach the selected file.",
        type: "error",
      });
    } finally {
      event.target.value = "";
    }
  }

  function removeConcernFile(index: number) {
    setUploadedConcernFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  async function startCheckoutPayment() {
    if (!accessToken) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const reservationId = typeof window !== "undefined" ? localStorage.getItem("bookingReservation") : null;

    const checkoutRes = await fetch("/api/v2/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        reason: encodeAppointmentContext(formData.service, formData.reason),
        type: formData.type,
        patientStatus: formData.patientStatus,
        service: formData.service,
        reservation_id: reservationId ?? undefined,
        payment_option: formData.paymentOption,
      }),
    });

    const payload = (await checkoutRes.json().catch(() => ({}))) as {
      url?: string | null;
      message?: string;
      reservation_id?: string;
      checkout_mode?: "redirect" | "manual";
      instructions?: string;
      payment_reference?: string;
    };
    if (!checkoutRes.ok) {
      throw new Error(payload.message ?? "Unable to start online payment.");
    }

    if (payload.reservation_id) {
      try {
        localStorage.setItem("bookingReservation", payload.reservation_id);
        if (formData.type === "Online") {
          sessionStorage.setItem(
            "pendingOnlineConsultationDraft",
            JSON.stringify({
              reservationId: payload.reservation_id,
              concern: formData.reason,
              symptoms: formData.symptoms,
              files: uploadedConcernFiles,
            }),
          );
        }
      } catch {
        // ignore storage errors
      }
    }

    return payload;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep !== 4) return;
    
    // CRITICAL: Block submission without authentication
    if (!accessToken || !user || !profile) {
      console.warn("[BookAppointment] Submission blocked: not authenticated", { accessToken: !!accessToken, user: !!user, profile: !!profile });
      setFeedback({ message: "You must sign in or create an account to complete your booking.", type: "error" });
      return;
    }

    startSubmitTransition(async () => {
      if (requiresPayMongoCheckout) {
        try {
          const paymentStart = await startCheckoutPayment();
          if (paymentStart.checkout_mode === "manual") {
            try {
              localStorage.removeItem("bookingDraft");
            } catch {
              // ignore storage errors
            }

            setFeedback({
              message: paymentStart.payment_reference
                ? `Bank transfer request created. Reference ${paymentStart.payment_reference}. ${paymentStart.instructions ?? "Wait for clinic staff to verify your payment before the appointment is confirmed."}`
                : paymentStart.instructions ?? "Bank transfer request created. Wait for clinic staff to verify your payment before the appointment is confirmed.",
              type: "success",
            });
            setFormData({
              ...INITIAL_FORM,
              doctorId: activeDoctorId,
              type: formData.type,
              service: getDefaultServiceForType(formData.type),
            });
            setUploadedConcernFiles([]);
            setProcedureConsentAccepted(false);
            setProcedureConsentSignature("");
            setProcedureAftercareAcknowledged(false);
            setVisibleWeekStart(today);
            setActiveStep(1);
            return;
          }

          if (!paymentStart.url) {
            throw new Error("Payment checkout link was not returned.");
          }

          window.location.href = paymentStart.url;
        } catch (paymentError) {
          setFeedback({
            message: paymentError instanceof Error ? paymentError.message : "Unable to start online payment.",
            type: "error",
          });
        }
        return;
      }

      const result = await createAppointmentAction(accessToken, {
        patientName: effectivePatientName,
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        doctorId: activeDoctorId,
        date: formData.date,
        start: formData.start,
        type: formData.type,
        reason: encodeAppointmentContext(formData.service, formData.reason),
        patientStatus: formData.patientStatus,
      });

      setAppointments(result.appointments);

      if (!result.ok) {
        setFeedback({ message: result.message, type: "error" });
        return;
      }
      setFormData({
        ...INITIAL_FORM,
        type: formData.type,
        service: getDefaultServiceForType(formData.type),
        doctorId: activeDoctorId,
      });
      setUploadedConcernFiles([]);
      setProcedureConsentAccepted(false);
      setProcedureConsentSignature("");
      setProcedureAftercareAcknowledged(false);
      setVisibleWeekStart(today);
      setActiveStep(1);
      try {
        localStorage.removeItem("bookingDraft");
        localStorage.removeItem("bookingReservation");
        sessionStorage.removeItem("pendingOnlineConsultationDraft");
      } catch {
        // ignore storage errors
      }
      setFeedback({
        message: `Booked! ${result.appointment.patientName} with ${selectedDoctor?.name ?? "doctor"} on ${formatDisplayDate(result.appointment.date)} at ${formatRange(result.appointment.start, result.appointment.end)}. Queue #${result.appointment.queueNumber}.${result.appointment.status === "Pending"
          ? " Clinic appointment submitted for approval."
          : formData.type === "Clinic"
            ? " Clinic appointment confirmed."
            : ""}`,
        type: "success",
      });
    });
  }

  return (
    <div className="space-y-6 overflow-x-hidden pb-8">
      <div className="rounded-3xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-[0_18px_45px_rgba(17,17,17,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-700">Book Appointment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Schedule a {formData.type === "Online" ? "virtual consult" : "clinic visit"} with{" "}
              {selectedDoctor?.name?.replace(/^Dra\.\s*/, "Dra. ") ?? "your doctor"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {accessToken
                ? "Pick a service, choose a slot, and confirm in four quick steps."
                : "Browse services and slots freely — sign in only when you're ready to confirm."}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-semibold text-yellow-700 lg:self-center">
            {formData.type === "Clinic" ? (
              <FaHospital className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {getAppointmentTypeLabel(formData.type)}
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "border border-yellow-200 bg-yellow-50 text-yellow-700"
            : "border border-yellow-200 bg-yellow-50 text-yellow-800"
        }`}>
          {feedback.type === "success"
            ? <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden="true" />
            : <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden="true" />}
          <span>{feedback.message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">{error}</div>
      ) : null}
      {availabilityError ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">{availabilityError}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="rounded-4xl border border-yellow-100 bg-white/95 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)] backdrop-blur sm:p-5">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
          >
              <>
                {formData.type === "Clinic" ? (
                  <FaHospital className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
                ) : (
                  <FaVideo className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />
                )}
                {getAppointmentTypeLabel(formData.type)}
              </>
          </HorizontalBookingStepper>
          {activeStep === 1 ? (
            <>
              <section className="rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-700">Step 1 of 4</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Are you an existing patient?</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      To request a virtual or face-to-face appointment, please choose how the clinic should handle your booking.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["Existing", "New"] as BookingPatientStatus[]).map((status) => {
                    const selected = formData.patientStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateForm("patientStatus", status)}
                        aria-pressed={selected}
                        className={`group overflow-hidden rounded-2xl border p-5 text-left transition ${
                          selected
                            ? "border-yellow-300 bg-yellow-50 shadow-[0_12px_28px_rgba(17,17,17,0.16)] ring-2 ring-yellow-200 ring-offset-1"
                            : "border-yellow-100 bg-white hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-[0_12px_24px_rgba(17,17,17,0.10)]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                              selected ? "bg-white text-yellow-700 shadow-sm" : "bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100"
                            }`}
                            aria-hidden="true"
                          >
                            {status === "Existing" ? <FaCheck className="h-6 w-6" /> : <FaUser className="h-6 w-6" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-lg font-bold ${selected ? "text-slate-900" : "text-slate-800"}`}>
                                {status === "Existing" ? "I Already Have a Doc Kulot Record" : "I'm a New Patient"}
                              </p>
                              {selected ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" /> Selected
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 rounded-full border border-yellow-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-700">
                                  Choose
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-600 leading-snug">
                              {status === "Existing"
                                ? "Choose this if you already have records before with Doc Kulot, whether you are an old patient or a regular returning patient."
                                : "Choose this if you do not have any patient record yet with Doc Kulot."
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </section>

              <WizardNav showBack={false} onNext={goNext} nextDisabled={!step1Valid} nextLabel="Next: Visit Type" />
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-700">Step 2 of 4</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Visit Selection and Patient Information</h2>
                    <p className="mt-1 text-sm text-slate-600">Choose the appointment type first, then confirm your contact details.</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-semibold text-yellow-700">
                      <span className="h-2 w-2 rounded-full bg-yellow-300" />
                      All fields required
                    </div>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {BOOKING_VISIT_OPTIONS.map((option) => {
                    const selected = formData.type === option.type;
                    const Icon = option.type === "Clinic" ? FaHospital : FaVideo;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => updateForm("type", option.type)}
                        aria-pressed={selected}
                        className={`group overflow-hidden rounded-2xl border p-5 text-left transition ${
                          selected
                            ? "border-yellow-300 bg-yellow-50 shadow-[0_12px_28px_rgba(17,17,17,0.16)] ring-2 ring-yellow-200 ring-offset-1"
                            : "border-yellow-100 bg-white hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-[0_12px_24px_rgba(17,17,17,0.10)]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                              selected ? "bg-white text-yellow-700 shadow-sm" : "bg-yellow-50 text-yellow-700 group-hover:bg-yellow-100"
                            }`}
                            aria-hidden="true"
                          >
                            <Icon className="h-6 w-6" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-lg font-bold ${selected ? "text-slate-900" : "text-slate-800"}`}>{option.label}</p>
                              {selected ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" /> Selected
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 rounded-full border border-yellow-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-700">
                                  Choose
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-600 leading-snug">{option.helper}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {formData.type === "Clinic" ? (
                  <div className="mt-8 rounded-2xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-700">Which clinic and schedule is most convenient for you?</p>
                        <p className="mt-1 text-sm text-slate-600">Select the clinic location that matches your visit.</p>
                      </div>
                      <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-700">
                        Required
                      </span>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="clinicId" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                        Select clinic
                      </label>
                      <select
                        id="clinicId"
                        value={formData.clinicId}
                        onChange={(event) => updateForm("clinicId", event.target.value)}
                        className="w-full cursor-pointer rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200"
                      >
                        {BOOKING_CLINICS.map((clinic) => (
                          <option key={clinic.value} value={clinic.value}>
                            {clinic.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 rounded-[1.25rem] border border-yellow-100 bg-yellow-50/60 px-4 py-3 text-sm text-slate-600">
                      <p className="font-semibold text-slate-700">{selectedClinic.label}</p>
                      <p className="mt-2 text-slate-500">{selectedClinic.note}</p>
                    </div>
                  </div>
                ) : null}
                <div className="mt-8 rounded-2xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-700">Type of Service</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Choose the main service for this {formData.type === "Online" ? "online consultation" : "clinic visit"}.
                      </p>
                    </div>
                    <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-yellow-700">
                      Required
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {serviceOptions.map((service) => {
                      const selected = formData.service === service;
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => updateForm("service", service)}
                          aria-pressed={selected}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? "border-yellow-300 bg-yellow-50 shadow-[0_12px_24px_rgba(17,17,17,0.12)] ring-2 ring-yellow-100"
                              : "border-yellow-100 bg-white hover:border-yellow-300 hover:bg-yellow-50/70"
                          }`}
                        >
                          <p className="text-sm font-bold text-slate-900">{service}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="fullname" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Full Name *</label>
                    <input 
                      id="fullname"
                      type="text" 
                      value={effectivePatientName} 
                      onChange={(e) => updateForm("patientName", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200" 
                      placeholder="e.g., Juan Dela Cruz" 
                      autoComplete="name" 
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Email *</label>
                    <input 
                      id="email"
                      type="email" 
                      value={effectivePatientEmail} 
                      onChange={(e) => updateForm("email", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200" 
                      placeholder="juan@email.com" 
                      autoComplete="email" 
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Phone *</label>
                    <input 
                      id="phone"
                      type="tel" 
                      value={effectivePatientPhone} 
                      onChange={(e) => updateForm("phone", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200" 
                      placeholder="+63 912 345 6789" 
                      autoComplete="tel" 
                    />
                  </div>
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="reason" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {formData.type === "Online" ? "Concern / Chief Complaint" : "Reason for Visit"} <span className="font-normal text-slate-500">(Optional)</span>
                    </label>
                    <input 
                      id="reason"
                      type="text" 
                      value={formData.reason} 
                      onChange={(e) => updateForm("reason", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200" 
                      placeholder={formData.type === "Online" ? "e.g., headache, cough, medication concern" : "e.g., Follow-up checkup, Dental cleaning, Consultation"} 
                    />
                  </div>
                  {formData.type === "Online" ? (
                    <>
                      <div className="lg:col-span-3 sm:col-span-2">
                        <label htmlFor="symptoms" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Symptoms / Additional Details</label>
                        <textarea
                          id="symptoms"
                          value={formData.symptoms}
                          onChange={(e) => updateForm("symptoms", e.target.value)}
                          className="min-h-28 w-full rounded-[1.2rem] border border-yellow-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-yellow-400 focus:bg-yellow-50/30 focus:ring-4 focus:ring-yellow-200"
                          placeholder="Share symptoms, duration, medications taken, temperature, blood pressure, or anything the doctor should review before the session."
                        />
                      </div>
                      <div className="lg:col-span-3 sm:col-span-2">
                        <label htmlFor="concern-files" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                          Upload File / Photo <span className="font-normal text-slate-500">(Optional, up to {MAX_CONCERN_FILES} files, {MAX_CONCERN_FILE_SIZE_LABEL} each)</span>
                        </label>
                        <input
                          id="concern-files"
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          multiple
                          onChange={handleConcernFilesSelected}
                          className="w-full rounded-[1.2rem] border border-dashed border-yellow-200 bg-yellow-50/40 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200"
                        />
                        {uploadedConcernFiles.some((file) => isPreviewableImage(file)) ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {uploadedConcernFiles.map((file, index) =>
                              isPreviewableImage(file) ? (
                                <div
                                  key={`${file.file_name}-preview-${index}`}
                                  className="overflow-hidden rounded-[1.1rem] border border-yellow-200 bg-white shadow-sm"
                                >
                                  <div className="aspect-[4/3] bg-yellow-50">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={file.file_url}
                                      alt={file.file_name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                                    <p className="truncate text-xs font-semibold text-slate-700" title={file.file_name}>
                                      {file.file_name}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => removeConcernFile(index)}
                                      className="shrink-0 rounded-full border border-yellow-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-50"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ) : null,
                            )}
                          </div>
                        ) : null}
                        {uploadedConcernFiles.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {uploadedConcernFiles.map((file, index) => (
                              <button
                                key={`${file.file_name}-${index}`}
                                type="button"
                                onClick={() => removeConcernFile(index)}
                                className="rounded-full border border-yellow-200 bg-white px-3 py-1.5 text-xs font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-50"
                              >
                                {file.file_name} ×
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step2Valid} nextLabel="Continue to Date & Time" />
            </>
          ) : null}

          {activeStep === 3 ? (
            <>
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_24rem]">
                <div className="space-y-5">
                  <div className="rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-700">Step 3 of 4</p>
                        <h2 className="mt-2 text-xl font-bold text-slate-900">Select Date & Time</h2>
                        <p className="mt-1 text-sm text-slate-600">Choose your preferred appointment date and time slot</p>
                      </div>
                      {nextAvailableSlot ? (
                        <button
                          type="button"
                          onClick={() => {
                            updateForm("date", nextAvailableSlot.date);
                            updateForm("start", nextAvailableSlot.slot.start);
                          }}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-100"
                        >
                          <FaBolt className="h-3 w-3 text-yellow-400" aria-hidden="true" />
                          Next: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 rounded-[1.75rem] border border-yellow-100 bg-[linear-gradient(180deg,#fafafa_0%,#f5f5f5_100%)] p-5">
                      <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700">Calendar Selection</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={calendarWeekStart <= today}
                            className="rounded-full border border-yellow-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(calendarWeekStart, 7))}
                            className="rounded-full border border-yellow-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        {weekDates.map((date) => {
                          const localDate = new Date(`${date}T00:00:00`);
                          const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(localDate);
                          const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(localDate);
                          const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(localDate);
                          const isSelected = formData.date === date;
                          const isToday = date === today;
                          const isPast = date < today;
                          return (
                            <button
                              key={date}
                              type="button"
                              disabled={isPast}
                              onClick={() => updateForm("date", date)}
                              aria-pressed={isSelected}
                              className={`relative rounded-xl border px-2.5 py-2.5 text-center transition ${
                                  isSelected
                                    ? "border-yellow-300 bg-black text-white shadow-[0_10px_22px_rgba(17,17,17,0.22)]"
                                    : isPast
                                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                                    : "border-yellow-100 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-yellow-300 hover:bg-yellow-50/70"
                                }`}
                            >
                                {isToday && !isSelected ? (
                                  <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-yellow-300" aria-hidden="true" />
                                ) : null}
                              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isSelected ? "text-white/90" : "text-slate-500"}`}>
                                {dayLabel}
                              </p>
                              <p className={`mt-1 text-xl font-black leading-none ${isSelected ? "text-white" : isPast ? "text-slate-400" : "text-slate-900"}`}>
                                {dayNum}
                              </p>
                              <p className={`mt-1 text-[10px] font-medium ${isSelected ? "text-white/85" : "text-slate-500"}`}>
                                {isToday ? "Today" : monthLabel}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-yellow-100">
                        <label htmlFor="datepicker" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Or pick a specific date</label>
                        <input 
                          id="datepicker"
                          type="date" 
                          value={formData.date}
                          min={today}
                          onChange={(e) => updateForm("date", e.target.value)}
                          className="w-full cursor-pointer rounded-[1.1rem] border border-yellow-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 sm:w-auto"
                        />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-5 rounded-[1.4rem] border border-yellow-200 bg-yellow-50 px-4 py-3.5 text-sm text-yellow-700 shadow-sm font-medium">
                        {blockedReason}
                      </div>
                    ) : null}
                  </div>

                  <SharedSlotPicker
                    slotStatuses={slotStatuses}
                    selectedStart={formData.start}
                    onSelect={(start) => updateForm("start", start)}
                    disabled={isLoading || isSubmitting}
                    loading={availabilityLoading}
                  />
                </div>

                <div className="rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] h-fit sm:p-5 lg:sticky lg:top-24">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-700">
                    <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                    Booking Summary
                  </p>
                  
                  <div className="mt-4 rounded-3xl border border-yellow-200 bg-[linear-gradient(180deg,#fafafa_0%,#f5f5f5_100%)] p-4.5 shadow-sm">
                    <div className="space-y-3">
                      <SummaryRow label="Visit Type" value={<VisitTypeValue type={formData.type} />} done />
                      <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                      <div className="h-px bg-linear-to-r from-yellow-200 to-transparent my-2" />
                      <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                      <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                      <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={!!selectedSlot} />
                      <div className="h-px bg-linear-to-r from-yellow-200 to-transparent my-2" />
                      <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "—"} done={!!selectedSlot} />
                    </div>
                  </div>

                  {formData.type === "Online" ? (
                    <div className="mt-4 rounded-[1.4rem] border border-yellow-200 bg-yellow-50 px-3.5 py-3.5 text-xs">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-yellow-800">
                        <FaCreditCard className="h-3 w-3" aria-hidden="true" />
                        Payment Info
                      </p>
                      <p className="mt-1.5 text-yellow-700">Online consultations require payment first. You&apos;ll choose QR, card, or bank transfer on the review step.</p>
                    </div>
                  ) : null}

                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Review & Confirm" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-4xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_22px_48px_rgba(17,17,17,0.08)] sm:p-6">
              {requiresAuthForReview ? (
                <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-yellow-300 bg-[linear-gradient(180deg,#fafafa_0%,#e5e5e5_100%)] p-6 shadow-sm sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-700">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Please sign in to continue</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Sign in or create an account to review and complete your appointment booking.
                  </p>

                  <div className="mt-6 rounded-[1.4rem] border border-yellow-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
                    You can keep your selected service, date, and time. You only need to sign in or sign up before the final confirmation.
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/login?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full bg-black px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Sign In
                    </Link>
                    <Link
                      href={`/register?next=${encodeURIComponent(`${pathname}#booking`)}`}
                      className="flex-1 rounded-full border border-yellow-300 bg-white px-5 py-3 text-center text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yellow-700">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {formData.type === "Online" ? "Review & Proceed to Payment" : "Review & Confirm"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">Please review your appointment details before confirming</p>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-4 rounded-[1.75rem] border border-yellow-100 bg-[linear-gradient(180deg,#fafafa_0%,#e5e5e5_100%)] p-5 shadow-sm sm:p-6">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700 mb-3">
                          <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                          Appointment Details
                        </p>
                        <div className="space-y-3">
                          <SummaryRow label="Patient Type" value={formData.patientStatus} done={step1Valid} />
                          <SummaryRow label="Visit Type" value={<VisitTypeValue type={formData.type} />} done />
                          {formData.type === "Clinic" ? <SummaryRow label="Clinic" value={selectedClinic.label} done={!!formData.clinicId} /> : null}
                          <SummaryRow label="Service" value={formData.service} done={!!formData.service} />
                          <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                          <div className="h-px bg-linear-to-r from-yellow-200 to-transparent" />
                          <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={datePicked} />
                          <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "-"} done={step3Valid} />
                          <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={step3Valid} />
                          {selectedSlot ? <SummaryRow label="Queue #" value={`#${selectedSlot.nextQueueNumber}`} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-yellow-200">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700 mb-3">
                          <FaUser className="h-3 w-3" aria-hidden="true" />
                          Patient Information
                        </p>
                        <div className="space-y-3 text-sm">
                          <SummaryRow label="Patient Type" value={formData.patientStatus} done={step1Valid} />
                          <SummaryRow label="Name" value={effectivePatientName} done={step2Valid} />
                          <SummaryRow label="Email" value={effectivePatientEmail} done={step2Valid} />
                          <SummaryRow label="Phone" value={effectivePatientPhone} done={step2Valid} />
                          <SummaryRow label="Service" value={formData.service} done={!!formData.service} />
                          {formData.reason ? <SummaryRow label="Reason" value={formData.reason} done /> : null}
                          {formData.type === "Online" && formData.symptoms ? <SummaryRow label="Symptoms" value={formData.symptoms} done /> : null}
                          {formData.type === "Online" && uploadedConcernFiles.length > 0 ? (
                            <SummaryRow label="Attached Files" value={`${uploadedConcernFiles.length} file${uploadedConcernFiles.length === 1 ? "" : "s"} ready`} done />
                          ) : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-yellow-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700 mb-3">Payment Info</p>
                        {formData.type === "Online" ? (
                          <SummaryRow
                            label="Payment Method"
                            value={paymentOptionLabel(formData.paymentOption)}
                            done
                          />
                        ) : null}
                        {formData.type === "Online" ? (
                          <SummaryRow
                            label="Video Platform"
                            value="Google Meet"
                            done
                          />
                        ) : null}
                      </div>

                      {isProcedureBooking ? (
                        <div className="pt-2 border-t border-yellow-200 space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700 mb-3">Procedure Consent</p>
                            <div className="rounded-[1.4rem] border border-yellow-200 bg-white px-4 py-4 shadow-sm">
                              <p className="text-sm font-bold text-slate-900">{consentGuide.title}</p>
                              <p className="mt-1 text-xs leading-6 text-slate-600">{consentGuide.summary}</p>
                              <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-700">
                                {consentGuide.bullets.map((bullet) => (
                                  <li key={bullet} className="flex gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden="true" />
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Patient signature
                                  </span>
                                  <input
                                    type="text"
                                    value={procedureConsentSignature}
                                    onChange={(event) => setProcedureConsentSignature(event.target.value)}
                                    className="w-full rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                                    placeholder={effectivePatientName || "Type your full name"}
                                  />
                                </label>
                                <div className="rounded-2xl border border-yellow-100 bg-yellow-50/70 px-4 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow-700">Status</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-800">
                                    {consentSignatureMatches ? "Signature matches patient name" : "Signature must match the patient name"}
                                  </p>
                                </div>
                              </div>
                              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-yellow-100 bg-yellow-50/70 px-4 py-3 text-sm text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={procedureConsentAccepted}
                                  onChange={(event) => setProcedureConsentAccepted(event.target.checked)}
                                  className="mt-1 h-4 w-4 rounded border-yellow-300 text-black focus:ring-black"
                                />
                                <span>I confirm that I have filled up and signed the patient consent form for this procedure.</span>
                              </label>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow-700 mb-3">Aftercare Instructions</p>
                            <div className="rounded-[1.4rem] border border-yellow-200 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf0_100%)] px-4 py-4 shadow-sm">
                              {selectedAftercareGuide ? (
                                <>
                                  <p className="text-sm font-bold text-slate-900">{selectedAftercareGuide.title}</p>
                                  <p className="mt-1 text-xs leading-6 text-slate-600">{selectedAftercareGuide.summary}</p>
                                  <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-700">
                                    {selectedAftercareGuide.bullets.map((bullet) => (
                                      <li key={bullet} className="flex gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden="true" />
                                        <span>{bullet}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-bold text-slate-900">General Procedure Aftercare</p>
                                  <p className="mt-1 text-xs leading-6 text-slate-600">
                                    Follow the doctor&apos;s specific instructions after treatment. Keep the area clean, avoid touching it unnecessarily, and contact the clinic if you notice unusual swelling, pain, or bleeding.
                                  </p>
                                  <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-700">
                                    <li className="flex gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden="true" />
                                      <span>Rest, hydrate, and avoid strenuous activity if advised.</span>
                                    </li>
                                    <li className="flex gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden="true" />
                                      <span>Do not apply products or take medicines not recommended by the doctor.</span>
                                    </li>
                                    <li className="flex gap-2">
                                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden="true" />
                                      <span>Return for follow-up if the clinic asks you to come back.</span>
                                    </li>
                                  </ul>
                                </>
                              )}
                              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-yellow-100 bg-white px-4 py-3 text-sm text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={procedureAftercareAcknowledged}
                                  onChange={(event) => setProcedureAftercareAcknowledged(event.target.checked)}
                                  className="mt-1 h-4 w-4 rounded border-yellow-300 text-black focus:ring-black"
                                />
                                <span>I understand the aftercare instructions and will follow them after the procedure.</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.75rem] border-2 border-yellow-300 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-5 shadow-md h-fit sm:p-6 lg:sticky lg:top-24">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-700">
                        {formData.type === "Online" ? (
                          <>
                            <FaCreditCard className="h-3 w-3" aria-hidden="true" />
                            Ready for Payment
                          </>
                        ) : (
                          <>
                            <FaCircleCheck className="h-3 w-3" aria-hidden="true" />
                            Ready to Book
                          </>
                        )}
                      </p>
                      <p className="mt-4 text-3xl font-black text-yellow-800">
                        {formData.type === "Online"
                          ? "Pay Now"
                          : `Queue ${selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}`}
                      </p>
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                        {formData.type === "Online"
                          ? "You will be redirected to PayMongo's secure checkout to complete the payment."
                          : selectedSlot
                            ? `Your appointment is confirmed for ${formatRange(selectedSlot.start, selectedSlot.end)}`
                            : "Select a time slot first"}
                      </p>

                      {formData.type === "Online" ? (
                        <div className="mt-4 space-y-3 rounded-[1.4rem] border border-yellow-200 bg-linear-to-b from-yellow-50 to-white px-4 py-4">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-yellow-800">Choose Payment Method</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-700 shadow-sm border border-yellow-200">
                              <FaLock className="h-2.5 w-2.5" aria-hidden="true" />
                              Secure · PayMongo
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {ONLINE_PAYMENT_OPTIONS.map((option) => {
                              const isSelected = formData.paymentOption === option.value;
                              const isAvailable = option.available;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={!isAvailable}
                                  onClick={
                                    isAvailable
                                      ? () => updateForm("paymentOption", option.value)
                                      : undefined
                                  }
                                  aria-pressed={isAvailable ? isSelected : undefined}
                                  aria-disabled={!isAvailable || undefined}
                                  title={!isAvailable ? option.unavailableNote : undefined}
                                  className={`group relative w-full overflow-hidden rounded-2xl border-2 px-3.5 py-3.5 text-left transition-all duration-150 ${
                                    !isAvailable
                                      ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50/70"
                                      : isSelected
                                      ? `${option.accent.selectedBorder} ${option.accent.selectedBg} shadow-md ring-2 ${option.accent.ring} ring-offset-1`
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                  }`}
                                >
                                  <div className={`flex items-start gap-3.5 ${!isAvailable ? "opacity-60" : ""}`}>
                                    {/* Brand logo tile */}
                                    <div className="shrink-0">{option.logo}</div>

                                    {/* Label + detail + brand chips */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-bold text-slate-900">{option.label}</p>
                                        {!isAvailable ? (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-yellow-700 border border-yellow-200">
                                            Not yet available
                                          </span>
                                          ) : isSelected ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                            <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />
                                            Selected
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-1 text-xs text-slate-600 leading-snug">
                                        {!isAvailable && option.unavailableNote
                                          ? option.unavailableNote
                                          : option.detail}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {option.brands.map((brand) => (
                                          <Fragment key={brand.key}>{brand.node}</Fragment>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Radio indicator (hidden for unavailable methods) */}
                                    {isAvailable ? (
                                      <span
                                        className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                                          isSelected
                                            ? `${option.accent.selectedBorder} bg-white`
                                            : "border-slate-300 bg-white group-hover:border-slate-400"
                                        }`}
                                      >
                                        {isSelected ? (
                                          <span
                                            className={`h-2.5 w-2.5 rounded-full ${option.accent.tileBg}`}
                                            aria-hidden="true"
                                          />
                                        ) : null}
                                      </span>
                                    ) : (
                                      <span
                                        className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white"
                                        aria-hidden="true"
                                      >
                                        <FaLock className="h-2.5 w-2.5 text-slate-400" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-500">
                            <span>Powered by</span>
                            <span className="font-bold text-slate-700">PayMongo</span>
                            <span>·</span>
                            <span>SSL encrypted</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!requiresAuthForReview && !accessToken && (
                    <div className="rounded-[1.4rem] border border-yellow-300 bg-yellow-50 px-4 py-4">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 mb-3">
                        <FaLock className="h-3.5 w-3.5" aria-hidden="true" />
                        Sign In Required
                      </p>
                      <p className="text-sm text-yellow-700 mb-4">You must sign in or create an account to complete your booking.</p>
                      <div className="flex gap-3 flex-col sm:flex-row">
                        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "") }#booking`} className="flex-1 rounded-full bg-black text-white px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-black">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "") }#booking`} className="flex-1 rounded-full border border-yellow-300 bg-white text-yellow-700 px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-yellow-50">
                          Create Account
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-yellow-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50 sm:order-1">
                  <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId, type: formData.type }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50">
                    <FaArrowRotateLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Start Over
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done || !accessToken} className="rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(17,17,17,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Processing..." : formData.type === "Online" ? "Proceed to Payment" : "Confirm Appointment"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function HorizontalBookingStepper({
  labels,
  activeStep,
  onStepClick,
  children,
}: {
  labels: readonly string[];
  activeStep: number;
  onStepClick: (step: number) => void;
  children?: ReactNode;
}) {
  return (
    <nav aria-label="Booking progress" className="w-full">
      <div className="pb-2">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-1 sm:flex sm:items-start sm:gap-y-0">
          {children ? (
            <div className="col-span-2 mb-1 flex items-center justify-center sm:col-span-1 sm:mb-0 sm:mr-4">
              {children}
            </div>
          ) : null}
          {labels.map((label, i) => {
            const step = i + 1;
            const isCurrent = step === activeStep;
            const isComplete = step < activeStep;

            return (
              <Fragment key={label}>
                {i > 0 ? (
                  <div
                    className={`hidden mt-5 h-0.5 min-w-1.5 flex-1 ${isComplete ? "bg-black" : "bg-yellow-100"} sm:block`}
                    aria-hidden
                  />
                ) : null}
                <div className="flex min-w-0 flex-col items-center sm:w-32 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => onStepClick(step)}
                    title={`Step ${step}: ${label}`}
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 ${
                      isCurrent
                        ? "bg-[linear-gradient(135deg,#111111,#111111)] text-white shadow-[0_12px_24px_rgba(17,17,17,0.24)]"
                        : isComplete
                        ? "bg-yellow-300 text-white shadow-sm"
                        : "bg-yellow-50 text-yellow-700 ring-2 ring-yellow-200"
                    }`}
                  >
                    {isComplete ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step
                    )}
                  </button>
                  <p className={`mt-3 w-full px-1 text-center text-[10px] font-medium leading-tight sm:text-xs ${isCurrent ? "text-slate-900" : "text-slate-600"}`}>
                    {label}
                  </p>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function WizardNav({
  showBack,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  showBack?: boolean;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${showBack ? "sm:justify-between" : "sm:justify-end"}`}>
      {showBack ? (
        <button type="button" onClick={onBack} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-yellow-300 hover:bg-yellow-50 sm:w-auto">
          <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
      ) : null}
      <button type="button" onClick={onNext} disabled={nextDisabled} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(17,17,17,0.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
        {nextLabel}
        <FaArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  done,
}: {
  label: string;
  value: React.ReactNode;
  done: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className={`font-medium ${done ? "text-slate-600" : "text-slate-400"}`}>{label}</span>
      <span
        className={`wrap-break-word font-semibold sm:max-w-[60%] sm:text-right inline-flex items-center justify-end gap-1.5 ${
          done ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
