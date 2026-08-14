"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FaCheck, FaChevronLeft, FaChevronRight, FaCloudArrowUp, FaEye, FaMagnifyingGlass, FaPen, FaPlus, FaTrash, FaUserPlus, FaUsers, FaXmark } from "react-icons/fa6";
import { formatDisplayDate } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import { calculatePatientAge, formatPatientFullName } from "@/src/lib/patient-registration";
import { useRole } from "@/src/components/layout/RoleProvider";

type Payload = { patients: PatientRecordItem[]; visits: PatientVisitRecord[] };
type ImportPayload = { result?: { created: number; updated: number; skipped: number; errors: string[] }; message?: string };
type PatientFilter = "All" | "New" | "Regular";
type PatientForm = Omit<PatientRecordItem, "id" | "status">;
type Notice = { text: string; tone: "success" | "error" };

const TABLE_COLUMNS = ["Patient No.", "Patient", "Age / Sex", "Contact", "Type", "Last Visit"] as const;
const DEFAULT_PAGE_SIZE = 10;
const fieldClassName = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200";

function emptyPatientForm(): PatientForm {
  return { patientNumber: "", fullName: "", firstName: "", middleName: "", lastName: "", suffixName: "", email: "", phone: "", dateOfBirth: "", gender: "", civilStatus: "", address: "", religion: "", occupation: "", guardianName: "", doctorNotes: "", emergencyContactName: "", emergencyContactPhone: "", familyHistory: "", allergies: "", medicalHistory: "", isWalkIn: false, patientCategory: "New" };
}

function normalizePatient(patient: PatientRecordItem): PatientRecordItem {
  return patient.patientCategory === "OldRecord" ? { ...patient, patientCategory: "Regular" } : patient;
}

