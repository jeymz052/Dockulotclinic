"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState, useEffect, useTransition, type ChangeEvent, type ReactNode } from "react";
import {
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
} from "react-icons/fa6";
import { createAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { SharedSlotPicker } from "@/src/components/appointments/SharedSlotPicker";
import { ProcedureConsentModal } from "@/src/components/appointments/ProcedureConsentModal";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useAppointmentAvailability } from "@/src/components/appointments/useAppointmentAvailability";
import { useDoctors } from "@/src/components/appointments/useDoctors";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  encodeAppointmentContext,
  getDefaultServiceForType,
  getServiceOptionsForType,
  type ClinicConsultKind,
} from "@/src/lib/appointment-context";
import { clinicServices, consentGuide, resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import {
  addDays,
  formatDisplayDate,
  formatRange,
  getDoctorById,
  getWeekDates,
  type AppointmentType,
} from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";
import {
  FOLLOW_UP_CLINIC_CONSULTATION_FEE,
  NEW_PATIENT_CLINIC_CONSULTATION_FEE,
  formatDurationLabel,
} from "@/src/lib/consultation-pricing";
import {
  BOOKING_PRICING_CODES,
  formatBookingPeso,
  getBookingPriceAmount,
  getClinicConsultationAmount,
  getProcedureDisplayPriceLabel,
  type PricingItem,
} from "@/src/lib/booking-pricing";
import {
  BOOKING_CLINIC_LOCATIONS,
  CONSULTATION_SLOT_MINUTES,
  PROCEDURE_SLOT_MINUTES,
} from "@/src/lib/clinic-schedule";
import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  calculatePatientAge,
  validatePatientRegistrationFields,
} from "@/src/lib/patient-registration";

type BookingForm = {
  visitPath: BookingVisitPath;
  patientStatus: BookingPatientStatus;
  clinicConsultKind: ClinicConsultKind;
  service: string;
  clinicId: string;
  patientName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  civilStatus: string;
  address: string;
  religion: string;
  occupation: string;
  guardianName: string;
  doctorId: string;
  date: string;
  start: string;
  type: AppointmentType;
  reason: string;
  symptoms: string;
  durationMinutes: "60";
};

type BookingPatientStatus = "Existing" | "New";
type BookingVisitPath = "Clinic" | "Online" | "Procedure";

type UploadedConcernFile = {
  file_name: string;
  file_type: string;
  file_url: string;
};

const MAX_CONCERN_FILES = 3;
const MAX_CONCERN_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_CONCERN_FILE_SIZE_LABEL = "10 MB";

const BOOKING_VISIT_OPTIONS: Array<{
  path: BookingVisitPath;
  label: string;
  helper: string;
}> = [
  {
    path: "Clinic",
    label: "Clinic Visit",
    helper: "In-person consultation at the clinic. Procedures are booked separately.",
  },
  {
    path: "Procedure",
    label: "Medical Procedure",
    helper: "Reserve an actual clinic procedure schedule for Botox, Mesolipo, fillers, sclerotherapy, wart removal, mole surgery, and similar procedures.",
  },
  {
    path: "Online",
    label: "Virtual Consult",
    helper: "Video call from home. Includes first consult plus one follow-up.",
  },
];

const BOOKING_CLINICS = BOOKING_CLINIC_LOCATIONS;

const PROCEDURE_SERVICE_TITLES = new Set(
  clinicServices.filter((service) => service.appointmentOnly).map((service) => service.title),
);

const today = getClinicToday();
const DEFAULT_DOCTOR_ID = "doctora-kulot-md";

const INITIAL_FORM: BookingForm = {
  visitPath: "Clinic",
  patientStatus: "New",
  clinicConsultKind: "FirstConsult",
  service: getDefaultServiceForType("Clinic"),
  clinicId: BOOKING_CLINICS[0].value,
  patientName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  civilStatus: "",
  address: "",
  religion: "",
  occupation: "",
  guardianName: "",
  doctorId: DEFAULT_DOCTOR_ID,
  date: today,
  start: "",
  type: "Clinic",
  reason: "",
  symptoms: "",
  durationMinutes: "60",
};

function normalizeConsentName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getVisitPathLabel(path: BookingVisitPath) {
  if (path === "Procedure") return "Medical Procedure";
  return path === "Clinic" ? "Clinic Visit" : "Virtual Consult";
}

function VisitPathIcon({ path, className }: { path: BookingVisitPath; className?: string }) {
  if (path === "Online") return <FaVideo className={className} aria-hidden="true" />;
  if (path === "Procedure") return <FaClipboardList className={className} aria-hidden="true" />;
  return <FaHospital className={className} aria-hidden="true" />;
}

