"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FaCalendarCheck,
  FaCreditCard,
  FaDownload,
  FaFileMedical,
  FaFileLines,
  FaLock,
  FaPaperPlane,
  FaPrescriptionBottleMedical,
  FaPrint,
  FaRegMessage,
  FaShieldHalved,
  FaStethoscope,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import { getClinicToday } from "@/src/lib/timezone";

type Prescription = {
  id: string;
  prescription_no: string;
  created_at: string;
  follow_up_date: string | null;
  general_instructions: string | null;
  diagnoses?: {
    diagnosis_text?: string | null;
    treatment_plan?: string | null;
  } | null;
  prescription_items?: Array<{
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
    sort_order?: number | null;
  }>;
};

type PatientFile = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
};

type BillingRecord = {
  id: string;
  total: number;
  status: "Draft" | "Issued" | "Paid" | "Void";
  issued_at: string | null;
  created_at: string;
};

type FollowUpInquiry = {
  id: string;
  message: string;
  reply: string | null;
  status: "Pending" | "Replied" | "Closed";
  created_at: string;
};

type PortalData = {
  prescriptions: Prescription[];
  files: PatientFile[];
  billings: BillingRecord[];
  inquiries: FollowUpInquiry[];
};

const EMPTY_PORTAL_DATA: PortalData = {
  prescriptions: [],
  files: [],
  billings: [],
  inquiries: [],
};

