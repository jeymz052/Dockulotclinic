"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaCloudArrowUp,
  FaMagnifyingGlass,
  FaUserPlus,
  FaUsers,
  FaXmark,
  FaCalendarPlus,
} from "react-icons/fa6";
import { formatDisplayDate } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  calculatePatientAge,
  formatPatientFullName,
  validatePatientRegistrationFields,
} from "@/src/lib/patient-registration";
import { useRole } from "@/src/components/layout/RoleProvider";
import { ConvertToAppointmentModal } from "@/src/components/patients/ConvertToAppointmentModal";

type Payload = { patients: PatientRecordItem[]; visits: PatientVisitRecord[] };
type ImportPayload = {
  result?: { created: number; skipped: number; errors: string[] };
  message?: string;
};
type ImportPreviewRecord = {
  patientNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffixName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  patientCategory: "New" | "Existing";
};
type ImportPreviewSummary = {
  total: number;
  newCount: number;
  existingCount: number;
};
type ImportPreviewPayload = {
  preview?: ImportPreviewRecord[];
  summary?: ImportPreviewSummary;
  message?: string;
};
type PatientFilter = "All" | "New" | "Existing";
type Notice = { text: string; tone: "success" | "error" };
type AddPatientFormState = Omit<PatientRecordItem, "id" | "status">;

const INITIAL_ADD_PATIENT_FORM: AddPatientFormState = {
  patientNumber: "",
  fullName: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffixName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  civilStatus: "",
  address: "",
  religion: "",
  occupation: "",
  guardianName: "",
  doctorNotes: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  familyHistory: "",
  allergies: "",
  medicalHistory: "",
  isWalkIn: false,
  patientCategory: "New",
};

const TABLE_COLUMNS = ["Patient No.", "Patient", "Age / Sex", "Contact", "Type", "Last Visit", ""] as const;
const DEFAULT_PAGE_SIZE = 10;

