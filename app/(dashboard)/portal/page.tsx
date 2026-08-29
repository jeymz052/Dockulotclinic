"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FaCalendarCheck,
  FaChevronRight,
  FaCreditCard,
  FaDownload,
  FaFileMedical,
  FaFileLines,
  FaFileSignature,
  FaLock,
  FaPaperPlane,
  FaPrescriptionBottleMedical,
  FaPrint,
  FaStethoscope,
  FaVideo,
} from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { useRole } from "@/src/components/layout/RoleProvider";
import { ActionCard, DashboardHero, MetricCard, SectionCard } from "@/src/components/dashboard/dashboard-ui";
import { getAppointmentPrimaryLabel, getAppointmentSecondaryReason } from "@/src/lib/appointment-context";
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

type ProcedureConsent = {
  id: string;
  procedure_name: string;
  patient_name: string;
  consent_form_url: string;
  aftercare_acknowledged: boolean;
  aftercare_guide_title: string | null;
  patient_signature: string;
  witness_signature: string | null;
  physician_signature: string | null;
  signed_at: string;
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
  consents: ProcedureConsent[];
  billings: BillingRecord[];
  inquiries: FollowUpInquiry[];
};

const EMPTY_PORTAL_DATA: PortalData = {
  prescriptions: [],
  files: [],
  consents: [],
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

function shortDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
        const [prescriptionsRes, filesRes, consentsRes, billingsRes, inquiriesRes] = await Promise.all([
          fetch("/api/v2/prescriptions", { cache: "no-store", headers }),
          fetch("/api/v2/patient-files", { cache: "no-store", headers }),
          fetch("/api/v2/procedure-consents", { cache: "no-store", headers }),
          fetch("/api/v2/billings", { cache: "no-store", headers }),
          fetch("/api/v2/follow-up-inquiries", { cache: "no-store", headers }),
        ]);

        const [prescriptionsPayload, filesPayload, consentsPayload, billingsPayload, inquiriesPayload] = await Promise.all([
          prescriptionsRes.ok ? prescriptionsRes.json() : Promise.resolve({ prescriptions: [] }),
          filesRes.ok ? filesRes.json() : Promise.resolve({ files: [] }),
          consentsRes.ok ? consentsRes.json() : Promise.resolve({ consents: [] }),
          billingsRes.ok ? billingsRes.json() : Promise.resolve({ billings: [] }),
          inquiriesRes.ok ? inquiriesRes.json() : Promise.resolve({ inquiries: [] }),
        ]);

        if (!active) return;
        setPortalData({
          prescriptions: prescriptionsPayload.prescriptions ?? [],
          files: filesPayload.files ?? [],
          consents: consentsPayload.consents ?? [],
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
  const latestConsent = portalData.consents[0] ?? null;
  const latestBilling = portalData.billings[0] ?? null;
  const latestFile = portalData.files[0] ?? null;
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Patient";
  const nextAppointment = upcoming[0] ?? null;
  const completedAppointments = appointments.filter((appointment) => appointment.status === "Completed").length;
  const clinicVisits = appointments.filter((appointment) => appointment.type === "Clinic").length;
  const virtualVisits = appointments.filter((appointment) => appointment.type === "Online").length;
  const documentCount = portalData.prescriptions.length + portalData.consents.length + portalData.files.length;
  const heroSummary = nextAppointment
    ? `Next: ${formatDisplayDate(nextAppointment.date)} at ${nextAppointment.start}`
    : "Everything is up to date";

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
      <DashboardHero
        eyebrow="Patient Portal"
        title={`Welcome, ${name}`}
        description="Your appointment, records, prescriptions, bills, and messages live here in one clean overview."
        summary={heroSummary}
        accent="gold"
      />

      {feedback ? <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">{feedback}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric href="/appointments/my" icon={<FaCalendarCheck />} label="Appointments" value={appointments.length} helper={`${upcoming.length} upcoming`} />
        <Metric href="/consultations/history" icon={<FaStethoscope />} label="Released Notes" value={notes.length} helper="Allowed by doctor" />
        <Metric href="/profile/files" icon={<FaPrescriptionBottleMedical />} label="Prescriptions" value={portalData.prescriptions.length} helper="Open in Medical Documents" />
        <Metric href="/profile/files" icon={<FaFileSignature />} label="Documents" value={documentCount} helper="Consents and files" />
        <Metric href="/payments/history" icon={<FaCreditCard />} label="Billing Records" value={portalData.billings.length} helper="Receipts and balances" />
        <Metric href="/profile/inquiries" icon={<FaPaperPlane />} label="Follow-ups" value={portalData.inquiries.length} helper="Questions and replies" />
      </div>

      <SectionCard
        title="Your Next Appointment"
        description="A single glance to see what comes next."
        actionHref="/appointments/my"
        actionLabel="View all appointments"
      >
        {nextAppointment ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Upcoming visit</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-black">{formatDisplayDate(nextAppointment.date)}</h2>
                  <p className="mt-1 text-sm font-semibold text-neutral-600">{nextAppointment.start} - {nextAppointment.end}</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">Queue</p>
                  <p className="mt-1 text-2xl font-black text-black">#{nextAppointment.queueNumber}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-neutral-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Visit type</p>
                  <p className="mt-1 text-sm font-bold text-black">{nextAppointment.type === "Online" ? "Virtual consult" : "Clinic visit"}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Reason</p>
                  <p className="mt-1 text-sm font-bold text-black">{getAppointmentPrimaryLabel(nextAppointment.reason, nextAppointment.type)}</p>
                  <p className="mt-1 text-xs text-neutral-500">{getAppointmentSecondaryReason(nextAppointment.reason) || "No additional note provided."}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Status</p>
                <p className="mt-2 text-xl font-black text-black">{nextAppointment.status}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Doctor</p>
                <p className="mt-1 text-sm font-bold text-black">{getDoctorById(nextAppointment.doctorId)?.name ?? "Assigned doctor"}</p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Quick action</p>
                {nextAppointment.type === "Online" && nextAppointment.meetingLink ? (
                  <a
                    href={nextAppointment.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white"
                  >
                    <FaVideo className="h-4 w-4" />
                    Join consultation
                  </a>
                ) : (
                  <Link href="/appointments/my" className="mt-2 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white">
                    <FaChevronRight className="h-4 w-4" />
                    Open schedule
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
            <p className="text-base font-bold text-black">No upcoming appointments</p>
            <p className="mt-2 text-sm text-neutral-500">Book your next appointment when you’re ready.</p>
            <Link href="/appointments" className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white">
              Book appointment
            </Link>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Quick Actions"
        description="The common things patients need should never be far away."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard href="/appointments" title="Book Appointment" description="Start a clinic or virtual visit booking." tone="emerald" icon={<FaCalendarCheck className="text-lg" />} />
          <ActionCard href="/appointments/my" title="My Schedule" description="See upcoming and completed visits." tone="teal" icon={<FaCalendarCheck className="text-lg" />} />
          <ActionCard href="/consultations" title="Virtual Consult" description="Open your consultation lobby when it’s time." tone="sky" icon={<FaVideo className="text-lg" />} />
          <ActionCard href="/profile/files" title="Medical Documents" description="View consents, files, and released records." tone="indigo" icon={<FaFileSignature className="text-lg" />} />
          <ActionCard href="/profile/files" title="Prescriptions" description="Open released prescriptions inside Medical Documents." tone="cyan" icon={<FaPrescriptionBottleMedical className="text-lg" />} />
          <ActionCard href="/payments/history" title="Payment History" description="Review billing history, payment records, and receipts." tone="gold" icon={<FaCreditCard className="text-lg" />} />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard
          title="Documents & Notes"
          description="Recent records are grouped here so the portal stays usable even as it grows."
          actionHref="/profile/files"
          actionLabel="Open documents"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <RecordTile
              title="Latest Prescription"
              href="/profile/files"
              actionLabel="Open documents"
              emptyLabel="No released prescriptions yet."
              badge="Prescription"
              icon={<FaPrescriptionBottleMedical />}
            >
              {latestPrescription ? (
                <div className="space-y-3 text-sm text-neutral-700">
                  <p className="font-bold text-black">{latestPrescription.prescription_no}</p>
                  <p>{latestPrescription.diagnoses?.diagnosis_text ?? "Released prescription"}</p>
                  <p className="text-xs text-neutral-500">Created {dateTime(latestPrescription.created_at)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => downloadPrescription(latestPrescription)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">
                      <FaDownload className="h-3.5 w-3.5" /> Download
                    </button>
                    <button onClick={() => printPrescription(latestPrescription)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
                      <FaPrint className="h-3.5 w-3.5" /> Print
                    </button>
                  </div>
                </div>
              ) : null}
            </RecordTile>

            <RecordTile
              title="Latest Consent"
              href="/profile/files"
              actionLabel="Open consent"
              emptyLabel="No procedure consent records yet."
              badge="Consent"
              icon={<FaFileSignature />}
            >
              {latestConsent ? (
                <div className="space-y-3 text-sm text-neutral-700">
                  <p className="font-bold text-black">{latestConsent.procedure_name}</p>
                  <p>Signed {shortDate(latestConsent.signed_at)}</p>
                  <p className="text-xs text-neutral-500">
                    {latestConsent.aftercare_acknowledged ? "Aftercare acknowledged" : "Aftercare still pending"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/profile/files" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
                      View consent
                    </Link>
                    <a href={`/api/v2/procedure-consents/${latestConsent.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">
                      Download PDF
                    </a>
                  </div>
                </div>
              ) : null}
            </RecordTile>

            <RecordTile
              title="Latest Medical File"
              href="/profile/files"
              actionLabel="Open files"
              emptyLabel="No released medical files yet."
              badge="File"
              icon={<FaFileMedical />}
            >
              {latestFile ? (
                <div className="space-y-3 text-sm text-neutral-700">
                  <p className="font-bold text-black">{latestFile.file_name}</p>
                  <p>{latestFile.file_type || "Medical document"}</p>
                  <p className="text-xs text-neutral-500">Uploaded {dateTime(latestFile.created_at)}</p>
                  <a href={latestFile.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
                    Open file
                  </a>
                </div>
              ) : null}
            </RecordTile>

            <RecordTile
              title="Latest Notes"
              href="/consultations/history"
              actionLabel="Open history"
              emptyLabel="No doctor-released consultation notes yet."
              badge="Note"
              icon={<FaFileLines />}
            >
              {latestNote ? (
                <div className="space-y-3 text-sm text-neutral-700">
                  <p><span className="font-semibold text-black">Diagnosis:</span> {latestNote.diagnosis || "No diagnosis recorded."}</p>
                  <p><span className="font-semibold text-black">Doctor note:</span> {latestNote.note || "No note released."}</p>
                  <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
                    Only notes marked visible by your doctor are shown here.
                  </p>
                </div>
              ) : <Empty text="No doctor-released consultation notes yet." />}
            </RecordTile>
          </div>
        </SectionCard>

        <SectionCard
          title="Billing & Messages"
          description="The practical stuff lives here too."
          actionHref="/payments/history"
          actionLabel="View bills"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Billing</p>
              {latestBilling ? (
                <div className="mt-2">
                  <p className="text-sm font-bold text-black">{money(Number(latestBilling.total))}</p>
                  <p className="mt-1 text-sm text-neutral-500">{latestBilling.status} - {dateTime(latestBilling.issued_at ?? latestBilling.created_at)}</p>
                </div>
              ) : <p className="mt-2 text-sm text-neutral-500">No billing records yet.</p>}
            </div>
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Follow-up</p>
              {portalData.inquiries[0] ? (
                <div className="mt-2">
                  <p className="text-sm font-bold text-black">{portalData.inquiries[0].status}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-neutral-500">{portalData.inquiries[0].message}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <Empty text="No follow-up inquiries yet." />
                  <Link href="/profile/inquiries" className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">
                    <FaPaperPlane /> Ask a question
                  </Link>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
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

function RecordTile({
  title,
  icon,
  href,
  actionLabel,
  badge,
  emptyLabel,
  children,
}: {
  title: string;
  icon: ReactNode;
  href: string;
  actionLabel: string;
  badge: string;
  emptyLabel: string;
  children: ReactNode | null;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            <span className="text-black">{icon}</span>
            {badge}
          </p>
          <h3 className="mt-2 text-sm font-bold text-black">{title}</h3>
        </div>
        <Link href={href} className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-700">
          {actionLabel}
        </Link>
      </div>
      <div className="mt-3">
        {children ?? <Empty text={emptyLabel} />}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">{text}</p>;
}