function money(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateTime(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PatientPortalPage() {
  const { accessToken, profile, user, role, isLoading: authLoading } = useRole();
  const { appointments, isLoading: appointmentsLoading } = useAppointments();
  const { data: notes, isLoading: notesLoading } = useConsultationNotes();
  const [portalData, setPortalData] = useState<PortalData>(EMPTY_PORTAL_DATA);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );

  useEffect(() => {
    if (!accessToken || !headers) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const [prescriptionsRes, filesRes, billingsRes, inquiriesRes] = await Promise.all([
          fetch("/api/v2/prescriptions", { cache: "no-store", headers }),
          fetch("/api/v2/patient-files", { cache: "no-store", headers }),
          fetch("/api/v2/billings", { cache: "no-store", headers }),
          fetch("/api/v2/follow-up-inquiries", { cache: "no-store", headers }),
        ]);

        const [prescriptionsPayload, filesPayload, billingsPayload, inquiriesPayload] = await Promise.all([
          prescriptionsRes.ok ? prescriptionsRes.json() : Promise.resolve({ prescriptions: [] }),
          filesRes.ok ? filesRes.json() : Promise.resolve({ files: [] }),
          billingsRes.ok ? billingsRes.json() : Promise.resolve({ billings: [] }),
          inquiriesRes.ok ? inquiriesRes.json() : Promise.resolve({ inquiries: [] }),
        ]);

        if (!active) return;
        setPortalData({
          prescriptions: prescriptionsPayload.prescriptions ?? [],
          files: filesPayload.files ?? [],
          billings: billingsPayload.billings ?? [],
          inquiries: inquiriesPayload.inquiries ?? [],
        });
        setFeedback(null);
      } catch {
        if (active) setFeedback("Some portal sections could not be loaded. Please refresh and try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accessToken, headers]);

  const today = getClinicToday();
  const upcoming = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date >= today && appointment.status !== "Completed")
        .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`)),
    [appointments, today],
  );
  const history = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date < today || appointment.status === "Completed")
        .sort((left, right) => `${right.date} ${right.start}`.localeCompare(`${left.date} ${left.start}`)),
    [appointments, today],
  );
  const latestNote = notes[0] ?? null;
  const latestPrescription = portalData.prescriptions[0] ?? null;
  const latestBilling = portalData.billings[0] ?? null;
  const latestFile = portalData.files[0] ?? null;
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Patient";

  async function downloadPrescription(item: Prescription) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      setFeedback("Unable to download prescription PDF.");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.prescription_no}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function printPrescription(item: Prescription) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      setFeedback("Unable to open printable prescription.");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setFeedback("Pop-up blocked. Please allow pop-ups to print the prescription.");
      window.URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.print();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  if (authLoading || appointmentsLoading || notesLoading || isLoading) {
    return <div className="h-72 animate-pulse rounded-[2rem] border border-neutral-200 bg-white shadow-sm" />;
  }

  if (role !== "PATIENT") {
    return (
      <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-6 text-sm font-semibold text-neutral-700">
        Patient Portal is only available for patient accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.12),transparent_34%),linear-gradient(135deg,#f7f7f5_0%,#ffffff_58%,#f7f7f5_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.12)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-700">Patient Portal</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
              Your secure clinic account
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              Hi {name}. Access appointments, released medical notes, prescriptions, billing, files, and follow-up messages from one place.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
              <FaShieldHalved className="text-black" />
              Secure login active
            </p>
            <p className="mt-1 text-xs text-neutral-500">{profile?.email ?? user?.email}</p>
          </div>
        </div>
      </section>

      {feedback ? <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">{feedback}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric href="/appointments/my" icon={<FaCalendarCheck />} label="Appointments" value={appointments.length} helper={`${upcoming.length} upcoming`} />
        <Metric href="/consultations/history" icon={<FaStethoscope />} label="Released Notes" value={notes.length} helper="Allowed by doctor" />
        <Metric href="/prescriptions" icon={<FaPrescriptionBottleMedical />} label="Prescriptions" value={portalData.prescriptions.length} helper="PDF and print ready" />
        <Metric href="/payments/history" icon={<FaCreditCard />} label="Billing Records" value={portalData.billings.length} helper="Receipts and balances" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <PortalSection
          title="Appointment History"
          actionHref="/appointments/my"
          actionLabel="View all"
          icon={<FaCalendarCheck />}
        >
          <div className="space-y-3">
            {[...upcoming, ...history].slice(0, 4).map((appointment) => (
              <Row key={appointment.id} href={`/appointments/my?appointment=${appointment.id}`}>
                <div>
                  <p className="font-bold text-black">{formatDisplayDate(appointment.date)} - {formatRange(appointment.start, appointment.end)}</p>
                  <p className="mt-1 text-sm text-neutral-500">{getDoctorById(appointment.doctorId)?.name ?? "Assigned doctor"} - {appointment.status}</p>
                </div>
              </Row>
            ))}
            {appointments.length === 0 ? <Empty text="No appointments yet." /> : null}
          </div>
        </PortalSection>

        <PortalSection
          title="Book Another Appointment"
          actionHref="/appointments"
          actionLabel="Book now"
          icon={<FaCalendarCheck />}
        >
          <p className="text-sm leading-6 text-neutral-600">
            Schedule a clinic visit or online consultation from your portal account.
          </p>
          <Link className="mt-4 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white" href="/appointments">
            Book appointment
          </Link>
        </PortalSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PortalSection title="Diagnosis & Allowed Notes" actionHref="/consultations/history" actionLabel="Open history" icon={<FaFileLines />}>
          {latestNote ? (
            <div className="space-y-3 text-sm text-neutral-700">
              <p><span className="font-semibold text-black">Diagnosis:</span> {latestNote.diagnosis || "No diagnosis recorded."}</p>
              <p><span className="font-semibold text-black">Doctor note:</span> {latestNote.note || "No note released."}</p>
              <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
                Only notes marked visible by your doctor are shown here.
              </p>
            </div>
          ) : <Empty text="No doctor-released consultation notes yet." />}
        </PortalSection>

        <PortalSection title="Prescriptions" actionHref="/prescriptions" actionLabel="Open prescriptions" icon={<FaPrescriptionBottleMedical />}>
          {latestPrescription ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-black">{latestPrescription.prescription_no}</p>
                <p className="mt-1 text-sm text-neutral-500">{latestPrescription.diagnoses?.diagnosis_text ?? "Released prescription"}</p>
              </div>
              {latestPrescription.diagnoses?.treatment_plan ? (
                <div className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Treatment plan</p>
                  <p className="mt-1">{latestPrescription.diagnoses.treatment_plan}</p>
                </div>
              ) : null}
              {latestPrescription.follow_up_date ? (
                <p className="text-sm text-neutral-600">
                  <span className="font-semibold text-black">Follow-up date:</span>{" "}
                  {dateTime(latestPrescription.follow_up_date)}
                </p>
              ) : null}
              {latestPrescription.general_instructions ? (
                <p className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-600">
                  <span className="font-semibold text-black">Instructions:</span>{" "}
                  {latestPrescription.general_instructions}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => downloadPrescription(latestPrescription)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">
                  <FaDownload /> Download PDF
                </button>
                <button onClick={() => printPrescription(latestPrescription)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
                  <FaPrint /> Print
                </button>
              </div>
            </div>
          ) : <Empty text="No released prescriptions yet." />}
        </PortalSection>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PortalSection title="Billing History" actionHref="/payments/history" actionLabel="View bills" icon={<FaCreditCard />}>
          {latestBilling ? (
            <div>
              <p className="text-sm font-bold text-black">{money(Number(latestBilling.total))}</p>
              <p className="mt-1 text-sm text-neutral-500">{latestBilling.status} - {dateTime(latestBilling.issued_at ?? latestBilling.created_at)}</p>
            </div>
          ) : <Empty text="No billing records yet." />}
        </PortalSection>

        <PortalSection title="Medical Files" actionHref="/profile/files" actionLabel="Open files" icon={<FaFileMedical />}>
          {latestFile ? (
            <a href={latestFile.file_url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-neutral-200 p-4 transition hover:bg-neutral-50">
              <p className="text-sm font-bold text-black">{latestFile.file_name}</p>
              <p className="mt-1 text-sm text-neutral-500">{latestFile.file_type || "Medical document"} - {dateTime(latestFile.created_at)}</p>
            </a>
          ) : <Empty text="No released medical files yet." />}
        </PortalSection>

        <PortalSection title="Follow-up Inquiry" actionHref="/profile/inquiries" actionLabel="Send message" icon={<FaRegMessage />}>
          {portalData.inquiries[0] ? (
            <div>
              <p className="text-sm font-bold text-black">{portalData.inquiries[0].status}</p>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{portalData.inquiries[0].message}</p>
            </div>
          ) : (
            <div>
              <Empty text="No follow-up inquiries yet." />
                <Link href="/profile/inquiries" className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">
                <FaPaperPlane /> Ask a question
              </Link>
            </div>
          )}
        </PortalSection>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
          <FaLock className="text-black" />
          Medical-note privacy
        </p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Hindi lahat ng medical notes ipinapakita sa patient portal. Diagnosis, consultation notes, prescriptions, and files appear only when the doctor or clinic marks them visible to the patient.
        </p>
      </section>
    </div>
  );
}

function Metric({ href, icon, label, value, helper }: { href: string; icon: ReactNode; label: string; value: number; helper: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
        <span className="text-xl text-black">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-black text-black">{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{helper}</p>
    </Link>
  );
}

function PortalSection({ title, icon, actionHref, actionLabel, children }: { title: string; icon: ReactNode; actionHref: string; actionLabel: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-black">
          <span className="text-black">{icon}</span>
          {title}
        </h2>
        <Link href={actionHref} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700">
          {actionLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function Row({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:bg-neutral-50">
      {children}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">{text}</p>;
}