export default function PatientRecordsPage() {
  const { accessToken, role, isLoading: authLoading } = useRole();
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
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [convertingPatient, setConvertingPatient] = useState<PatientRecordItem | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: ImportPreviewRecord[];
    summary: ImportPreviewSummary;
  } | null>(null);

  const isStaff = role === "SUPER_ADMIN" || role === "SECRETARY" || role === "DOCTOR";

  async function loadRecords(token: string) {
    setIsLoading(true);
    const response = await fetch("/api/patient-records", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => null)) as (Payload & { message?: string }) | null;
    if (!response.ok || !payload) throw new Error(payload?.message ?? "Failed to load patient records.");
    setPatients(payload.patients.map(normalizePatient).filter((patient) => patient.status === "Active"));
    setVisits(payload.visits);
    setIsLoading(false);
  }

  useEffect(() => {
    if (authLoading || !accessToken) return;
    void loadRecords(accessToken).catch((error) => {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to load patient records.",
      });
      setIsLoading(false);
    });
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const counts = useMemo(
    () => ({
      total: patients.length,
      new: patients.filter((patient) => patient.patientCategory === "New").length,
      existing: patients.filter((patient) => patient.patientCategory === "Existing").length,
    }),
    [patients],
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesType = patientFilter === "All" || patient.patientCategory === patientFilter;
      const matchesSearch =
        !query ||
        [
          patient.patientNumber,
          patient.fullName,
          patient.firstName,
          patient.lastName,
          patient.phone,
          patient.address,
          patient.religion,
          patient.occupation,
        ].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [patientFilter, patients, search]);

  useEffect(() => setPage(1), [pageSize, patientFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const paginatedPatients = filteredPatients.slice((activePage - 1) * pageSize, activePage * pageSize);
  const lastVisitByPatient = useMemo(
    () =>
      visits.reduce((map, visit) => {
        const current = map.get(visit.patientId);
        if (!current || `${visit.date}${visit.start}` > `${current.date}${current.start}`) {
          map.set(visit.patientId, visit);
        }
        return map;
      }, new Map<string, PatientVisitRecord>()),
    [visits],
  );
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(activePage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [activePage, totalPages]);

  function clearImportPreview() {
    setPendingImportFile(null);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function previewImportPatientFile(file: File | null) {
    if (!file || !accessToken) return;
    setIsPreviewingImport(true);
    void (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/patient-record-import?preview=1", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const payload = (await response.json().catch(() => null)) as ImportPreviewPayload | null;
        if (!response.ok || !payload?.preview || !payload.summary) {
          throw new Error(payload?.message ?? "Unable to preview patients.");
        }
        setPendingImportFile(file);
        setImportPreview({ rows: payload.preview, summary: payload.summary });
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to preview patients." });
        clearImportPreview();
      } finally {
        setIsPreviewingImport(false);
      }
    })();
  }

  function importPatientFile() {
    if (!pendingImportFile || !accessToken) return;
    setIsImporting(true);
    void (async () => {
      try {
        const formData = new FormData();
        formData.append("file", pendingImportFile);
        const response = await fetch("/api/patient-record-import", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const payload = (await response.json().catch(() => null)) as ImportPayload | null;
        if (!response.ok || !payload?.result) throw new Error(payload?.message ?? "Unable to import patients.");
        const { created, skipped, errors } = payload.result;
        setNotice({
          tone: "success",
          text: `Import complete: ${created} added, ${skipped} skipped.${errors.length ? ` ${errors.length} row issue(s).` : ""}`,
        });
        clearImportPreview();
        void loadRecords(accessToken).catch((error) => {
          console.error("[patients] failed to refresh records after import", error);
        });
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to import patients." });
      } finally {
        setIsImporting(false);
      }
    })();
  }

  function openPatient(patientId: string) {
    router.push(`/patients/records/${patientId}`);
  }

  const firstRecord = filteredPatients.length ? (activePage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(activePage * pageSize, filteredPatients.length);

  return (
    <div className="space-y-6 pb-8">
      <section className="border-b border-neutral-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Doc Kulot Clinic</p>
        <h1 className="mt-2 text-3xl font-black text-neutral-950">Patient Records</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          New and existing patients, organized around Doc Kulot&apos;s official patient record fields.
        </p>
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
            <p className="mt-1 text-sm text-neutral-500">
              Showing {firstRecord}-{lastRecord} of {filteredPatients.length} patients
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
            <label className="relative min-w-[15rem] flex-1 xl:w-72">
              <FaMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <span className="sr-only">Search patients</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, number, contact..."
                className="w-full rounded-md border border-neutral-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-neutral-800 focus:ring-2 focus:ring-neutral-200"
              />
            </label>
            <select
              value={patientFilter}
              onChange={(event) => setPatientFilter(event.target.value as PatientFilter)}
              aria-label="Filter patients"
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-200"
            >
              <option value="All">All patients</option>
              <option value="New">New patients</option>
              <option value="Existing">Existing patients</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => previewImportPatientFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || isPreviewingImport}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaCloudArrowUp className="h-4 w-4" />
              {isImporting ? "Importing..." : isPreviewingImport ? "Previewing..." : "Import"}
            </button>
            <button
              type="button"
              onClick={() => setIsAddPatientOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              <FaUserPlus className="h-4 w-4" />
              Add patient
            </button>
          </div>
        </div>
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-[0.06em] text-neutral-500">
              <tr>
                {TABLE_COLUMNS.map((column, index) => (
                  <th
                    key={column}
                    className={`px-4 py-3 font-bold ${index === 0 ? "sticky left-0 z-20 bg-neutral-50" : ""}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedPatients.map((patient) => {
                const lastVisit = lastVisitByPatient.get(patient.id);
                return (
                  <tr
                    key={patient.id}
                    className="group bg-white text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <TableCell className="sticky left-0 z-10 cursor-pointer bg-white font-mono text-xs font-bold text-neutral-950 group-hover:bg-neutral-50" onClick={() => openPatient(patient.id)}>
                      {patient.patientNumber || "-"}
                    </TableCell>
                    <TableCell onClick={() => openPatient(patient.id)} className="cursor-pointer">
                      <p className="font-bold text-neutral-950">{patient.fullName}</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.email || "No email"}</p>
                    </TableCell>
                    <TableCell onClick={() => openPatient(patient.id)} className="cursor-pointer">
                      <p className="font-semibold text-neutral-800">{calculatePatientAge(patient.dateOfBirth) ?? "-"} yrs</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.gender || "Not recorded"}</p>
                    </TableCell>
                    <TableCell onClick={() => openPatient(patient.id)} className="cursor-pointer">
                      <p className="font-medium text-neutral-800">{patient.phone || "No contact"}</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.civilStatus || "Civil status not set"}</p>
                    </TableCell>
                    <TableCell onClick={() => openPatient(patient.id)} className="cursor-pointer">
                      <PatientBadge category={patient.patientCategory} />
                    </TableCell>
                    <TableCell onClick={() => openPatient(patient.id)} className="cursor-pointer">
                      {lastVisit ? (
                        <>
                          <p className="font-medium text-neutral-800">{formatDisplayDate(lastVisit.date)}</p>
                          <p className="mt-1 max-w-48 truncate text-xs text-neutral-500">
                            {lastVisit.consultation?.diagnosis || lastVisit.reason || lastVisit.status}
                          </p>
                        </>
                      ) : (
                        <span className="text-neutral-400">No visit yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isStaff ? (
                        <button
                          type="button"
                          id={`convert-appointment-${patient.id}`}
                          title="Convert to Appointment"
                          onClick={(e) => { e.stopPropagation(); setConvertingPatient(patient); }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700 transition hover:border-teal-400 hover:bg-teal-100"
                        >
                          <FaCalendarPlus className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </TableCell>
                  </tr>
                );
              })}
              {!paginatedPatients.length && !isLoading ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="px-5 py-16 text-center text-sm text-neutral-500">
                    No patient records matched this search or filter.
                  </td>
                </tr>
              ) : null}
              {isLoading ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="px-5 py-16 text-center text-sm text-neutral-500">
                    Loading patient records...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination
          activePage={activePage}
          totalPages={totalPages}
          pageNumbers={pageNumbers}
          pageSize={pageSize}
          onChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>

      {importPreview && pendingImportFile ? (
        <ImportPreviewModal
          fileName={pendingImportFile.name}
          preview={importPreview.rows}
          summary={importPreview.summary}
          onCancel={clearImportPreview}
          onConfirm={() => void importPatientFile()}
          isImporting={isImporting}
        />
      ) : null}

      {isAddPatientOpen ? (
        <AddPatientModal
          accessToken={accessToken}
          onClose={() => setIsAddPatientOpen(false)}
          onSuccess={(message) => {
            setIsAddPatientOpen(false);
            setNotice({ tone: "success", text: message });
            if (accessToken) {
              void loadRecords(accessToken).catch((error) => {
                console.error("[patients] failed to refresh records after add patient", error);
              });
            }
          }}
        />
      ) : null}

      {convertingPatient ? (
        <ConvertToAppointmentModal
          patient={convertingPatient}
          accessToken={accessToken}
          onClose={() => setConvertingPatient(null)}
          onSuccess={(message) => {
            setConvertingPatient(null);
            setNotice({ tone: "success", text: message });
          }}
        />
      ) : null}

      {notice ? <Toast notice={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  );
}

function normalizePatient(patient: PatientRecordItem): PatientRecordItem {
  return patient.patientCategory === "New" ? patient : { ...patient, patientCategory: "Existing" };
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "slate" | "blue" | "amber";
}) {
  const colors = {
    slate: "border-neutral-200 bg-white text-neutral-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${colors}`}>
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/80 shadow-sm">{icon}</span>
        <span className="text-3xl font-black text-neutral-950">{value}</span>
      </div>
      <p className="mt-4 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs opacity-70">Current directory total</p>
    </article>
  );
}

function TableCell({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <td className={`px-3 py-3 align-top leading-5 ${className}`} onClick={onClick}>{children}</td>;
}

function PatientBadge({ category }: { category: PatientRecordItem["patientCategory"] }) {
  return (
    <span
      className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${
        category === "New"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-neutral-200 bg-neutral-100 text-neutral-700"
      }`}
    >
      {category === "New" ? "New" : "Existing"}
    </span>
  );
}

function formatPreviewPatientName(record: ImportPreviewRecord) {
  return [record.firstName, record.middleName, record.lastName, record.suffixName].filter(Boolean).join(" ") || "-";
}

function ImportPreviewModal({
  fileName,
  preview,
  summary,
  onCancel,
  onConfirm,
  isImporting,
}: {
  fileName: string;
  preview: ImportPreviewRecord[];
  summary: ImportPreviewSummary;
  onCancel: () => void;
  onConfirm: () => void;
  isImporting: boolean;
}) {
  const visibleRows = preview.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Import preview</p>
            <h3 className="mt-1 text-2xl font-black text-neutral-950">{fileName}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Review the detected patient type before importing. If no category is found in the sheet, the import
              defaults to Existing.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close import preview"
          >
            <FaXmark />
          </button>
        </div>

        <div className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-6 py-4 sm:grid-cols-3">
          <SummaryCard label="Rows found" value={summary.total} tone="slate" />
          <SummaryCard label="New" value={summary.newCount} tone="blue" />
          <SummaryCard label="Existing" value={summary.existingCount} tone="amber" />
        </div>

        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-white text-xs uppercase tracking-[0.06em] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-bold">Patient No.</th>
                <th className="px-4 py-3 font-bold">Patient</th>
                <th className="px-4 py-3 font-bold">Contact</th>
                <th className="px-4 py-3 font-bold">DOB / Sex</th>
                <th className="px-4 py-3 font-bold">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibleRows.map((record, index) => (
                <tr key={`${record.patientNumber || record.email || index}-${index}`} className="bg-white text-neutral-700">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-neutral-950">
                    {record.patientNumber || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-950">{formatPreviewPatientName(record)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-800">{record.phone || "No contact"}</p>
                    <p className="mt-1 text-xs text-neutral-500">{record.email || "No email"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-800">{record.dateOfBirth || "No DOB"}</p>
                    <p className="mt-1 text-xs text-neutral-500">{record.gender || "Sex not set"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <PatientBadge category={record.patientCategory} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            Showing {visibleRows.length} of {summary.total} rows
            {summary.total > visibleRows.length ? " in the preview." : "."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isImporting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaCheck className="h-4 w-4" />
              {isImporting ? "Importing..." : "Confirm import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPatientModal({
  accessToken,
  onClose,
  onSuccess,
}: {
  accessToken: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [form, setForm] = useState<AddPatientFormState>(INITIAL_ADD_PATIENT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const maxBirthDate = new Date().toISOString().slice(0, 10);

  function updateField<K extends keyof AddPatientFormState>(field: K, value: AddPatientFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormNotice(null);
  }

  function resetForm() {
    setForm(INITIAL_ADD_PATIENT_FORM);
    setFormNotice(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const fullName = formatPatientFullName(form);
    const validationError = validatePatientRegistrationFields({
      fullName,
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      suffixName: form.suffixName,
      email: form.email,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      civilStatus: form.civilStatus,
      address: form.address,
      religion: form.religion,
      occupation: form.occupation,
      guardianName: form.guardianName,
    }, { requireEmail: false });
    if (validationError) {
      setFormNotice(validationError);
      return;
    }

    setIsSaving(true);
    try {
      if (!accessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...form,
          fullName,
          isWalkIn: false,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to save patient.");
      }
      resetForm();
      onSuccess(`${fullName} was added successfully.`);
    } catch (error) {
      setFormNotice(error instanceof Error ? error.message : "Unable to save patient.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-neutral-950/65 p-3 backdrop-blur-sm sm:p-4">
      <div className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Add patient</p>
            <h3 className="mt-1 text-2xl font-black text-neutral-950">Patient details only</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Enter the patient&apos;s profile information to add them to the clinic records. Email is optional for old records and can be added later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close add patient popup"
          >
            <FaXmark />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-auto px-5 py-5">
          {formNotice ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {formNotice}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Patient Number">
              <input
                type="text"
                value={form.patientNumber}
                onChange={(event) => updateField("patientNumber", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="Optional clinic code"
              />
            </Field>
            <Field label="Patient Category">
              <select
                value={form.patientCategory}
                onChange={(event) => updateField("patientCategory", event.target.value as AddPatientFormState["patientCategory"])}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              >
                <option value="New">New</option>
                <option value="Existing">Existing</option>
              </select>
            </Field>
            <Field label="First Name">
              <input
                type="text"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="Juan"
                required
              />
            </Field>
            <Field label="Family Name">
              <input
                type="text"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="Dela Cruz"
                required
              />
            </Field>
            <Field label="Middle Name">
              <input
                type="text"
                value={form.middleName}
                onChange={(event) => updateField("middleName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="Middle name"
              />
            </Field>
            <Field label="Suffix Name">
              <input
                type="text"
                value={form.suffixName}
                onChange={(event) => updateField("suffixName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="Jr., III, optional"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="juan@example.com"
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                placeholder="+63 912 345 6789"
                required
              />
            </Field>
            <Field label="Date of Birth">
              <input
                type="date"
                max={maxBirthDate}
                value={form.dateOfBirth}
                onChange={(event) => updateField("dateOfBirth", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                required
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                required
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Civil Status">
              <select
                value={form.civilStatus}
                onChange={(event) => updateField("civilStatus", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              >
                <option value="">Select civil status</option>
                {CIVIL_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              placeholder="Street, barangay, city"
              required
            />
          </Field>

          <details className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-bold text-neutral-700">
              Additional details
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Religion">
                <input
                  type="text"
                  value={form.religion}
                  onChange={(event) => updateField("religion", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Religion"
                />
              </Field>
              <Field label="Occupation">
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(event) => updateField("occupation", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Occupation"
                />
              </Field>
              <Field label="Name of Guardian (for peds)">
                <input
                  type="text"
                  value={form.guardianName}
                  onChange={(event) => updateField("guardianName", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Parent or guardian name"
                />
              </Field>
              <Field label="Emergency Contact Name">
                <input
                  type="text"
                  value={form.emergencyContactName}
                  onChange={(event) => updateField("emergencyContactName", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Parent, spouse, sibling, guardian"
                />
              </Field>
              <Field label="Emergency Contact Phone">
                <input
                  type="text"
                  value={form.emergencyContactPhone}
                  onChange={(event) => updateField("emergencyContactPhone", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="+63 9XX XXX XXXX"
                />
              </Field>
              <Field label="Doctor's Notes">
                <textarea
                  value={form.doctorNotes}
                  onChange={(event) => updateField("doctorNotes", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Date, chief complaint, S/O/A/P notes"
                />
              </Field>
              <Field label="Medical History">
                <textarea
                  value={form.medicalHistory}
                  onChange={(event) => updateField("medicalHistory", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Past illnesses, operations, maintenance medicines, pregnancy history, or other relevant medical history"
                />
              </Field>
              <Field label="Allergies">
                <textarea
                  value={form.allergies}
                  onChange={(event) => updateField("allergies", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Drug allergies, food allergies, latex, or no known allergies"
                />
              </Field>
              <Field label="Family History">
                <textarea
                  value={form.familyHistory}
                  onChange={(event) => updateField("familyHistory", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                  placeholder="Optional family history"
                />
              </Field>
            </div>
          </details>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaCheck className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "amber";
}) {
  const colors = {
    slate: "border-neutral-200 bg-white text-neutral-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${colors}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-2xl font-black text-neutral-950">{value}</span>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-neutral-700">
      {label}
      {children}
    </label>
  );
}

function Pagination({
  activePage,
  totalPages,
  pageNumbers,
  pageSize,
  onChange,
  onPageSizeChange,
}: {
  activePage: number;
  totalPages: number;
  pageNumbers: number[];
  pageSize: number;
  onChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-neutral-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold text-neutral-700 outline-none focus:ring-2 focus:ring-neutral-200"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <span>per page · Page {activePage} of {totalPages}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, activePage - 1))}
          disabled={activePage === 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FaChevronLeft className="h-3 w-3" />
        </button>
        {pageNumbers[0] > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onChange(1)}
              className="h-8 min-w-8 rounded-md px-2 text-sm font-bold text-neutral-600"
            >
              1
            </button>
            <span className="px-1 text-neutral-400">...</span>
          </>
        ) : null}
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onChange(pageNumber)}
            className={`h-8 min-w-8 rounded-md px-2 text-sm font-bold ${
              activePage === pageNumber ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        {pageNumbers[pageNumbers.length - 1] < totalPages ? (
          <>
            <span className="px-1 text-neutral-400">...</span>
            <button
              type="button"
              onClick={() => onChange(totalPages)}
              className="h-8 min-w-8 rounded-md px-2 text-sm font-bold text-neutral-600"
            >
              {totalPages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, activePage + 1))}
          disabled={activePage === totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FaChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const success = notice.tone === "success";
  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border p-4 shadow-xl ${
        success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}
      >
        <FaCheck className="h-3 w-3" />
      </span>
      <p className="flex-1 text-sm font-semibold leading-5">{notice.text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-neutral-500 hover:text-neutral-950"
      >
        <FaXmark />
      </button>
    </div>
  );
}