function visitPathColorClasses(path: BookingVisitPath) {
  if (path === "Online") {
    return {
      cardSelected: "border-sky-300 bg-sky-50 shadow-[0_12px_28px_rgba(14,165,233,0.14)] ring-2 ring-sky-100 ring-offset-1",
      cardIdle: "border-sky-100 bg-white hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_12px_24px_rgba(14,165,233,0.10)]",
      iconSelected: "bg-white text-sky-700 shadow-sm",
      iconIdle: "bg-sky-50 text-sky-700 group-hover:bg-sky-100",
      selectedBadge: "bg-sky-600 text-white",
      chooseBadge: "border-sky-200 bg-white text-sky-700",
      priceBadge: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (path === "Procedure") {
    return {
      cardSelected: "border-amber-300 bg-amber-50 shadow-[0_12px_28px_rgba(245,158,11,0.16)] ring-2 ring-amber-100 ring-offset-1",
      cardIdle: "border-amber-100 bg-white hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_12px_24px_rgba(245,158,11,0.10)]",
      iconSelected: "bg-white text-amber-700 shadow-sm",
      iconIdle: "bg-amber-50 text-amber-700 group-hover:bg-amber-100",
      selectedBadge: "bg-amber-600 text-white",
      chooseBadge: "border-amber-200 bg-white text-amber-700",
      priceBadge: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    cardSelected: "border-teal-300 bg-teal-50 shadow-[0_12px_28px_rgba(20,184,166,0.14)] ring-2 ring-teal-100 ring-offset-1",
    cardIdle: "border-teal-100 bg-white hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_24px_rgba(20,184,166,0.10)]",
    iconSelected: "bg-white text-teal-700 shadow-sm",
    iconIdle: "bg-teal-50 text-teal-700 group-hover:bg-teal-100",
    selectedBadge: "bg-teal-600 text-white",
    chooseBadge: "border-teal-200 bg-white text-teal-700",
    priceBadge: "border-teal-200 bg-teal-50 text-teal-700",
  };
}

function getServicePriceLabel(serviceTitle: string, pricingItems: PricingItem[]) {
  return getProcedureDisplayPriceLabel(pricingItems, serviceTitle)
    ?? clinicServices.find((service) => service.title === serviceTitle)?.priceLabel
    ?? null;
}

function getClinicConsultKindLabel(kind: ClinicConsultKind) {
  return kind === "FollowUp" ? "Follow-up clinic consult" : "First clinic consult";
}

function getClinicConsultKindFee(kind: ClinicConsultKind, pricingItems: PricingItem[]) {
  if (pricingItems.length === 0) {
    return kind === "FollowUp" ? FOLLOW_UP_CLINIC_CONSULTATION_FEE : NEW_PATIENT_CLINIC_CONSULTATION_FEE;
  }
  return getClinicConsultationAmount(pricingItems, kind);
}

function getConsultationFeeLabel(
  type: AppointmentType,
  clinicConsultKind: ClinicConsultKind,
  pricingItems: PricingItem[],
) {
  if (type === "Online") {
    return `${formatBookingPeso(getBookingPriceAmount(pricingItems, BOOKING_PRICING_CODES.VIRTUAL_CONSULT))} virtual consult`;
  }

  return `${formatBookingPeso(getClinicConsultKindFee(clinicConsultKind, pricingItems))} ${
    clinicConsultKind === "FollowUp" ? "follow-up" : "first clinic consult"
  }`;
}

function getBookingServicePriceLabel(
  serviceTitle: string,
  path: BookingVisitPath,
  type: AppointmentType,
  clinicConsultKind: ClinicConsultKind,
  pricingItems: PricingItem[],
) {
  if (path === "Procedure") {
    return getServicePriceLabel(serviceTitle, pricingItems);
  }

  return type === "Clinic"
    ? getConsultationFeeLabel(type, clinicConsultKind, pricingItems)
    : getServicePriceLabel(serviceTitle, pricingItems) ?? getConsultationFeeLabel(type, clinicConsultKind, pricingItems);
}

function getServiceDescription(serviceTitle: string) {
  return clinicServices.find((service) => service.title === serviceTitle)?.description ?? "";
}

function peso(amount: number) {
  return formatBookingPeso(amount);
}

function VisitPathValue({ path }: { path: BookingVisitPath }) {
  const iconColor =
    path === "Online" ? "text-sky-600" : path === "Clinic" ? "text-teal-600" : "text-amber-600";

  return (
    <>
      <VisitPathIcon path={path} className={`h-3.5 w-3.5 ${iconColor}`} />
      {getVisitPathLabel(path)}
    </>
  );
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
  return resolveAftercareGuideForService(serviceTitle);
}

export default function BookAppointmentPage() {
  const pathname = usePathname();
  const authReturnPath = pathname === "/" ? "/#booking" : pathname;
  const { accessToken, role, user, profile, patient, isLoading: authLoading } = useRole();
  const { setAppointments, isLoading, error } = useAppointments();
  const { doctors } = useDoctors();
  const [formData, setFormData] = useState<BookingForm>(INITIAL_FORM);
  const [uploadedConcernFiles, setUploadedConcernFiles] = useState<UploadedConcernFile[]>([]);
  const [procedureConsentAccepted, setProcedureConsentAccepted] = useState(false);
  const [procedureConsentSignature, setProcedureConsentSignature] = useState("");
  const [procedureConsentSignatureName, setProcedureConsentSignatureName] = useState("");
  const [procedureAftercareAcknowledged, setProcedureAftercareAcknowledged] = useState(false);
  const [isProcedureConsentModalOpen, setIsProcedureConsentModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [bookingPricing, setBookingPricing] = useState<PricingItem[]>([]);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [visibleWeekStart, setVisibleWeekStart] = useState(today);

  const primaryDoctor = doctors[0] ?? null;
  const activeDoctorId = primaryDoctor?.slug ?? DEFAULT_DOCTOR_ID;
  const selectedDoctor = primaryDoctor ?? getDoctorById(activeDoctorId);
  const isProcedureBooking = formData.visitPath === "Procedure" || PROCEDURE_SERVICE_TITLES.has(formData.service);
  const {
    slotStatuses,
    blockedReason,
    nextAvailableSlot,
    isLoading: availabilityLoading,
    error: availabilityError,
  } = useAppointmentAvailability(
    activeDoctorId,
    formData.date,
    formData.type,
    isProcedureBooking ? PROCEDURE_SLOT_MINUTES : CONSULTATION_SLOT_MINUTES,
  );
  const selectedSlot = slotStatuses.find((slot) => slot.start === formData.start) ?? null;
  const procedureServiceOptions = useMemo(
    () =>
      clinicServices
        .filter((service) => service.appointmentOnly && (service.modes ?? ["Clinic", "Online"]).includes("Clinic"))
        .map((service) => service.title),
    [],
  );
  const consultationServiceOptions = useMemo(
    () => getServiceOptionsForType(formData.type).filter((service) => !PROCEDURE_SERVICE_TITLES.has(service)),
    [formData.type],
  );
  const serviceOptions = formData.visitPath === "Procedure" ? procedureServiceOptions : consultationServiceOptions;
  const appointmentClinicConsultKind =
    formData.visitPath === "Clinic" && !isProcedureBooking ? formData.clinicConsultKind : undefined;
  const requiresOnlinePayment = formData.type === "Online" || isProcedureBooking;
  const selectedSlotDuration = selectedSlot
    ? formatDurationLabel(selectedSlot.start, selectedSlot.end)
    : isProcedureBooking ? "1 hr" : "30 min";
  const selectedAftercareGuide = useMemo(() => resolveAftercareGuide(formData.service), [formData.service]);
  const procedureReservationAmount = getBookingPriceAmount(
    bookingPricing,
    BOOKING_PRICING_CODES.PROCEDURE_RESERVATION,
  );
  const visitPathPriceLabels = useMemo(
    () => ({
      Clinic:
        formData.patientStatus === "Existing" || (role === "PATIENT" && patient?.patient_category === "Existing")
          ? `${formatBookingPeso(getClinicConsultKindFee("FirstConsult", bookingPricing))} standard clinic rate`
          : `${formatBookingPeso(getClinicConsultKindFee("FirstConsult", bookingPricing))} first consult / ${formatBookingPeso(
            getClinicConsultKindFee("FollowUp", bookingPricing),
          )} follow-up`,
      Procedure: `${formatBookingPeso(procedureReservationAmount)} reservation`,
      Online: `${formatBookingPeso(getBookingPriceAmount(bookingPricing, BOOKING_PRICING_CODES.VIRTUAL_CONSULT))}`,
    }),
    [bookingPricing, patient, procedureReservationAmount, role, formData.patientStatus],
  );

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
    if (authLoading) return;

    let savedReservationFlow = false;

    try {
      const raw = localStorage.getItem("bookingDraft");
      if (raw) {
        const parsed = JSON.parse(raw) as { formData?: Partial<BookingForm>; activeStep?: number };
        if (parsed?.formData) {
          const savedService = parsed.formData.service ?? "";
          const savedVisitPath =
            parsed.formData.visitPath
            ?? (PROCEDURE_SERVICE_TITLES.has(savedService) ? "Procedure" : parsed.formData.type);
          savedReservationFlow =
            savedVisitPath === "Online"
            || savedVisitPath === "Procedure"
            || PROCEDURE_SERVICE_TITLES.has(savedService);

          setFormData((cur) => {
            const restoredHasPatientDetails =
              Boolean(parsed.formData?.patientName?.trim())
              || Boolean(parsed.formData?.email?.trim())
              || Boolean(parsed.formData?.phone?.trim())
              || Boolean(parsed.formData?.dateOfBirth?.trim())
              || Boolean(parsed.formData?.gender?.trim())
              || Boolean(parsed.formData?.civilStatus?.trim())
              || Boolean(parsed.formData?.address?.trim())
              || Boolean(parsed.formData?.religion?.trim())
              || Boolean(parsed.formData?.occupation?.trim())
              || Boolean(parsed.formData?.guardianName?.trim())
              || Boolean(parsed.formData?.reason?.trim())
              || Boolean(parsed.formData?.start);
            const nextType = parsed.formData?.type ?? cur.type;
            const restoredService = parsed.formData?.service ?? cur.service;
            const restoredVisitPath = restoredHasPatientDetails
              ? parsed.formData?.visitPath
                ?? (PROCEDURE_SERVICE_TITLES.has(restoredService) ? "Procedure" : nextType)
              : cur.visitPath;
            const restoredType: AppointmentType = restoredVisitPath === "Online" ? "Online" : "Clinic";
            return {
              ...cur,
              ...(restoredHasPatientDetails ? parsed.formData : {}),
              visitPath: restoredVisitPath,
              type: restoredHasPatientDetails ? restoredType : cur.type,
              service: restoredHasPatientDetails
                ? parsed.formData?.service ?? getDefaultServiceForType(restoredType)
                : cur.service,
            };
          });
        }
        if (parsed?.activeStep) {
          setActiveStep(Math.min(Math.max(parsed.activeStep, 1), 4));
        }
      }
      const reservationId = localStorage.getItem("bookingReservation");
      if (reservationId) {
        if (savedReservationFlow) {
          setFeedback({
            message: accessToken
              ? "We held your selected slot - you can continue booking now."
              : "We held your selected slot - please sign in to complete booking.",
            type: "success",
          });
        } else {
          localStorage.removeItem("bookingReservation");
        }
      }
    } catch {
      // ignore
    } finally {
      setHasRestoredDraft(true);
    }
  }, [accessToken, authLoading]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/v2/pricing/booking", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load booking prices.");
        const payload = (await res.json()) as { pricing?: PricingItem[] };
        if (active) setBookingPricing(payload.pricing ?? []);
      } catch {
        if (active) setBookingPricing([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Persist the draft as the user types so it survives tab switches, hard
  // refreshes, redirects to /login, and the payment verification step back to the
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
        && !formData.dateOfBirth
        && !formData.gender
        && !formData.civilStatus
        && !formData.address.trim()
        && !formData.religion.trim()
        && !formData.occupation.trim()
        && !formData.guardianName.trim()
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
      dateOfBirth: patient?.dob || "",
      gender: patient?.gender || "",
      civilStatus: patient?.civil_status || "",
      address: patient?.address || "",
      religion: patient?.religion || "",
      occupation: patient?.occupation || "",
      guardianName: patient?.guardian_name || "",
    }),
    [patient, profile, user],
  );
  const hasExistingPatientRecord =
    role === "PATIENT"
    && patient?.patient_category === "Existing";
  const shouldHidePatientDetails = formData.patientStatus === "Existing" || hasExistingPatientRecord;
  const canChooseFollowUpClinicConsult = formData.patientStatus === "New" && !hasExistingPatientRecord;
  const activeClinicConsultKind: ClinicConsultKind = canChooseFollowUpClinicConsult
    ? formData.clinicConsultKind
    : "FirstConsult";
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
  const effectivePatientDetails = {
    dateOfBirth: formData.dateOfBirth || patientDefaults.dateOfBirth,
    gender: formData.gender || patientDefaults.gender,
    civilStatus: formData.civilStatus || patientDefaults.civilStatus,
    address: formData.address || patientDefaults.address,
    religion: formData.religion || patientDefaults.religion,
    occupation: formData.occupation || patientDefaults.occupation,
    guardianName: formData.guardianName || patientDefaults.guardianName,
  };
  const patientDetailPayload = shouldHidePatientDetails
    ? {}
    : {
        dateOfBirth: effectivePatientDetails.dateOfBirth,
        gender: effectivePatientDetails.gender,
        civilStatus: effectivePatientDetails.civilStatus,
        address: effectivePatientDetails.address,
        religion: effectivePatientDetails.religion,
        occupation: effectivePatientDetails.occupation,
        guardianName: effectivePatientDetails.guardianName,
      };
  const patientAge = calculatePatientAge(effectivePatientDetails.dateOfBirth);
  const guardianRequired = patientAge != null && patientAge < 18;
  const patientDetailsError = useMemo(
    () => {
      if (shouldHidePatientDetails) return "";
      return validatePatientRegistrationFields({
        fullName: effectivePatientName,
        firstName: "",
        middleName: "",
        lastName: "",
        suffixName: "",
        email: effectivePatientEmail,
        phone: effectivePatientPhone,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        civilStatus: formData.civilStatus,
        address: formData.address,
        religion: formData.religion,
        occupation: formData.occupation,
        guardianName: formData.guardianName,
      });
    },
    [
      effectivePatientName,
      effectivePatientEmail,
      effectivePatientPhone,
      formData.address,
      formData.civilStatus,
      formData.dateOfBirth,
      formData.gender,
      formData.guardianName,
      formData.occupation,
      formData.religion,
      shouldHidePatientDetails,
    ],
  );
  const patientDetailsRequired = !shouldHidePatientDetails;
  const appointmentClinicConsultLabel = shouldHidePatientDetails
    ? "Standard clinic consult"
    : getClinicConsultKindLabel(activeClinicConsultKind);

  useEffect(() => {
    if (!hasExistingPatientRecord) return;

    setFormData((current) => {
      let nextState = current;
      let changed = false;

      if (current.patientStatus !== "Existing") {
        nextState = { ...nextState, patientStatus: "Existing" };
        changed = true;
      }
      if (current.clinicConsultKind !== "FirstConsult") {
        nextState = { ...nextState, clinicConsultKind: "FirstConsult" };
        changed = true;
      }

      if (current.patientName !== patientDefaults.patientName) {
        nextState = { ...nextState, patientName: patientDefaults.patientName };
        changed = true;
      }
      if (current.email !== patientDefaults.email) {
        nextState = { ...nextState, email: patientDefaults.email };
        changed = true;
      }
      if (current.phone !== patientDefaults.phone) {
        nextState = { ...nextState, phone: patientDefaults.phone };
        changed = true;
      }
      if (current.dateOfBirth !== patientDefaults.dateOfBirth) {
        nextState = { ...nextState, dateOfBirth: patientDefaults.dateOfBirth };
        changed = true;
      }
      if (current.gender !== patientDefaults.gender) {
        nextState = { ...nextState, gender: patientDefaults.gender };
        changed = true;
      }
      if (current.civilStatus !== patientDefaults.civilStatus) {
        nextState = { ...nextState, civilStatus: patientDefaults.civilStatus };
        changed = true;
      }
      if (current.address !== patientDefaults.address) {
        nextState = { ...nextState, address: patientDefaults.address };
        changed = true;
      }
      if (current.religion !== patientDefaults.religion) {
        nextState = { ...nextState, religion: patientDefaults.religion };
        changed = true;
      }
      if (current.occupation !== patientDefaults.occupation) {
        nextState = { ...nextState, occupation: patientDefaults.occupation };
        changed = true;
      }
      if (current.guardianName !== patientDefaults.guardianName) {
        nextState = { ...nextState, guardianName: patientDefaults.guardianName };
        changed = true;
      }

      return changed ? nextState : current;
    });
  }, [hasExistingPatientRecord, patientDefaults]);
  const maxBirthDate = new Date().toISOString().slice(0, 10);
  const selectedClinic = BOOKING_CLINICS.find((clinic) => clinic.value === formData.clinicId) ?? BOOKING_CLINICS[0];
  const hasProcedureSignatureImage = procedureConsentSignature.startsWith("data:image/png;base64,");
  const consentSignatureMatches =
    hasProcedureSignatureImage
    && normalizeConsentName(procedureConsentSignatureName) === normalizeConsentName(effectivePatientName);
  const hasCompleteProcedureConsent = procedureConsentAccepted && procedureAftercareAcknowledged && consentSignatureMatches;
  const procedureConsentIssue =
    !isProcedureBooking || hasCompleteProcedureConsent
      ? ""
      : !procedureConsentAccepted
        ? "Review and accept the consent form before payment."
        : !procedureAftercareAcknowledged
          ? "Open the aftercare tab and acknowledge the instructions before payment."
          : !hasProcedureSignatureImage
            ? "Draw and save the patient signature before payment."
            : "The printed signature name must match the booking name.";
  const canConfirmProcedure =
    !isProcedureBooking
    || hasCompleteProcedureConsent;

  const step1Valid = !!formData.patientStatus;
  const step2Valid =
    !!formData.type
    && !!formData.service.trim()
    && !!effectivePatientName.trim()
    && !!effectivePatientEmail.trim()
    && !!effectivePatientPhone.trim()
    && !patientDetailsError
    && (!isProcedureBooking || !!formData.reason.trim());
  const datePicked = !!formData.date && !blockedReason;
  const step3Valid = datePicked && !!formData.start;
  const step4Done =
    step1Valid
    && step2Valid
    && step3Valid
    && canConfirmProcedure;

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
    else if (activeStep === 2) {
      setFeedback({
        message: patientDetailsError ?? "Please complete the patient record details before continuing.",
        type: "error",
      });
    }
    else if (activeStep === 3 && step3Valid) {
      goToStep(4);
    }
  }

  function goBack() {
    if (activeStep > 1) setActiveStep((s) => s - 1);
  }

  function resetProcedureConsent() {
    setProcedureConsentAccepted(false);
    setProcedureConsentSignature("");
    setProcedureConsentSignatureName("");
    setProcedureAftercareAcknowledged(false);
    setIsProcedureConsentModalOpen(false);
  }

  function updateForm<K extends keyof BookingForm>(field: K, value: BookingForm[K]) {
    setFormData((current) => {
      const nextState = { ...current, [field]: value };
      if (field === "patientStatus") {
        const isExisting = value === "Existing" || hasExistingPatientRecord;
        nextState.patientStatus = isExisting ? "Existing" : "New";
        nextState.patientName = isExisting && role === "PATIENT" ? patientDefaults.patientName : current.patientName;
        nextState.email = isExisting && role === "PATIENT" ? patientDefaults.email : current.email;
        nextState.phone = isExisting && role === "PATIENT" ? patientDefaults.phone : current.phone;
        nextState.clinicConsultKind = isExisting ? "FirstConsult" : current.clinicConsultKind;
      }
      if (field === "clinicConsultKind") {
        if (value === "FollowUp" && (hasExistingPatientRecord || current.patientStatus === "Existing")) {
          nextState.clinicConsultKind = "FirstConsult";
        }
      }
      if (field === "visitPath") {
        const nextPath = value as BookingVisitPath;
        const nextType: AppointmentType = nextPath === "Online" ? "Online" : "Clinic";
        nextState.type = nextType;
        nextState.start = "";
        nextState.service =
          nextPath === "Procedure"
            ? procedureServiceOptions[0] ?? "Botox"
            : getDefaultServiceForType(nextType);
        if (nextType === "Clinic") {
          nextState.clinicId = BOOKING_CLINICS[0].value;
        }
        if (nextPath !== "Online") {
          nextState.symptoms = "";
          setUploadedConcernFiles([]);
        }
        resetProcedureConsent();
      }
      if (field === "doctorId" || field === "date" || field === "type" || field === "visitPath") {
        nextState.start = "";
      }
      if (field === "type") {
        nextState.visitPath = value === "Online" ? "Online" : "Clinic";
        nextState.service = getDefaultServiceForType(value as AppointmentType);
        if (value === "Clinic") {
          nextState.clinicId = BOOKING_CLINICS[0].value;
        }
        if (value !== "Online") {
          nextState.symptoms = "";
        }
        resetProcedureConsent();
      }
      if (field === "service") {
        resetProcedureConsent();
      }
      return nextState;
    });
    if ((field === "type" && value !== "Online") || (field === "visitPath" && value !== "Online")) {
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
    const buildCheckoutBody = (nextReservationId: string | null) => ({
      patientName: effectivePatientName,
      email: effectivePatientEmail,
      phone: effectivePatientPhone,
      firstName: "",
      middleName: "",
      lastName: "",
      suffixName: "",
      ...patientDetailPayload,
      doctorId: activeDoctorId,
      date: formData.date,
      start: formData.start,
      reason: encodeAppointmentContext(
        formData.service,
        formData.reason,
        hasExistingPatientRecord ? "FirstConsult" : formData.clinicConsultKind,
      ),
      type: formData.type,
      patientStatus: hasExistingPatientRecord ? "Existing" : formData.patientStatus,
      service: formData.service,
      reservation_id: nextReservationId ?? undefined,
      payment_option: "paymongo_gcash",
      procedure_consent: isProcedureBooking
        ? {
          procedureName: formData.service,
          patientName: effectivePatientName,
          patientSignature: procedureConsentSignature,
          patientSignatureName: procedureConsentSignatureName,
          consentAccepted: procedureConsentAccepted,
          aftercareAcknowledged: procedureAftercareAcknowledged,
          consentImageUrl: consentGuide.image,
          aftercareGuideTitle: selectedAftercareGuide?.title ?? null,
          aftercareImageUrl: selectedAftercareGuide?.image ?? null,
        }
        : undefined,
    });

    async function requestCheckout(nextReservationId: string | null) {
      return fetch("/api/v2/payments/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
        body: JSON.stringify(buildCheckoutBody(nextReservationId)),
      });
    }

    let checkoutRes = await requestCheckout(reservationId);
    let payload = (await checkoutRes.json().catch(() => ({}))) as {
      url?: string | null;
      message?: string;
      reservation_id?: string;
      checkout_mode?: "redirect" | "manual";
      instructions?: string;
      payment_reference?: string;
    };

    if (
      !checkoutRes.ok
      && reservationId
      && (checkoutRes.status === 404 || checkoutRes.status === 409 || /reservation/i.test(payload.message ?? ""))
    ) {
      localStorage.removeItem("bookingReservation");
      checkoutRes = await requestCheckout(null);
      payload = (await checkoutRes.json().catch(() => ({}))) as typeof payload;
    }

    if (!checkoutRes.ok) {
      throw new Error(payload.message ?? "Unable to start payment.");
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
      if (requiresOnlinePayment) {
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
            });
            setUploadedConcernFiles([]);
            resetProcedureConsent();
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
            message: paymentError instanceof Error ? paymentError.message : "Unable to start payment.",
            type: "error",
          });
        }
        return;
      }

      const result = await createAppointmentAction(accessToken, {
      patientName: effectivePatientName,
      email: effectivePatientEmail,
      phone: effectivePatientPhone,
      firstName: "",
      middleName: "",
      lastName: "",
      suffixName: "",
      ...patientDetailPayload,
      doctorId: activeDoctorId,
      date: formData.date,
      start: formData.start,
      type: formData.type,
      reason: encodeAppointmentContext(
        formData.service,
        formData.reason,
        hasExistingPatientRecord ? "FirstConsult" : formData.clinicConsultKind,
      ),
      patientStatus: hasExistingPatientRecord ? "Existing" : formData.patientStatus,
    });

      setAppointments(result.appointments);

      if (!result.ok) {
        setFeedback({ message: result.message, type: "error" });
        return;
      }
      setFormData({
        ...INITIAL_FORM,
        doctorId: activeDoctorId,
      });
      setUploadedConcernFiles([]);
      resetProcedureConsent();
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

  const bookingTone = visitPathColorClasses(formData.visitPath);

  return (
    <div className="space-y-6 overflow-x-hidden pb-8">
      <div className="rounded-3xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-[0_18px_45px_rgba(17,17,17,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-700">Book Appointment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Schedule a {getVisitPathLabel(formData.visitPath).toLowerCase()} with{" "}
              {selectedDoctor?.name?.replace(/^Dra\.\s*/, "Dra. ") ?? "your doctor"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {accessToken
                ? "Pick a service, choose a slot, and confirm in four quick steps."
                : "Browse services and slots freely — sign in only when you're ready to confirm."}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 self-start rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 lg:self-center">
            <VisitPathValue path={formData.visitPath} />
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-red-200 bg-red-50 text-red-800"
        }`}>
          {feedback.type === "success"
            ? <FaCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            : <FaCircleXmark className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />}
          <span>{feedback.message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {availabilityError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{availabilityError}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="rounded-4xl border border-neutral-100 bg-white/95 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)] backdrop-blur sm:p-5">
          <HorizontalBookingStepper
            labels={BOOKING_STEP_LABELS}
            activeStep={activeStep}
            onStepClick={goToStep}
            visitPath={formData.visitPath}
          >
              <>
                <VisitPathValue path={formData.visitPath} />
              </>
          </HorizontalBookingStepper>
          {activeStep === 1 ? (
            <>
              <section className="rounded-4xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">Step 1 of 4</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Are you an existing patient?</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      To request a virtual or face-to-face appointment, please choose how the clinic should handle your booking.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["Existing", "New"] as BookingPatientStatus[]).map((status) => {
                    const selected = formData.patientStatus === status;
                    const disabled = hasExistingPatientRecord && status === "New";
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateForm("patientStatus", status)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={`group overflow-hidden rounded-2xl border p-5 text-left transition ${
                          selected
                            ? "border-neutral-300 bg-neutral-50 shadow-[0_12px_28px_rgba(17,17,17,0.16)] ring-2 ring-neutral-200 ring-offset-1"
                            : disabled
                              ? "cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-400"
                              : "border-neutral-100 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_24px_rgba(17,17,17,0.10)]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                              selected
                                ? "bg-white text-neutral-700 shadow-sm"
                                : disabled
                                  ? "bg-white text-neutral-300"
                                  : "bg-neutral-50 text-neutral-700 group-hover:bg-neutral-100"
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
                              ) : disabled ? (
                                <span className="inline-flex shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                                  Locked
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700">
                                  Choose
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-600 leading-snug">
                              {status === "Existing"
                                ? "Choose this if you already have a Doc Kulot record. We will match your booking to the saved patient profile when possible."
                                : hasExistingPatientRecord
                                  ? "Your record is already on file, so the new-patient path is locked."
                                  : "Choose this if you do not have any patient record yet with Doc Kulot."
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {hasExistingPatientRecord ? (
                  <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-800">
                    We found an existing patient record, so we will use your saved details and keep the follow-up-only booking path locked.
                  </div>
                ) : null}

              </section>

              <WizardNav showBack={false} onNext={goNext} nextDisabled={!step1Valid} nextLabel="Next: Visit Type" />
            </>
          ) : null}

          {activeStep === 2 ? (
            <>
              <section className="rounded-4xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">Step 2 of 4</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">Visit Selection and Patient Information</h2>
                    <p className="mt-1 text-sm text-slate-600">Choose the appointment type first, then confirm your contact details.</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700">
                      <span className="h-2 w-2 rounded-full bg-neutral-300" />
                      All fields required
                    </div>
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {BOOKING_VISIT_OPTIONS.map((option) => {
                    const selected = formData.visitPath === option.path;
                    const colors = visitPathColorClasses(option.path);
                    return (
                      <button
                        key={option.path}
                        type="button"
                        onClick={() => updateForm("visitPath", option.path)}
                        aria-pressed={selected}
                        className={`group overflow-hidden rounded-2xl border p-5 text-left transition ${
                          selected
                            ? colors.cardSelected
                            : colors.cardIdle
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <span
                            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${
                              selected ? colors.iconSelected : colors.iconIdle
                            }`}
                            aria-hidden="true"
                          >
                            <VisitPathIcon path={option.path} className="h-6 w-6" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-lg font-bold ${selected ? "text-slate-900" : "text-slate-800"}`}>{option.label}</p>
                              {selected ? (
                                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${colors.selectedBadge}`}>
                                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" /> Selected
                                </span>
                              ) : (
                                <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${colors.chooseBadge}`}>
                                  Choose
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-slate-600 leading-snug">{option.helper}</p>
                            <p className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${colors.priceBadge}`}>
                              {visitPathPriceLabels[option.path]}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {formData.type === "Clinic" ? (
                  <div className="mt-8 rounded-2xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700">Which clinic and schedule is most convenient for you?</p>
                        <p className="mt-1 text-sm text-slate-600">Select the clinic location that matches your visit.</p>
                      </div>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700">
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
                        className="w-full cursor-pointer rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                      >
                        {BOOKING_CLINICS.map((clinic) => (
                          <option key={clinic.value} value={clinic.value}>
                            {clinic.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 rounded-[1.25rem] border border-neutral-100 bg-neutral-50/60 px-4 py-3 text-sm text-slate-600">
                      <p className="font-semibold text-slate-700">{selectedClinic.label}</p>
                      <p className="mt-2 text-slate-500">{selectedClinic.schedule}</p>
                      <p className="mt-1 text-slate-500">{selectedClinic.note}</p>
                    </div>
                  </div>
                ) : null}
                {formData.visitPath === "Clinic" ? (
                  <div className="mt-8 rounded-2xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700">Clinic Consultation Type</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Choose whether this is the first clinic consult or a follow-up visit.
                        </p>
                      </div>
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700">
                        Required
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(["FirstConsult", "FollowUp"] as ClinicConsultKind[]).map((kind) => {
                        const selected = formData.clinicConsultKind === kind;
                        const disabled = kind === "FollowUp" && !canChooseFollowUpClinicConsult;
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => !disabled && updateForm("clinicConsultKind", kind)}
                            disabled={disabled}
                            aria-pressed={selected}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              selected
                                ? bookingTone.cardSelected
                                : disabled
                                  ? "cursor-not-allowed border-neutral-100 bg-neutral-50/70 text-neutral-400"
                                  : "border-neutral-100 bg-white hover:border-neutral-300 hover:bg-neutral-50/70"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-bold text-slate-900">{getClinicConsultKindLabel(kind)}</p>
                              {selected ? (
                                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${bookingTone.selectedBadge}`}>
                                  <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />
                                  Active
                                </span>
                              ) : disabled ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                                  Locked
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {kind === "FollowUp"
                                ? disabled
                                  ? "Unavailable for existing patient records."
                                  : "Returning visit after a prior clinic consultation."
                                : "First in-clinic consultation before any follow-up rate applies."}
                            </p>
                            <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                              selected ? bookingTone.priceBadge : "border-neutral-200 bg-white text-neutral-700"
                            }`}>
                              {disabled ? `${peso(getClinicConsultKindFee("FirstConsult", bookingPricing))} only` : peso(getClinicConsultKindFee(kind, bookingPricing))}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {canChooseFollowUpClinicConsult ? null : (
                      <p className="mt-3 text-xs leading-5 text-neutral-600">
                        Existing patient records use the standard clinic consult rate and cannot select the follow-up-only option.
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="mt-8 rounded-2xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700">Type of Service</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Choose the main service for this {getVisitPathLabel(formData.visitPath).toLowerCase()}.
                      </p>
                    </div>
                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-700">
                      Required
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {serviceOptions.map((service) => {
                      const selected = formData.service === service;
                      const priceLabel = getBookingServicePriceLabel(
                        service,
                        formData.visitPath,
                        formData.type,
                        hasExistingPatientRecord ? "FirstConsult" : formData.clinicConsultKind,
                        bookingPricing,
                      );
                      const description = getServiceDescription(service);
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => updateForm("service", service)}
                          aria-pressed={selected}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? bookingTone.cardSelected
                              : "border-neutral-100 bg-white hover:border-neutral-300 hover:bg-neutral-50/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold text-slate-900">{service}</p>
                            {selected ? (
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${bookingTone.selectedBadge}`}>
                                <FaCheck className="h-2.5 w-2.5" aria-hidden="true" />
                                Active
                              </span>
                            ) : null}
                          </div>
                          {description ? (
                            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
                          ) : null}
                          {priceLabel ? (
                            <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                              selected ? bookingTone.priceBadge : "border-neutral-200 bg-white text-neutral-700"
                            }`}>
                              {priceLabel}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {isProcedureBooking ? (
                    <div className="mt-4 rounded-[1.25rem] border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm leading-6 text-neutral-800">
                      Procedure prices depend on the area of concern. A {peso(procedureReservationAmount)} reservation fee is required to confirm the schedule and will be deducted from the final bill. Consultation is charged separately.
                    </div>
                  ) : null}
                </div>
                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="fullname" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Full Name *</label>
                    <input 
                      id="fullname"
                      type="text" 
                      value={effectivePatientName} 
                      onChange={(e) => updateForm("patientName", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200" 
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
                      className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200" 
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
                      className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200" 
                      placeholder="+63 912 345 6789" 
                      autoComplete="tel" 
                    />
                  </div>
                  {patientDetailsRequired ? (
                    <div className="lg:col-span-3 sm:col-span-2 rounded-[1.4rem] border border-neutral-200 bg-neutral-50/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">Patient record details</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            These details are used to create or update the patient record when the booking is submitted.
                          </p>
                        </div>
                        <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-700">
                          Required
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor="dob" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Date of Birth *</label>
                          <input
                            id="dob"
                            type="date"
                            value={formData.dateOfBirth}
                            max={maxBirthDate}
                            onChange={(e) => updateForm("dateOfBirth", e.target.value)}
                            className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="gender" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Gender *</label>
                          <div className="relative">
                            <select
                              id="gender"
                              value={formData.gender}
                              onChange={(e) => updateForm("gender", e.target.value)}
                              className={`w-full appearance-none rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 pr-9 text-sm outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200 ${
                                formData.gender ? "text-slate-900" : "text-slate-400"
                              }`}
                              required
                            >
                              <option value="">Select gender</option>
                              {GENDER_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="none"
                              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                              aria-hidden="true"
                            >
                              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="civil-status" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Civil Status</label>
                          <div className="relative">
                            <select
                              id="civil-status"
                              value={formData.civilStatus}
                              onChange={(e) => updateForm("civilStatus", e.target.value)}
                              className={`w-full appearance-none rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 pr-9 text-sm outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200 ${
                                formData.civilStatus ? "text-slate-900" : "text-slate-400"
                              }`}
                            >
                              <option value="">Select civil status</option>
                              {CIVIL_STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="none"
                              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                              aria-hidden="true"
                            >
                              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="address" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Address *</label>
                          <input
                            id="address"
                            type="text"
                            value={formData.address}
                            onChange={(e) => updateForm("address", e.target.value)}
                            className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                            placeholder="Street, city, province"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="religion" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Religion</label>
                          <input
                            id="religion"
                            type="text"
                            value={formData.religion}
                            onChange={(e) => updateForm("religion", e.target.value)}
                            className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label htmlFor="occupation" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Occupation</label>
                          <input
                            id="occupation"
                            type="text"
                            value={formData.occupation}
                            onChange={(e) => updateForm("occupation", e.target.value)}
                            className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label htmlFor="guardian" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                            Guardian name {guardianRequired ? "*" : ""}
                          </label>
                          <input
                            id="guardian"
                            type="text"
                            value={formData.guardianName}
                            onChange={(e) => updateForm("guardianName", e.target.value)}
                            className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
                            placeholder="Parent or guardian"
                            required={guardianRequired}
                          />
                          <p className="mt-2 text-xs text-slate-500">Required for patients under 18.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="lg:col-span-3 sm:col-span-2 rounded-[1.4rem] border border-teal-100 bg-teal-50/70 p-4 shadow-sm text-sm text-teal-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">Saved patient record</p>
                      <p className="mt-1 leading-6">
                        You selected an existing patient. If your name, email, or phone matches a saved record, the clinic will reuse the patient details and you do not need to enter them again.
                      </p>
                    </div>
                  )}
                  <div className="lg:col-span-3 sm:col-span-2">
                    <label htmlFor="reason" className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {isProcedureBooking
                        ? "Area of Concern / Procedure Notes"
                        : formData.type === "Online"
                          ? "Concern / Chief Complaint"
                          : "Reason for Visit"}{" "}
                      <span className="font-normal text-slate-500">{isProcedureBooking ? "(Required)" : "(Optional)"}</span>
                    </label>
                    <input 
                      id="reason"
                      type="text" 
                      value={formData.reason} 
                      onChange={(e) => updateForm("reason", e.target.value)} 
                      className="w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200" 
                      placeholder={
                        isProcedureBooking
                          ? "e.g., Botox forehead lines, wart removal on neck, Mesolipo double chin"
                          : formData.type === "Online"
                            ? "e.g., headache, cough, medication concern"
                            : "e.g., Follow-up checkup, lab result review, consultation"
                      }
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
                          className="min-h-28 w-full rounded-[1.2rem] border border-neutral-100 bg-white px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-neutral-400 focus:bg-neutral-50/30 focus:ring-4 focus:ring-neutral-200"
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
                          className="w-full rounded-[1.2rem] border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-200"
                        />
                        {uploadedConcernFiles.some((file) => isPreviewableImage(file)) ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {uploadedConcernFiles.map((file, index) =>
                              isPreviewableImage(file) ? (
                                <div
                                  key={`${file.file_name}-preview-${index}`}
                                  className="overflow-hidden rounded-[1.1rem] border border-neutral-200 bg-white shadow-sm"
                                >
                                  <div className="aspect-[4/3] bg-neutral-50">
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
                                      className="shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
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
                                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
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
              <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-5">
                  <div className="rounded-4xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">Step 3 of 4</p>
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
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${bookingTone.priceBadge}`}
                        >
                          <FaBolt className="h-3 w-3" aria-hidden="true" />
                          Next: {formatDisplayDate(nextAvailableSlot.date)} {formatRange(nextAvailableSlot.slot.start, nextAvailableSlot.slot.end)}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 rounded-[1.75rem] border border-neutral-100 bg-[linear-gradient(180deg,#fafafa_0%,#f5f5f5_100%)] p-5">
                      <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">Calendar Selection</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart((current) => {
                              const candidate = addDays(current, -7);
                              return candidate < today ? today : candidate;
                            })}
                            disabled={calendarWeekStart <= today}
                            className="rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleWeekStart(addDays(calendarWeekStart, 7))}
                            className="rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50"
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
                                    ? `${bookingTone.cardSelected} text-slate-950`
                                    : isPast
                                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                                    : `${bookingTone.cardIdle} text-slate-900`
                                }`}
                            >
                                {isToday && !isSelected ? (
                                  <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                ) : null}
                              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${isSelected ? "text-slate-700" : "text-slate-500"}`}>
                                {dayLabel}
                              </p>
                              <p className={`mt-1 text-xl font-black leading-none ${isSelected ? "text-slate-950" : isPast ? "text-slate-400" : "text-slate-900"}`}>
                                {dayNum}
                              </p>
                              <p className={`mt-1 text-[10px] font-medium ${isSelected ? "text-slate-700" : "text-slate-500"}`}>
                                {isToday ? "Today" : monthLabel}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-neutral-100">
                        <label htmlFor="datepicker" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Or pick a specific date</label>
                        <input 
                          id="datepicker"
                          type="date" 
                          value={formData.date}
                          min={today}
                          onChange={(e) => updateForm("date", e.target.value)}
                          className="w-full cursor-pointer rounded-[1.1rem] border border-neutral-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-200 sm:w-auto"
                        />
                      </div>
                    </div>

                    {blockedReason ? (
                      <div className="mt-5 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 shadow-sm font-medium">
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

                <div className="rounded-4xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_20px_45px_rgba(17,17,17,0.08)] h-fit sm:p-5 2xl:sticky 2xl:top-24">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-700">
                    <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                    Booking Summary
                  </p>
                  
                  <div className="mt-4 rounded-3xl border border-neutral-200 bg-[linear-gradient(180deg,#fafafa_0%,#f5f5f5_100%)] p-4.5 shadow-sm">
                    <div className="space-y-3">
                      <SummaryRow label="Visit Type" value={<VisitPathValue path={formData.visitPath} />} done />
                      <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                      <div className="h-px bg-linear-to-r from-neutral-200 to-transparent my-2" />
                      <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={!!formData.date} />
                      <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "Choose a slot"} done={!!selectedSlot} />
                      <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={!!selectedSlot} />
                      <div className="h-px bg-linear-to-r from-neutral-200 to-transparent my-2" />
                      <SummaryRow label="Queue #" value={selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "—"} done={!!selectedSlot} />
                    </div>
                  </div>

                  {formData.type === "Online" || isProcedureBooking ? (
                    <div className="mt-4 rounded-[1.4rem] border border-neutral-200 bg-neutral-50 px-3.5 py-3.5 text-xs">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-neutral-800">
                        <FaCreditCard className="h-3 w-3" aria-hidden="true" />
                        Payment Info
                      </p>
                      <p className="mt-1.5 text-neutral-700">
                        {isProcedureBooking
                          ? `Medical procedures require a ${peso(procedureReservationAmount)} reservation fee to confirm the schedule. It is deducted from the final bill.`
                          : "Virtual consults require payment first. You'll choose QR, card, or bank transfer on the review step."}
                      </p>
                    </div>
                  ) : null}

                </div>
              </section>

              <WizardNav showBack onBack={goBack} onNext={goNext} nextDisabled={!step3Valid} nextLabel="Review & Confirm" />
            </>
          ) : null}

          {activeStep === 4 ? (
            <section className="rounded-4xl border border-neutral-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-4 shadow-[0_22px_48px_rgba(17,17,17,0.08)] sm:p-6">
              <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700">Step 4 of 4</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {requiresOnlinePayment ? "Review & Proceed to Payment" : "Review & Confirm"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">Please review your appointment details before confirming</p>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="space-y-4 rounded-[1.75rem] border border-neutral-100 bg-[linear-gradient(180deg,#fafafa_0%,#e5e5e5_100%)] p-5 shadow-sm sm:p-6">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 mb-3">
                          <FaClipboardList className="h-3 w-3" aria-hidden="true" />
                          Appointment Details
                        </p>
                        <div className="space-y-3">
                          <SummaryRow label="Patient Type" value={formData.patientStatus} done={step1Valid} />
                          <SummaryRow label="Visit Type" value={<VisitPathValue path={formData.visitPath} />} done />
                          {formData.type === "Clinic" ? <SummaryRow label="Clinic" value={selectedClinic.label} done={!!formData.clinicId} /> : null}
                          {appointmentClinicConsultKind ? (
                            <SummaryRow label="Consult Type" value={appointmentClinicConsultLabel} done />
                          ) : null}
                          <SummaryRow label="Service" value={formData.service} done={!!formData.service} />
                          {isProcedureBooking ? (
                            <SummaryRow label="Starting Price" value={getServicePriceLabel(formData.service, bookingPricing) ?? "Consultation required"} done />
                          ) : null}
                          <SummaryRow label="Doctor" value={selectedDoctor?.name ?? "-"} done />
                          <div className="h-px bg-linear-to-r from-neutral-200 to-transparent" />
                          <SummaryRow label="Date" value={formatDisplayDate(formData.date)} done={datePicked} />
                          <SummaryRow label="Time" value={selectedSlot ? formatRange(selectedSlot.start, selectedSlot.end) : "-"} done={step3Valid} />
                          <SummaryRow label="Duration" value={selectedSlot ? selectedSlotDuration : "-"} done={step3Valid} />
                          {selectedSlot ? <SummaryRow label="Queue #" value={`#${selectedSlot.nextQueueNumber}`} done /> : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200">
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 mb-3">
                          <FaUser className="h-3 w-3" aria-hidden="true" />
                          Patient Information
                        </p>
                        <div className="space-y-3 text-sm">
                          <SummaryRow label="Patient Type" value={formData.patientStatus} done={step1Valid} />
                          <SummaryRow label="Name" value={effectivePatientName} done={step2Valid} />
                          <SummaryRow label="Email" value={effectivePatientEmail} done={step2Valid} />
                          <SummaryRow label="Phone" value={effectivePatientPhone} done={step2Valid} />
                          <SummaryRow label="Service" value={formData.service} done={!!formData.service} />
                          {formData.reason ? <SummaryRow label={isProcedureBooking ? "Area / Notes" : "Reason"} value={formData.reason} done /> : null}
                          {formData.type === "Online" && formData.symptoms ? <SummaryRow label="Symptoms" value={formData.symptoms} done /> : null}
                          {formData.type === "Online" && uploadedConcernFiles.length > 0 ? (
                            <SummaryRow label="Attached Files" value={`${uploadedConcernFiles.length} file${uploadedConcernFiles.length === 1 ? "" : "s"} ready`} done />
                          ) : null}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 mb-3">Payment Info</p>
                        {!isProcedureBooking ? (
                          <SummaryRow
                            label={formData.type === "Online" ? "Consultation Fee" : "Clinic Fee"}
                            value={getConsultationFeeLabel(formData.type, hasExistingPatientRecord ? "FirstConsult" : formData.clinicConsultKind, bookingPricing)}
                            done
                          />
                        ) : null}
                        {requiresOnlinePayment ? (
                            <SummaryRow
                            label="Payment Method"
                            value="PayMongo QR Ph"
                            done
                          />
                        ) : null}
                        {isProcedureBooking ? (
                          <>
                            <SummaryRow label="Reservation Fee" value={peso(procedureReservationAmount)} done />
                            <SummaryRow label="Billing Note" value="Deductible from final procedure bill; consultation charged separately" done />
                          </>
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
                        <div className="border-t border-neutral-200 pt-5">
                          <div className="rounded-lg border border-neutral-300 bg-white p-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-600">Required before payment</p>
                                <p className="mt-1 text-sm font-black text-black">Consent & aftercare for {formData.service}</p>
                                <p className="mt-1 text-xs leading-5 text-neutral-600">Review the actual procedure consent, read the specific aftercare, and sign on screen.</p>
                              </div>
                              {hasCompleteProcedureConsent ? <span className="rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white">Signed</span> : null}
                            </div>
                            <button type="button" onClick={() => setIsProcedureConsentModalOpen(true)} className="mt-4 rounded-full bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                              {procedureConsentAccepted ? "Review signed consent" : "Review & sign consent"}
                            </button>
                            {procedureConsentIssue ? <p className="mt-3 text-xs font-semibold text-neutral-700">{procedureConsentIssue}</p> : null}
                            {!selectedAftercareGuide ? <p className="mt-3 text-xs font-semibold text-red-700">Procedure-specific aftercare is not available yet. Please choose another service or contact the clinic.</p> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.75rem] border-2 border-neutral-300 bg-[linear-gradient(180deg,#ffffff_0%,#f5f5f5_100%)] p-5 shadow-md h-fit sm:p-6 lg:sticky lg:top-24">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
                        {requiresOnlinePayment ? (
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
                      <p className="mt-4 text-3xl font-black text-neutral-800">
                        {formData.type === "Online"
                          ? "Pay Now"
                          : isProcedureBooking
                            ? "Pay Reservation"
                            : `Queue ${selectedSlot?.nextQueueNumber ? `#${selectedSlot.nextQueueNumber}` : "--"}`}
                      </p>
                      <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                        {formData.type === "Online"
                          ? "Complete payment through PayMongo QR Ph. It accepts GCash, Maya, and bank apps, then we’ll confirm your booking after verification."
                          : isProcedureBooking
                            ? `A ${peso(procedureReservationAmount)} reservation fee confirms your procedure schedule and is deducted from the final procedure bill. Consultation is billed separately.`
                            : selectedSlot
                            ? `Your appointment is confirmed for ${formatRange(selectedSlot.start, selectedSlot.end)}`
                            : "Select a time slot first"}
                      </p>

                      {requiresOnlinePayment ? (
                        <div className="mt-4 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-sky-900">PayMongo QR Ph</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 shadow-sm border border-sky-200">
                              <FaLock className="h-2.5 w-2.5" aria-hidden="true" />
                              QR checkout
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-sky-900">
                            You will be redirected to PayMongo to complete the payment through QR Ph. It works with GCash, Maya, and bank apps, and the booking is confirmed after payment verification.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-sky-800">
                            <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-sky-200">Virtual consults</span>
                            <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-sky-200">Procedure reservation fee</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!accessToken && (
                    <div className="rounded-[1.4rem] border border-neutral-300 bg-neutral-50 px-4 py-4">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 mb-3">
                        <FaLock className="h-3.5 w-3.5" aria-hidden="true" />
                        Sign In Required
                      </p>
                      <p className="text-sm text-neutral-700 mb-4">You must sign in or create an account to complete your booking.</p>
                      <div className="flex gap-3 flex-col sm:flex-row">
                        <Link href={`/login?next=${encodeURIComponent(authReturnPath)}`} className="flex-1 rounded-full bg-black text-white px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-black">
                          Sign In
                        </Link>
                        <Link href={`/register?next=${encodeURIComponent(authReturnPath)}`} className="flex-1 rounded-full border border-neutral-300 bg-white text-neutral-700 px-4 py-2.5 text-sm font-semibold text-center transition hover:bg-neutral-50">
                          Create Account
                        </Link>
                      </div>
                    </div>
                  )}
                </>

              <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center">
                <button type="button" onClick={goBack} className="order-2 inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:order-1">
                  <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
                  Back
                </button>
                <div className="order-1 flex flex-1 flex-col gap-3 sm:order-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setFormData({ ...INITIAL_FORM, doctorId: formData.doctorId }); setFeedback(null); setActiveStep(1); setVisibleWeekStart(today); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50">
                    <FaArrowRotateLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Start Over
                  </button>
                  <button type="submit" disabled={isLoading || isSubmitting || !step4Done || !accessToken} className="rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(17,17,17,0.28)] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Processing..." : requiresOnlinePayment ? "Proceed to Payment" : "Confirm Appointment"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </form>
      {isProcedureConsentModalOpen && isProcedureBooking ? (
        <ProcedureConsentModal
          procedureName={formData.service}
          patientName={effectivePatientName}
          aftercareGuide={selectedAftercareGuide}
          initialSignatureDataUrl={procedureConsentSignature}
          initialSignatureName={procedureConsentSignatureName}
          initialConsentAccepted={procedureConsentAccepted}
          initialAftercareAcknowledged={procedureAftercareAcknowledged}
          onClose={() => setIsProcedureConsentModalOpen(false)}
          onComplete={({ signatureDataUrl, signatureName, consentAccepted, aftercareAcknowledged }) => {
            setProcedureConsentSignature(signatureDataUrl);
            setProcedureConsentSignatureName(signatureName);
            setProcedureConsentAccepted(consentAccepted);
            setProcedureAftercareAcknowledged(aftercareAcknowledged);
            setIsProcedureConsentModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function HorizontalBookingStepper({
  labels,
  activeStep,
  onStepClick,
  visitPath,
  children,
}: {
  labels: readonly string[];
  activeStep: number;
  onStepClick: (step: number) => void;
  visitPath: BookingVisitPath;
  children?: ReactNode;
}) {
  const currentStepAccent =
    visitPath === "Online"
      ? "bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_24px_rgba(14,165,233,0.24)]"
      : visitPath === "Procedure"
        ? "bg-[linear-gradient(135deg,#f6d76a,#c99700)] text-white shadow-[0_12px_24px_rgba(201,151,0,0.28)]"
        : "bg-linear-to-br from-teal-500 to-emerald-600 text-white shadow-[0_12px_24px_rgba(20,184,166,0.24)]";
  const completeStepAccent =
    visitPath === "Online"
      ? "bg-sky-500 text-white shadow-sm"
      : visitPath === "Procedure"
        ? "bg-[linear-gradient(135deg,#e4bf52,#b8870b)] text-white shadow-sm"
        : "bg-teal-500 text-white shadow-sm";
  const completeStepLine =
    visitPath === "Online"
      ? "bg-sky-500"
      : visitPath === "Procedure"
        ? "bg-[#c99700]"
        : "bg-teal-500";

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
                    className={`hidden mt-5 h-0.5 min-w-1.5 flex-1 ${isComplete ? completeStepLine : "bg-neutral-100"} sm:block`}
                    aria-hidden
                  />
                ) : null}
                <div className="flex min-w-0 flex-col items-center sm:w-32 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => onStepClick(step)}
                    title={`Step ${step}: ${label}`}
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${
                      isCurrent
                        ? currentStepAccent
                        : isComplete
                        ? completeStepAccent
                        : "bg-neutral-50 text-neutral-700 ring-2 ring-neutral-200"
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
        <button type="button" onClick={onBack} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto">
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
