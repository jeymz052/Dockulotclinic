"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaCalendarDays, FaCheck, FaClockRotateLeft, FaFloppyDisk, FaNotesMedical } from "react-icons/fa6";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import { calculatePatientAge, formatPatientFullName } from "@/src/lib/patient-registration";
import { useRole } from "@/src/components/layout/RoleProvider";

type Data = { patients: PatientRecordItem[]; visits: PatientVisitRecord[]; message?: string };
type Consent = { id: string; procedure_name: string; signed_at: string };
type Tab = "Personal" | "Contact" | "Other" | "Medical Records";
type Notice = { tone: "success" | "error"; text: string };

const TABS: Tab[] = ["Personal", "Contact", "Other", "Medical Records"];
const fieldClass = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200";

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useRole();
  const [patient, setPatient] = useState<PatientRecordItem | null>(null);
  const [draft, setDraft] = useState<PatientRecordItem | null>(null);
  const [visits, setVisits] = useState<PatientVisitRecord[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [tab, setTab] = useState<Tab>("Personal");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (authLoading || !accessToken || !id) return;
    let active = true;
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [recordsResponse, consentResponse] = await Promise.all([
          fetch("/api/patient-records", { cache: "no-store", headers }),
          fetch(`/api/v2/procedure-consents?patient_id=${encodeURIComponent(id)}`, { cache: "no-store", headers }),
        ]);
        const records = (await recordsResponse.json().catch(() => null)) as Data | null;
        if (!recordsResponse.ok || !records) throw new Error(records?.message ?? "Unable to load patient profile.");
        const found = records.patients.find((item) => item.id === id);
        if (!found) throw new Error("Patient record was not found.");
        const consentData = (await consentResponse.json().catch(() => null)) as { consents?: Consent[] } | null;
        if (!active) return;
        setPatient(found);
        setDraft(found);
        setVisits(records.visits.filter((visit) => visit.patientId === id));
        setConsents(consentResponse.ok ? consentData?.consents ?? [] : []);
      } catch (error) {
        if (active) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load patient profile." });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [accessToken, authLoading, id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const history = useMemo(() => [...visits].sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)), [visits]);
  const age = calculatePatientAge(patient?.dateOfBirth ?? "");

  function update<K extends keyof PatientRecordItem>(field: K, value: PatientRecordItem[K]) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function save() {
    if (!accessToken || !draft) return;
    const updated = { ...draft, fullName: formatPatientFullName(draft) };
    startSave(async () => {
      try {
        const response = await fetch("/api/patients", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(updated) });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Unable to save patient profile.");
        setPatient(updated);
        setDraft(updated);
        setNotice({ tone: "success", text: "Patient profile updated successfully." });
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save patient profile." });
      }
    });
  }

  if (loading) return <Loading />;
  if (!patient || !draft) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-800">{notice?.text ?? "Patient record was not found."}</div>;

  const isExisting = patient.patientCategory === "Existing";
  const latestConsent = consents[0] ?? null;
  const completedVisits = visits.filter((visit) => visit.status === "Completed").length;

  return <div className="space-y-5 pb-8">
    <button type="button" onClick={() => router.push("/patients/records")} className="inline-flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-neutral-950"><FaArrowLeft className="h-4 w-4" />Patient records</button>
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-lg font-black text-white">{initials(patient)}</div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Patient chart</p><h1 className="mt-1 truncate text-2xl font-black text-neutral-950">{patient.fullName}</h1><p className="mt-1 text-sm text-neutral-500">{patient.patientNumber} · {patient.gender || "Sex not recorded"}{age != null ? ` · ${age} years old` : ""}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge tone={isExisting ? "neutral" : "blue"}>{isExisting ? "Existing patient" : "New patient"}</Badge><Badge tone={latestConsent ? "success" : "warning"}>{latestConsent ? "Procedure consent signed" : "No procedure consent"}</Badge><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FaFloppyDisk className="h-4 w-4" />{saving ? "Saving..." : "Save changes"}</button></div></div>
      <div className="grid border-t border-neutral-200 sm:grid-cols-3"><Stat label="Completed visits" value={completedVisits} icon={<FaCalendarDays />} /><Stat label="Procedure consent" value={latestConsent ? "Signed" : "None"} icon={<FaCheck />} /><Stat label="Last visit" value={history[0] ? formatDisplayDate(history[0].date) : "None"} icon={<FaClockRotateLeft />} /></div>
      <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-5 py-3"><button type="button" onClick={() => router.push("/appointments")} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"><FaCalendarDays className="h-4 w-4" />Book appointment</button><button type="button" onClick={() => router.push("/consultations")} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"><FaNotesMedical className="h-4 w-4" />Open consultations</button></div>
      <nav className="flex overflow-x-auto border-t border-neutral-200 px-3" aria-label="Patient profile sections">{TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold ${tab === item ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-500 hover:text-neutral-900"}`}>{item}</button>)}</nav>
    </section>
    {tab === "Personal" ? <Personal draft={draft} onChange={update} /> : null}
    {tab === "Contact" ? <Contact draft={draft} onChange={update} /> : null}
    {tab === "Other" ? <Other draft={draft} onChange={update} /> : null}
    {tab === "Medical Records" ? <Timeline visits={history} /> : null}
    {notice ? <Toast notice={notice} onClose={() => setNotice(null)} /> : null}
  </div>;
}

type DraftProps = { draft: PatientRecordItem; onChange: <K extends keyof PatientRecordItem>(field: K, value: PatientRecordItem[K]) => void };
function Personal({ draft, onChange }: DraftProps) { return <Panel title="Personal information" subtitle="Core patient details used in booking and the medical chart."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><ReadOnly label="Patient number" value={draft.patientNumber} /><Field label="First name"><input value={draft.firstName} onChange={(event) => onChange("firstName", event.target.value)} className={fieldClass} /></Field><Field label="Middle name / initial"><input value={draft.middleName} onChange={(event) => onChange("middleName", event.target.value)} className={fieldClass} /></Field><Field label="Family name"><input value={draft.lastName} onChange={(event) => onChange("lastName", event.target.value)} className={fieldClass} /></Field><Field label="Suffix"><input value={draft.suffixName} onChange={(event) => onChange("suffixName", event.target.value)} className={fieldClass} /></Field><Field label="Birth date"><input type="date" value={draft.dateOfBirth} onChange={(event) => onChange("dateOfBirth", event.target.value)} className={fieldClass} /></Field><Field label="Sex"><select value={draft.gender} onChange={(event) => onChange("gender", event.target.value)} className={fieldClass}><option value="">Select sex</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></Field><Field label="Civil status"><select value={draft.civilStatus} onChange={(event) => onChange("civilStatus", event.target.value)} className={fieldClass}><option value="">Select civil status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select></Field><ReadOnly label="Patient type" value={draft.patientCategory === "Existing" ? "Existing patient" : "New patient"} /></div></Panel>; }
function Contact({ draft, onChange }: DraftProps) { return <Panel title="Contact information" subtitle="Details used for reminders and clinic coordination."><div className="grid gap-4 md:grid-cols-2"><Field label="Mobile number"><input value={draft.phone} onChange={(event) => onChange("phone", event.target.value)} className={fieldClass} /></Field><Field label="Email address"><input type="email" value={draft.email} onChange={(event) => onChange("email", event.target.value)} className={fieldClass} /></Field><div className="md:col-span-2"><Field label="Address"><input value={draft.address} onChange={(event) => onChange("address", event.target.value)} className={fieldClass} /></Field></div><Field label="Emergency contact name"><input value={draft.emergencyContactName} onChange={(event) => onChange("emergencyContactName", event.target.value)} className={fieldClass} /></Field><Field label="Emergency contact number"><input value={draft.emergencyContactPhone} onChange={(event) => onChange("emergencyContactPhone", event.target.value)} className={fieldClass} /></Field></div></Panel>; }
function Other({ draft, onChange }: DraftProps) { return <Panel title="Other information" subtitle="Supporting details for a complete clinical profile."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Religion"><input value={draft.religion} onChange={(event) => onChange("religion", event.target.value)} className={fieldClass} /></Field><Field label="Occupation"><input value={draft.occupation} onChange={(event) => onChange("occupation", event.target.value)} className={fieldClass} /></Field><Field label="Guardian (for pediatric patients)"><input value={draft.guardianName} onChange={(event) => onChange("guardianName", event.target.value)} className={fieldClass} /></Field></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Known allergies"><textarea value={draft.allergies} onChange={(event) => onChange("allergies", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field><Field label="Medical history"><textarea value={draft.medicalHistory} onChange={(event) => onChange("medicalHistory", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field><div className="md:col-span-2"><Field label="Family history"><textarea value={draft.familyHistory} onChange={(event) => onChange("familyHistory", event.target.value)} rows={4} className={`${fieldClass} resize-y`} /></Field></div></div></Panel>; }
function Timeline({ visits }: { visits: PatientVisitRecord[] }) { return <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FaClockRotateLeft className="h-4 w-4 text-neutral-500" /><div><h2 className="font-black text-neutral-950">Medical record timeline</h2><p className="mt-1 text-sm text-neutral-500">Appointment-linked SOAP notes, diagnoses, and prescriptions.</p></div></div><div className="mt-6 space-y-5">{visits.length ? visits.map((visit) => <Visit key={visit.appointmentId} visit={visit} />) : <div className="border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">No consultation records yet.</div>}</div></section>; }
function Visit({ visit }: { visit: PatientVisitRecord }) { const doctor = getDoctorById(visit.doctorId); return <article className="grid gap-3 border-b border-neutral-100 pb-5 last:border-b-0 last:pb-0 md:grid-cols-[9rem_minmax(0,1fr)]"><div><p className="font-bold text-neutral-950">{formatDisplayDate(visit.date)}</p><p className="mt-1 text-xs text-neutral-500">{formatRange(visit.start, visit.end)}</p></div><div><div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{visit.type}</Badge><span className="text-xs font-medium text-neutral-500">{doctor?.name ?? "Assigned doctor"}</span></div><p className="mt-3 text-sm font-bold text-neutral-900">{visit.consultation?.diagnosis || visit.reason || "No diagnosis recorded."}</p>{visit.consultation?.note ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-700">{visit.consultation.note}</p> : null}{visit.consultation?.prescription ? <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700"><strong>Prescription: </strong>{visit.consultation.prescription}</p> : null}</div></article>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"><h2 className="font-black text-neutral-950">{title}</h2><p className="mt-1 text-sm text-neutral-500">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-neutral-700"><span>{label}</span><div className="mt-1.5">{children}</div></label>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-neutral-700">{label}</p><p className="mt-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600">{value}</p></div>; }
function Badge({ tone, children }: { tone: "neutral" | "blue" | "success" | "warning"; children: React.ReactNode }) { const colors = { neutral: "border-neutral-200 bg-neutral-100 text-neutral-700", blue: "border-sky-200 bg-sky-50 text-sky-700", success: "border-emerald-200 bg-emerald-50 text-emerald-700", warning: "border-amber-200 bg-amber-50 text-amber-800" }[tone]; return <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${colors}`}>{children}</span>; }
function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) { return <div className="flex items-center gap-3 border-b border-neutral-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">{icon}</span><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</p><p className="mt-1 text-sm font-bold text-neutral-800">{value}</p></div></div>; }
function initials(patient: PatientRecordItem) { return [patient.firstName, patient.lastName].filter(Boolean).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "P"; }
function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) { const success = notice.tone === "success"; return <div role="status" className={`fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border p-4 shadow-xl ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}><FaCheck className="h-3 w-3" /></span><p className="flex-1 text-sm font-semibold leading-5">{notice.text}</p><button type="button" onClick={onClose} aria-label="Dismiss notification" className="text-neutral-500 hover:text-neutral-950">×</button></div>; }
function Loading() { return <div className="space-y-5 animate-pulse"><div className="h-5 w-32 rounded bg-neutral-200" /><div className="h-52 rounded-lg border border-neutral-200 bg-white" /><div className="h-80 rounded-lg border border-neutral-200 bg-white" /></div>; }
