"use client";

import Link from "next/link";
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
} from "react-icons/fa6";
import { formatDisplayDate } from "@/src/lib/appointments";
import type { PatientRecordItem, PatientVisitRecord } from "@/src/lib/clinic";
import { calculatePatientAge } from "@/src/lib/patient-registration";
import { useRole } from "@/src/components/layout/RoleProvider";

type Payload = { patients: PatientRecordItem[]; visits: PatientVisitRecord[] };
type ImportPayload = {
  result?: { created: number; updated: number; skipped: number; errors: string[] };
  message?: string;
};
type PatientFilter = "All" | "New" | "Regular";
type Notice = { text: string; tone: "success" | "error" };

const TABLE_COLUMNS = ["Patient No.", "Patient", "Age / Sex", "Contact", "Type", "Last Visit"] as const;
const DEFAULT_PAGE_SIZE = 10;

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
  const [isImporting, setIsImporting] = useState(false);

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
      existing: patients.filter((patient) => patient.patientCategory === "Regular").length,
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

  function importPatientFile(file: File | null) {
    if (!file || !accessToken) return;
    setIsImporting(true);
    void (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/patient-record-import", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const payload = (await response.json().catch(() => null)) as ImportPayload | null;
        if (!response.ok || !payload?.result) throw new Error(payload?.message ?? "Unable to import patients.");
        const { created, updated, skipped, errors } = payload.result;
        setNotice({
          tone: "success",
          text: `Import complete: ${created} added, ${updated} updated, ${skipped} skipped.${errors.length ? ` ${errors.length} row issue(s).` : ""}`,
        });
        await loadRecords(accessToken);
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to import patients." });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
              <option value="Regular">Existing patients</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => importPatientFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaCloudArrowUp className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import"}
            </button>
            <Link
              href="/patients/add"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              <FaUserPlus className="h-4 w-4" />
              Add patient
            </Link>
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
                    onClick={() => openPatient(patient.id)}
                    className="group cursor-pointer bg-white text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <TableCell className="sticky left-0 z-10 bg-white font-mono text-xs font-bold text-neutral-950 group-hover:bg-neutral-50">
                      {patient.patientNumber || "-"}
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-neutral-950">{patient.fullName}</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.email || "No email"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-neutral-800">{calculatePatientAge(patient.dateOfBirth) ?? "-"} yrs</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.gender || "Not recorded"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-neutral-800">{patient.phone || "No contact"}</p>
                      <p className="mt-1 text-xs text-neutral-500">{patient.civilStatus || "Civil status not set"}</p>
                    </TableCell>
                    <TableCell>
                      <PatientBadge category={patient.patientCategory} />
                    </TableCell>
                    <TableCell>
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

      {notice ? <Toast notice={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  );
}

function normalizePatient(patient: PatientRecordItem): PatientRecordItem {
  return patient.patientCategory === "OldRecord" ? { ...patient, patientCategory: "Regular" } : patient;
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

function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-top leading-5 ${className}`}>{children}</td>;
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