export default function PatientRecordsPage() {
  const { accessToken, isLoading: authLoading } = useRole();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [patients, setPatients] = useState<PatientRecordItem[]>([]);
  const [visits, setVisits] = useState<PatientVisitRecord[]>([]);
  const [search, setSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<PatientFilter>("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isImporting, startImport] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [form, setForm] = useState<PatientForm | null>(null);
  const [editingPatient, setEditingPatient] = useState<PatientRecordItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientRecordItem | null>(null);

  async function loadRecords(token: string) {
    setIsLoading(true);
    const response = await fetch("/api/patient-records", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json().catch(() => null)) as (Payload & { message?: string }) | null;
    if (!response.ok || !payload) throw new Error(payload?.message ?? "Failed to load patient records.");
    setPatients(payload.patients.map(normalizePatient).filter((patient) => patient.status === "Active"));
    setVisits(payload.visits);
    setIsLoading(false);
  }

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void loadRecords(accessToken).catch((error) => {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load patient records." });
      setIsLoading(false);
    });
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const counts = useMemo(() => ({
    total: patients.length,
    new: patients.filter((patient) => patient.patientCategory === "New").length,
    existing: patients.filter((patient) => patient.patientCategory === "Regular").length,
  }), [patients]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesType = patientFilter === "All" || patient.patientCategory === patientFilter;
      const matchesSearch = !query || [patient.patientNumber, patient.fullName, patient.firstName, patient.lastName, patient.phone, patient.address, patient.religion, patient.occupation].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [patientFilter, patients, search]);

  useEffect(() => setPage(1), [pageSize, patientFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const paginatedPatients = filteredPatients.slice((activePage - 1) * pageSize, activePage * pageSize);
  const lastVisitByPatient = useMemo(() => visits.reduce((map, visit) => {
    const current = map.get(visit.patientId);
    if (!current || `${visit.date}${visit.start}` > `${current.date}${current.start}`) map.set(visit.patientId, visit);
    return map;
  }, new Map<string, PatientVisitRecord>()), [visits]);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(activePage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [activePage, totalPages]);

  function beginCreate() { setForm(emptyPatientForm()); setEditingPatient(null); }
  function beginEdit(patient: PatientRecordItem) { const { id, status, ...draft } = patient; void id; void status; setForm(draft); setEditingPatient(patient); }
  function updateForm<K extends keyof PatientForm>(field: K, value: PatientForm[K]) { setForm((current) => current ? { ...current, [field]: value } : current); }

  function savePatient() {
    if (!accessToken || !form) return;
    const normalized = {
      ...form,
      patientNumber: editingPatient?.patientNumber ?? "",
      patientCategory: editingPatient?.patientCategory ?? "New",
      fullName: formatPatientFullName(form),
    };
    startMutation(async () => {
      try {
        const response = await fetch("/api/patients", { method: editingPatient ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(editingPatient ? { ...normalized, id: editingPatient.id, status: editingPatient.status } : normalized) });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Unable to save patient.");
        const isEditing = Boolean(editingPatient);
        setForm(null); setEditingPatient(null);
        setNotice({ tone: "success", text: isEditing ? "Patient record updated successfully." : "New patient added successfully." });
        await loadRecords(accessToken);
      } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save patient." }); }
    });
  }

  function removePatient() {
    if (!accessToken || !deleteTarget) return;
    const target = deleteTarget;
    startMutation(async () => {
      try {
        const response = await fetch(`/api/patients?id=${encodeURIComponent(target.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Unable to delete patient.");
        setDeleteTarget(null); setNotice({ tone: "success", text: "Patient removed from the active records list." });
        await loadRecords(accessToken);
      } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to delete patient." }); }
    });
  }

  function importPatientFile(file: File | null) {
    if (!file || !accessToken) return;
    startImport(async () => {
      try {
        const formData = new FormData(); formData.append("file", file);
        const response = await fetch("/api/patient-record-import", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
        const payload = (await response.json().catch(() => null)) as ImportPayload | null;
        if (!response.ok || !payload?.result) throw new Error(payload?.message ?? "Unable to import patients.");
        const { created, updated, skipped, errors } = payload.result;
        setNotice({ tone: "success", text: `Import complete: ${created} added, ${updated} updated, ${skipped} skipped.${errors.length ? ` ${errors.length} row issue(s).` : ""}` });
        await loadRecords(accessToken);
      } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to import patients." }); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    });
  }

  const firstRecord = filteredPatients.length ? (activePage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(activePage * pageSize, filteredPatients.length);

  return (
    <div className="space-y-6 pb-8">
      <section className="border-b border-neutral-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Doc Kulot Clinic</p>
        <h1 className="mt-2 text-3xl font-black text-neutral-950">Patient Records</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">New and existing patients, organized around Doc Kulot&apos;s official patient record fields.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="All patients" value={counts.total} icon={<FaUsers />} tone="slate" />
        <MetricCard label="New patients" value={counts.new} icon={<FaUserPlus />} tone="blue" />
        <MetricCard label="Existing patients" value={counts.existing} icon={<FaUsers />} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-black text-neutral-950">Patient directory</h2>
            <p className="mt-1 text-sm text-neutral-500">Showing {firstRecord}-{lastRecord} of {filteredPatients.length} patients</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
            <label className="relative min-w-[15rem] flex-1 xl:w-72"><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><span className="sr-only">Search patients</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, number, contact..." className="w-full rounded-md border border-neutral-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200" /></label>
            <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value as PatientFilter)} aria-label="Filter patients" className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-200"><option value="All">All patients</option><option value="New">New patients</option><option value="Regular">Existing patients</option></select>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => importPatientFile(event.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"><FaCloudArrowUp className="h-4 w-4" />{isImporting ? "Importing..." : "Import"}</button>
            <button type="button" onClick={beginCreate} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"><FaPlus className="h-4 w-4" />New Patient</button>
          </div>
        </div>
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-[0.06em] text-neutral-500"><tr>{TABLE_COLUMNS.map((column, index) => <th key={column} className={`px-4 py-3 font-bold ${index === 0 ? "sticky left-0 z-20 bg-neutral-50" : ""}`}>{column}</th>)}<th className="sticky right-0 bg-neutral-50 px-4 py-3 font-bold">Actions</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedPatients.map((patient) => { const lastVisit = lastVisitByPatient.get(patient.id); return <tr key={patient.id} onClick={() => router.push(`/patients/records/${patient.id}`)} className="group cursor-pointer bg-white text-neutral-700 transition hover:bg-neutral-50"><TableCell className="sticky left-0 z-10 bg-white font-mono text-xs font-bold text-neutral-950 group-hover:bg-neutral-50">{patient.patientNumber || "-"}</TableCell><TableCell><p className="font-bold text-neutral-950">{patient.fullName}</p><p className="mt-1 text-xs text-neutral-500">{patient.email || "No email"}</p></TableCell><TableCell><p className="font-semibold text-neutral-800">{calculatePatientAge(patient.dateOfBirth) ?? "-"} yrs</p><p className="mt-1 text-xs text-neutral-500">{patient.gender || "Not recorded"}</p></TableCell><TableCell><p className="font-medium text-neutral-800">{patient.phone || "No contact"}</p><p className="mt-1 text-xs text-neutral-500">{patient.civilStatus || "Civil status not set"}</p></TableCell><TableCell><PatientBadge category={patient.patientCategory} /></TableCell><TableCell>{lastVisit ? <><p className="font-medium text-neutral-800">{formatDisplayDate(lastVisit.date)}</p><p className="mt-1 max-w-48 truncate text-xs text-neutral-500">{lastVisit.consultation?.diagnosis || lastVisit.reason || lastVisit.status}</p></> : <span className="text-neutral-400">No visit yet</span>}</TableCell><td className="sticky right-0 bg-white px-4 py-3 group-hover:bg-neutral-50"><div className="flex items-center gap-1"><ActionButton label="View patient" onClick={() => router.push(`/patients/records/${patient.id}`)}><FaEye /></ActionButton><ActionButton label="Edit patient" onClick={() => beginEdit(patient)}><FaPen /></ActionButton><ActionButton label="Delete patient" danger onClick={() => setDeleteTarget(patient)}><FaTrash /></ActionButton></div></td></tr>; })}
              {!paginatedPatients.length && !isLoading ? <tr><td colSpan={TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-sm text-neutral-500">No patient records matched this search or filter.</td></tr> : null}
              {isLoading ? <tr><td colSpan={TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-sm text-neutral-500">Loading patient records...</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination activePage={activePage} totalPages={totalPages} pageNumbers={pageNumbers} pageSize={pageSize} onChange={setPage} onPageSizeChange={setPageSize} />
      </section>

      {notice ? <Toast notice={notice} onClose={() => setNotice(null)} /> : null}
      {form ? <PatientModal form={form} editing={Boolean(editingPatient)} isSaving={isMutating} onChange={updateForm} onClose={() => { setForm(null); setEditingPatient(null); }} onSave={savePatient} /> : null}
      {deleteTarget ? <DeleteModal patient={deleteTarget} isDeleting={isMutating} onClose={() => setDeleteTarget(null)} onConfirm={removePatient} /> : null}
    </div>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "slate" | "blue" | "amber" }) {
  const colors = { slate: "border-neutral-200 bg-white text-neutral-700", blue: "border-sky-200 bg-sky-50 text-sky-700", amber: "border-amber-200 bg-amber-50 text-amber-800" }[tone];
  return <article className={`rounded-lg border p-4 shadow-sm ${colors}`}><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/80 shadow-sm">{icon}</span><span className="text-3xl font-black text-neutral-950">{value}</span></div><p className="mt-4 text-sm font-bold">{label}</p><p className="mt-1 text-xs opacity-70">Current directory total</p></article>;
}
function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 align-top leading-5 ${className}`}>{children}</td>; }
function PatientBadge({ category }: { category: PatientRecordItem["patientCategory"] }) { return <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${category === "New" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-neutral-200 bg-neutral-100 text-neutral-700"}`}>{category === "New" ? "New" : "Existing"}</span>; }
function ActionButton({ label, children, danger = false, onClick }: { label: string; children: React.ReactNode; danger?: boolean; onClick: () => void }) { return <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} aria-label={label} title={label} className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs transition ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"}`}>{children}</button>; }
function Pagination({ activePage, totalPages, pageNumbers, pageSize, onChange, onPageSizeChange }: { activePage: number; totalPages: number; pageNumbers: number[]; pageSize: number; onChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) { return <div className="flex flex-col gap-3 border-t border-neutral-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2 text-sm text-neutral-500"><span>Rows</span><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-200"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><span>per page · Page {activePage} of {totalPages}</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => onChange(Math.max(1, activePage - 1))} disabled={activePage === 1} aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"><FaChevronLeft className="h-3 w-3" /></button>{pageNumbers[0] > 1 ? <><button type="button" onClick={() => onChange(1)} className="h-8 min-w-8 rounded-md px-2 text-sm font-bold text-neutral-600">1</button><span className="px-1 text-neutral-400">...</span></> : null}{pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" onClick={() => onChange(pageNumber)} className={`h-8 min-w-8 rounded-md px-2 text-sm font-bold ${activePage === pageNumber ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>{pageNumber}</button>)}{pageNumbers[pageNumbers.length - 1] < totalPages ? <><span className="px-1 text-neutral-400">...</span><button type="button" onClick={() => onChange(totalPages)} className="h-8 min-w-8 rounded-md px-2 text-sm font-bold text-neutral-600">{totalPages}</button></> : null}<button type="button" onClick={() => onChange(Math.min(totalPages, activePage + 1))} disabled={activePage === totalPages} aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"><FaChevronRight className="h-3 w-3" /></button></div></div>; }
function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) { const success = notice.tone === "success"; return <div role="status" className={`fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border p-4 shadow-xl ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}><FaCheck className="h-3 w-3" /></span><p className="flex-1 text-sm font-semibold leading-5">{notice.text}</p><button type="button" onClick={onClose} aria-label="Dismiss notification" className="text-neutral-500 hover:text-neutral-950"><FaXmark /></button></div>; }

function PatientModal({ form, editing, isSaving, onChange, onClose, onSave }: { form: PatientForm; editing: boolean; isSaving: boolean; onChange: <K extends keyof PatientForm>(field: K, value: PatientForm[K]) => void; onClose: () => void; onSave: () => void }) {
  return <Modal title={editing ? "Edit patient" : "Add new patient"} onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">Cancel</button><button type="button" onClick={onSave} disabled={isSaving} className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{isSaving ? "Saving..." : editing ? "Save changes" : "Add patient"}</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Patient number"><input value={form.patientNumber} onChange={(event) => onChange("patientNumber", event.target.value)} className={fieldClassName} /></Field><Field label="Patient type"><select value={form.patientCategory} onChange={(event) => onChange("patientCategory", event.target.value as PatientForm["patientCategory"])} className={fieldClassName}><option value="New">New patient</option><option value="Regular">Existing patient</option></select></Field><Field label="Family name"><input value={form.lastName} onChange={(event) => onChange("lastName", event.target.value)} className={fieldClassName} /></Field><Field label="First name"><input value={form.firstName} onChange={(event) => onChange("firstName", event.target.value)} className={fieldClassName} /></Field><Field label="Middle name / initial"><input value={form.middleName} onChange={(event) => onChange("middleName", event.target.value)} className={fieldClassName} /></Field><Field label="Suffix name"><input value={form.suffixName} onChange={(event) => onChange("suffixName", event.target.value)} className={fieldClassName} /></Field><Field label="Birth date"><input type="date" value={form.dateOfBirth} onChange={(event) => onChange("dateOfBirth", event.target.value)} className={fieldClassName} /></Field><Field label="Sex"><select value={form.gender} onChange={(event) => onChange("gender", event.target.value)} className={fieldClassName}><option value="">Select sex</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></Field><Field label="Civil status"><select value={form.civilStatus} onChange={(event) => onChange("civilStatus", event.target.value)} className={fieldClassName}><option value="">Select civil status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select></Field><Field label="Contact number"><input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} placeholder="09XXXXXXXXX" className={fieldClassName} /></Field><Field label="Email address"><input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} className={fieldClassName} /></Field><Field label="Religion"><input value={form.religion} onChange={(event) => onChange("religion", event.target.value)} className={fieldClassName} /></Field><div className="sm:col-span-2"><Field label="Address"><input value={form.address} onChange={(event) => onChange("address", event.target.value)} className={fieldClassName} /></Field></div><Field label="Occupation"><input value={form.occupation} onChange={(event) => onChange("occupation", event.target.value)} className={fieldClassName} /></Field><Field label="Name of guardian (for peds)"><input value={form.guardianName} onChange={(event) => onChange("guardianName", event.target.value)} className={fieldClassName} /></Field><div className="sm:col-span-2"><Field label="Doctor's notes"><textarea value={form.doctorNotes} onChange={(event) => onChange("doctorNotes", event.target.value)} rows={5} placeholder={"Date\nChief complaint\n\nS:\n\nO:\n\nA:\n\nP:"} className={`${fieldClassName} resize-y font-mono leading-6`} /></Field></div><Field label="Emergency contact name"><input value={form.emergencyContactName} onChange={(event) => onChange("emergencyContactName", event.target.value)} className={fieldClassName} /></Field><Field label="Emergency contact phone"><input value={form.emergencyContactPhone} onChange={(event) => onChange("emergencyContactPhone", event.target.value)} className={fieldClassName} /></Field><div className="sm:col-span-2"><Field label="Medical history"><textarea value={form.medicalHistory} onChange={(event) => onChange("medicalHistory", event.target.value)} rows={3} className={`${fieldClassName} resize-y`} /></Field></div><Field label="Allergies"><textarea value={form.allergies} onChange={(event) => onChange("allergies", event.target.value)} rows={3} className={`${fieldClassName} resize-y`} /></Field><Field label="Family history"><textarea value={form.familyHistory} onChange={(event) => onChange("familyHistory", event.target.value)} rows={3} className={`${fieldClassName} resize-y`} /></Field></div></Modal>;
}
export function ViewModal({ patient, onClose, onEdit }: { patient: PatientRecordItem; onClose: () => void; onEdit: () => void }) { return <Modal title="Patient record" onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">Close</button><button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white"><FaPen className="h-3.5 w-3.5" />Edit patient</button></>}><div className="grid gap-4 sm:grid-cols-2"><Info label="Patient number" value={patient.patientNumber} /><Info label="Patient type" value={patient.patientCategory === "New" ? "New" : "Existing"} /><Info label="Family name" value={patient.lastName} /><Info label="First name" value={patient.firstName} /><Info label="Middle name / initial" value={patient.middleName} /><Info label="Birth date" value={patient.dateOfBirth} /><Info label="Sex" value={patient.gender} /><Info label="Civil status" value={patient.civilStatus} /><Info label="Contact number" value={patient.phone} /><Info label="Email address" value={patient.email} /><Info label="Address" value={patient.address} wide /><Info label="Religion" value={patient.religion} /><Info label="Occupation" value={patient.occupation} /><Info label="Name of guardian (for peds)" value={patient.guardianName} /><Info label="Doctor's notes" value={patient.doctorNotes} wide /><Info label="Medical history" value={patient.medicalHistory} wide /><Info label="Allergies" value={patient.allergies} /><Info label="Family history" value={patient.familyHistory} /></div></Modal>; }
function DeleteModal({ patient, isDeleting, onClose, onConfirm }: { patient: PatientRecordItem; isDeleting: boolean; onClose: () => void; onConfirm: () => void }) { return <Modal title="Delete patient" onClose={onClose} footer={<><button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">Cancel</button><button type="button" onClick={onConfirm} disabled={isDeleting} className="rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{isDeleting ? "Deleting..." : "Delete patient"}</button></>}><p className="text-sm leading-6 text-neutral-700">Delete <strong>{patient.fullName}</strong> from the active patient list? Their record is deactivated and retained for the clinic audit trail.</p></Modal>; }
function Modal({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}><div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><h2 className="text-lg font-black text-neutral-950">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"><FaXmark /></button></div><div className="overflow-y-auto p-5">{children}</div><div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4">{footer}</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-neutral-700"><span>{label}</span><div className="mt-1.5">{children}</div></label>; }
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "sm:col-span-2" : ""}><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-400">{label}</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-800">{value || "Not recorded"}</p></div>; }
