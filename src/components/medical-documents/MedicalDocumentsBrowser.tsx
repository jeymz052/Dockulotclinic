"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FaArrowDownAZ,
  FaArrowLeft,
  FaArrowUpAZ,
  FaArrowUpRightFromSquare,
  FaChevronRight,
  FaDownload,
  FaEnvelope,
  FaFolderOpen,
  FaMagnifyingGlass,
  FaUser,
  FaXmark,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { resolveAftercareGuideForService } from "@/src/lib/healthcare-content";

type PrescriptionItem = {
  id?: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  sort_order?: number | null;
};

type DocumentDetail = {
  label: string;
  value: string;
};

type PatientExplorerItem = {
  id: string;
  name: string;
  subtitle?: string | null;
  documentCount: number;
  latestDateLabel?: string | null;
};

type PreviewType = "pdf" | "image" | "text" | "link";

export type MedicalDocumentItem = {
  id: string;
  category: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  dateLabel?: string | null;
  sortDate?: number | null;
  summary?: string | null;
  note?: string | null;
  details?: DocumentDetail[];
  bullets?: string[];
  previewType: PreviewType;
  previewUrl?: string | null;
  openUrl?: string | null;
  downloadUrl?: string | null;
  fileName?: string | null;
  badge?: string | null;
  patientId?: string | null;
  prescriptionNo?: string | null;
  prescriptionPatientName?: string | null;
  prescriptionPatientDob?: string | null;
  prescriptionPatientGender?: string | null;
  prescriptionDoctorName?: string | null;
  prescriptionDoctorSpecialty?: string | null;
  prescriptionDoctorLicenseNo?: string | null;
  prescriptionDoctorSignatureDataUrl?: string | null;
  prescriptionCreatedAt?: string | null;
  prescriptionGeneralInstructions?: string | null;
  prescriptionFollowUpDate?: string | null;
  prescriptionItems?: PrescriptionItem[];
  consentPatientName?: string | null;
  consentProcedureName?: string | null;
  consentSignedAt?: string | null;
  consentFormUrl?: string | null;
  consentSnapshot?: Record<string, unknown> | null;
  consentPatientSignature?: string | null;
  consentWitnessName?: string | null;
  consentWitnessSignature?: string | null;
  consentWitnessSignedAt?: string | null;
  consentPhysicianName?: string | null;
  consentPhysicianSignature?: string | null;
  consentPhysicianSignedAt?: string | null;
  consentAftercareAcknowledged?: boolean | null;
  consentAftercareGuideTitle?: string | null;
  consentAftercareImageUrl?: string | null;
  labRequestNo?: string | null;
  labPatientName?: string | null;
  labPatientDob?: string | null;
  labPatientGender?: string | null;
  labPatientAddress?: string | null;
  labDoctorName?: string | null;
  labDoctorSpecialty?: string | null;
  labDoctorLicenseNo?: string | null;
  labDoctorSignatureDataUrl?: string | null;
  labCreatedAt?: string | null;
  labSelectedTests?: string[];
  labBloodChemistry?: string[];
  labHematology?: string[];
  labImmunoSerology?: string[];
  labClinicalMicroscopy?: string[];
  labUltrasound?: string | null;
  labXray?: string | null;
  labCtScan?: string | null;
  labOthers?: string | null;
  labNotes?: string | null;
  referralNo?: string | null;
  referralSpecialty?: string | null;
  referredDoctorName?: string | null;
  referralReason?: string | null;
};

type BrowserProps = {
  kicker?: string;
  title: string;
  description: string;
  items: MedicalDocumentItem[];
  patients?: PatientExplorerItem[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  note?: string;
};

function formatPrescriptionSpecialty(raw?: string | null) {
  const specialty = raw?.trim();
  if (!specialty) return "Family Medicine Specialist | Aesthetic Medicine";
  if (/family medicine specialist/i.test(specialty)) return "Family Medicine Specialist | Aesthetic Medicine";
  if (/family medicine and aesthetic medicine/i.test(specialty)) return "Family Medicine Specialist | Aesthetic Medicine";
  if (/family and aesthetic medicine/i.test(specialty)) return "Family Medicine Specialist | Aesthetic Medicine";
  return specialty;
}

function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: date.toLocaleDateString("en-US"),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

async function fetchBlobUrl(source: string, accessToken?: string | null) {
  if (!source) return null;
  if (source.startsWith("data:") || /^https?:\/\//i.test(source)) return source;

  const response = await fetch(source, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Unable to load ${source}`);
  }

  const blob = await response.blob();
  return window.URL.createObjectURL(blob);
}

function normalizeSelection(items: MedicalDocumentItem[], selectedId: string | null) {
  if (!items.length) return null;
  const chosen = items.find((item) => item.id === selectedId);
  return chosen ?? items[0] ?? null;
}

export function MedicalDocumentsBrowser({
  kicker,
  title,
  description,
  items,
  patients = [],
  loading,
  emptyTitle,
  emptyDescription,
  note,
}: BrowserProps) {
  const { role, accessToken } = useRole();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSort, setPatientSort] = useState<"name-asc" | "name-desc" | "records-desc">("name-asc");
  const [docSearch, setDocSearch] = useState("");
  const [docSort, setDocSort] = useState<"date-desc" | "date-asc" | "title-asc">("date-desc");

  const isPatient = role === "PATIENT";
  const canEmailToPatient = role === "DOCTOR" || role === "SUPER_ADMIN";
  const hasPatientExplorer = !isPatient && patients.length > 0;

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const filteredAndSortedPatients = useMemo(() => {
    let result = [...patients];
    if (patientSearch.trim()) {
      const q = patientSearch.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.subtitle && p.subtitle.toLowerCase().includes(q)),
      );
    }
    result.sort((a, b) => {
      if (patientSort === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (patientSort === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (patientSort === "records-desc") {
        return b.documentCount - a.documentCount || a.name.localeCompare(b.name);
      }
      return 0;
    });
    return result;
  }, [patients, patientSearch, patientSort]);

  const isItemForPatient = (item: MedicalDocumentItem, patient: PatientExplorerItem | null) => {
    if (!patient) return false;
    if (item.patientId && item.patientId === patient.id) return true;
    const pName = patient.name.trim().toLowerCase();
    if (!pName) return false;
    if (item.prescriptionPatientName && item.prescriptionPatientName.trim().toLowerCase() === pName) return true;
    if (item.consentPatientName && item.consentPatientName.trim().toLowerCase() === pName) return true;
    if (item.labPatientName && item.labPatientName.trim().toLowerCase() === pName) return true;
    if (item.details?.some((d) => d.label.toLowerCase() === "patient" && d.value.trim().toLowerCase() === pName)) return true;
    return false;
  };

  const allPatientItems = useMemo(() => {
    if (!hasPatientExplorer || !selectedPatient) return items;
    return items.filter((item) => isItemForPatient(item, selectedPatient));
  }, [hasPatientExplorer, items, selectedPatient]);

  const patientItems = useMemo(() => {
    if (filter === "All") return allPatientItems;
    return allPatientItems.filter((item) => item.category === filter);
  }, [allPatientItems, filter]);

  const filteredItems = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((item) => item.category === filter);
  }, [filter, items]);

  const visibleItems = hasPatientExplorer && selectedPatientId ? patientItems : filteredItems;

  const processedDocuments = useMemo(() => {
    let list = [...visibleItems];
    if (docSearch.trim()) {
      const q = docSearch.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.kind.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.dateLabel && item.dateLabel.toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      if (docSort === "date-desc") {
        return (b.sortDate ?? 0) - (a.sortDate ?? 0);
      }
      if (docSort === "date-asc") {
        return (a.sortDate ?? 0) - (b.sortDate ?? 0);
      }
      if (docSort === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
    return list;
  }, [visibleItems, docSearch, docSort]);

  const categories = useMemo(() => {
    const sourceList = hasPatientExplorer && selectedPatientId ? allPatientItems : items;
    return ["All", ...new Set(sourceList.map((item) => item.category))];
  }, [allPatientItems, hasPatientExplorer, items, selectedPatientId]);

  useEffect(() => {
    if (filter !== "All" && !categories.includes(filter)) {
      setFilter("All");
    }
  }, [categories, filter]);

  const selectedItem = useMemo(
    () => normalizeSelection(processedDocuments, hasPatientExplorer ? selectedDocumentId : selectedId),
    [hasPatientExplorer, processedDocuments, selectedDocumentId, selectedId],
  );

  useEffect(() => {
    if (hasPatientExplorer) return;
    if (!processedDocuments.length) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) => {
      if (current && processedDocuments.some((item) => item.id === current)) return current;
      return processedDocuments[0]?.id ?? null;
    });
  }, [hasPatientExplorer, processedDocuments]);

  useEffect(() => {
    if (!hasPatientExplorer) {
      setSelectedPatientId(null);
      setSelectedDocumentId(null);
      return;
    }

    if (!selectedPatientId) {
      setSelectedDocumentId(null);
      return;
    }

    if (!processedDocuments.length) {
      setSelectedDocumentId(null);
      return;
    }

    setSelectedDocumentId((current) => {
      if (current && processedDocuments.some((item) => item.id === current)) return current;
      return processedDocuments[0]?.id ?? null;
    });
  }, [hasPatientExplorer, processedDocuments, selectedPatientId]);

  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;

    async function load() {
      setPreviewSource(null);
      setPreviewError(null);
      setPreviewLoading(false);

      if (!selectedItem) return;
      if (
        selectedItem.kind === "Prescription" ||
        selectedItem.kind === "Medical Certificate" ||
        selectedItem.kind === "MD Referral" ||
        selectedItem.kind === "Doctor Referral" ||
        selectedItem.kind === "Signed Consent Form" ||
        selectedItem.kind === "Post-procedure aftercare" ||
        selectedItem.previewType === "text"
      ) {
        return;
      }

      const source = selectedItem.previewUrl ?? selectedItem.openUrl ?? selectedItem.downloadUrl ?? "";
      if (!source) return;

      try {
        setPreviewLoading(true);
        const resolved = await fetchBlobUrl(source, accessToken);
        if (!active) return;
        blobUrl = resolved?.startsWith("blob:") ? resolved : null;
        setPreviewSource(resolved);
      } catch {
        if (!active) return;
        setPreviewError("This document cannot be previewed here.");
        setPreviewSource(source);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
  }, [accessToken, selectedItem]);

  /**
   * Returns true on iOS (Safari or Chrome-on-iOS) — blob: URL navigation and
   * <a download> are broken on all iOS browsers due to WebKit restrictions.
   */
  function isIos() {
    return /iP(hone|ad|od)/i.test(navigator.userAgent);
  }

  /**
   * Returns true on any mobile browser where blob: URLs in new tabs are
   * unreliable. This covers iOS (all browsers) and Android Chrome / WebView.
   */
  function isMobileBrowser() {
    if (isIos()) return true;
    // Android Chrome and WebView block navigating a pre-opened about:blank
    // window to a blob: URL created asynchronously in the opener's context.
    return /Android/i.test(navigator.userAgent);
  }

  async function resolveSource(item: MedicalDocumentItem) {
    const source = item.openUrl ?? item.downloadUrl ?? item.previewUrl ?? "";
    if (!source) return null;
    if (source.startsWith("data:") || /^https?:\/\//i.test(source)) return source;
    if (!accessToken) return source;
    const response = await fetch(source, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Unable to load document.");
    const blob = await response.blob();
    return window.URL.createObjectURL(blob);
  }

  /**
   * On mobile browsers, Chrome/Android blocks navigating a pre-opened blank
   * window to a blob: URL. Instead we write an HTML page containing an
   * <embed> that embeds the blob: URL — this works because the blob is in
   * the same origin and document.write to an about:blank popup is allowed.
   */
  function openBlobInWindow(win: Window, blobUrl: string, title: string) {
    win.document.open();
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>*{margin:0;padding:0;box-sizing:border-box}html,body,embed{width:100%;height:100%;display:block}</style></head>` +
      `<body><embed src="${blobUrl}" type="application/pdf" width="100%" height="100%"></embed></body></html>`,
    );
    win.document.close();
  }

  async function openDocument(item: MedicalDocumentItem) {
    // Open a blank window BEFORE the async fetch so mobile browsers don't
    // treat it as an unsolicited popup and block it.
    const win = window.open("", "_blank");
    try {
      const source = await resolveSource(item);
      if (!source) {
        win?.close();
        return;
      }

      if (win) {
        if (source.startsWith("blob:") && isMobileBrowser()) {
          // Android Chrome (and iOS) block blob: URL navigation in a new tab;
          // write an embed page directly into the about:blank window instead.
          openBlobInWindow(win, source, item.title);
        } else {
          win.location.href = source;
        }
      } else {
        // Fallback in case window.open returned null (e.g. popups fully disabled).
        window.location.href = source;
      }

      if (source.startsWith("blob:")) {
        window.setTimeout(() => window.URL.revokeObjectURL(source), 60_000);
      }
    } catch {
      win?.close();
      // Last-resort: navigate in-page — at least the user gets the PDF.
      const fallback = item.openUrl ?? item.previewUrl ?? item.downloadUrl ?? "";
      if (fallback) window.open(fallback, "_blank", "noopener,noreferrer");
    }
  }

  async function downloadDocument(item: MedicalDocumentItem) {
    try {
      const source = await resolveSource(item);
      if (!source) return;

      // On mobile (iOS and Android), <a download href="blob:…"> does not
      // trigger a real file download. Open the blob in a new tab instead so
      // the user can use the share-sheet / long-press to save the file.
      if (isMobileBrowser() && source.startsWith("blob:")) {
        const win = window.open("", "_blank");
        if (win) {
          openBlobInWindow(win, source, item.title);
        } else {
          window.location.href = source;
        }
        window.setTimeout(() => window.URL.revokeObjectURL(source), 60_000);
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = source;
      anchor.download = item.fileName ?? `${item.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      if (source.startsWith("blob:")) {
        window.setTimeout(() => window.URL.revokeObjectURL(source), 15_000);
      }
    } catch {
      const direct = item.downloadUrl ?? item.previewUrl ?? "";
      if (!direct) return;
      if (isMobileBrowser()) {
        window.open(direct, "_blank", "noopener,noreferrer");
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = direct;
      anchor.download = item.fileName ?? `${item.title}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  async function emailToPatient(item: MedicalDocumentItem) {
    if (!item.id || emailSending) return;
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/v2/medical-documents/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          documentId: item.id,
          kind: item.kind,
          patientId: item.patientId,
          category: item.category,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || "Failed to send email to patient.");
      }
      setEmailStatus({
        type: "success",
        message: data?.message || "Medical document has been emailed to the patient.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send email to patient.";
      setEmailStatus({
        type: "error",
        message: msg,
      });
    } finally {
      setEmailSending(false);
    }
  }

  const selectedCategory = selectedItem?.category ?? (hasPatientExplorer && selectedPatientId ? "Records" : "Documents");
  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-4xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 bg-linear-to-br from-neutral-50 to-white px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-600">
              {kicker ?? (isPatient ? "Patient Portal" : "Clinic Workspace")}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-black">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
            {note ? <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">{note}</p> : null}
          </div>
          <div className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">
            {filteredItems.length} records
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
                filter === category
                  ? "border-black bg-black text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-black"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm flex flex-col min-h-[640px] xl:h-[calc(100vh-17rem)]">
          {/* VIEW 1: Patient Records List (When hasPatientExplorer && !selectedPatientId) */}
          {hasPatientExplorer && !selectedPatientId ? (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="border-b border-neutral-200 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">Patients</p>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">
                    {filteredAndSortedPatients.length}
                  </span>
                </div>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-black">Patient records</h2>
                <p className="mt-1 text-xs text-neutral-500">Select a patient to view their medical documents</p>
              </div>

              {/* Search & Sort Filters for Patients */}
              <div className="border-b border-neutral-200 bg-neutral-50/50 p-4 space-y-2.5">
                <div className="relative">
                  <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient name..."
                    className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-8 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
                  />
                  {patientSearch ? (
                    <button
                      type="button"
                      onClick={() => setPatientSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <FaXmark className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Sort</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPatientSort("name-asc")}
                      title="Sort A to Z"
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        patientSort === "name-asc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      <FaArrowDownAZ className="h-3 w-3" />
                      A-Z
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientSort("name-desc")}
                      title="Sort Z to A"
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        patientSort === "name-desc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      <FaArrowUpAZ className="h-3 w-3" />
                      Z-A
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientSort("records-desc")}
                      title="Sort by most records"
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        patientSort === "records-desc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      Records
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Patient Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-4 min-h-72">
                {loading ? (
                  <div className="py-12 text-center text-sm text-neutral-500">Loading patient records...</div>
                ) : filteredAndSortedPatients.length === 0 ? (
                  <div className="py-12 text-center">
                    <FaFolderOpen className="mx-auto h-8 w-8 text-neutral-300" />
                    <p className="mt-3 text-sm font-semibold text-neutral-700">
                      {patientSearch ? `No patient matching "${patientSearch}"` : "No patients found"}
                    </p>
                    {patientSearch ? (
                      <button
                        type="button"
                        onClick={() => setPatientSearch("")}
                        className="mt-2 text-xs font-bold text-neutral-900 underline cursor-pointer"
                      >
                        Clear search
                      </button>
                    ) : null}
                  </div>
                ) : (
                  filteredAndSortedPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setSelectedDocumentId(null);
                        setDocSearch("");
                      }}
                      className="group flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white p-3.5 text-left transition hover:border-neutral-900 hover:bg-neutral-50/80 hover:shadow-xs cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-black text-neutral-950 group-hover:text-black">
                          {patient.name}
                        </p>
                        <p className="mt-1 text-xs font-medium text-neutral-500">
                          {patient.documentCount} record{patient.documentCount === 1 ? "" : "s"}
                          {patient.latestDateLabel ? ` • ${patient.latestDateLabel}` : ""}
                        </p>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 transition group-hover:bg-neutral-950 group-hover:text-white">
                        <FaChevronRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {/* VIEW 2: Patient's Documents (When hasPatientExplorer && selectedPatientId) OR (When !hasPatientExplorer) */}
          {(!hasPatientExplorer || selectedPatientId) ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Header with Breadcrumb and Back Button */}
              {hasPatientExplorer && selectedPatient ? (
                <div className="border-b border-neutral-200 px-4 py-3.5 space-y-2.5 bg-neutral-50/40">
                  {/* Row 1: Back button & Document Count */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(null);
                        setSelectedDocumentId(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-800 transition hover:bg-neutral-100 hover:text-black shadow-2xs group cursor-pointer"
                    >
                      <FaArrowLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" />
                      <span>Back to Patients</span>
                    </button>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-700">
                      {patientItems.length} {patientItems.length === 1 ? "record" : "records"}
                    </span>
                  </div>

                  {/* Row 2: Breadcrumbs of patient name - medical document */}
                  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(null);
                        setSelectedDocumentId(null);
                      }}
                      className="font-bold text-neutral-600 hover:text-black hover:underline shrink-0 cursor-pointer"
                    >
                      Patients
                    </button>
                    <span className="text-neutral-400 shrink-0">/</span>
                    <span className="font-bold text-neutral-900 truncate" title={selectedPatient.name}>
                      {selectedPatient.name}
                    </span>
                    <span className="text-neutral-400 shrink-0">–</span>
                    <span
                      className="font-semibold text-neutral-700 truncate"
                      title={selectedItem?.title || "Medical Document"}
                    >
                      {selectedItem?.title || "Medical Document"}
                    </span>
                  </nav>
                </div>
              ) : (
                <div className="border-b border-neutral-200 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">Documents</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-black">All records</h2>
                </div>
              )}

              {/* Document Search & Sort */}
              <div className="border-b border-neutral-200 bg-neutral-50/50 p-3.5 space-y-2.5">
                <div className="relative">
                  <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Filter documents..."
                    className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-7 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
                  />
                  {docSearch ? (
                    <button
                      type="button"
                      onClick={() => setDocSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                    >
                      <FaXmark className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Sort</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDocSort("date-desc")}
                      title="Newest first"
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                        docSort === "date-desc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      Newest
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocSort("date-asc")}
                      title="Oldest first"
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                        docSort === "date-asc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      Oldest
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocSort("title-asc")}
                      title="Sort A to Z"
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                        docSort === "title-asc"
                          ? "bg-neutral-950 text-white shadow-xs"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      A-Z
                    </button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="px-5 py-6 text-sm text-neutral-500">Loading medical documents...</div>
              ) : null}

              {/* Scrollable Document List */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4 min-h-72">
                {!loading && processedDocuments.length === 0 ? (
                  <div className="py-12 text-center">
                    <FaFolderOpen className="mx-auto h-8 w-8 text-neutral-300" />
                    <h3 className="mt-3 text-sm font-bold text-black">
                      {docSearch ? `No documents matching "${docSearch}"` : emptyTitle}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      {docSearch ? "Try adjusting your search filter." : emptyDescription}
                    </p>
                  </div>
                ) : (
                  processedDocuments.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => hasPatientExplorer ? setSelectedDocumentId(item.id) : setSelectedId(item.id)}
                      className={`w-full rounded-[1.1rem] border px-4 py-3.5 text-left transition cursor-pointer ${
                        selectedItem?.id === item.id
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-xs font-black uppercase tracking-[0.14em] ${selectedItem?.id === item.id ? "text-neutral-200" : "text-neutral-500"}`}>
                            {item.title}
                          </p>
                          {item.badge ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                              selectedItem?.id === item.id
                                ? "border-white/20 bg-white/10 text-white"
                                : "border-neutral-200 bg-neutral-50 text-neutral-700"
                            }`}>
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="break-words text-sm font-black leading-snug">{item.kind}</p>
                        <p className={`text-xs ${selectedItem?.id === item.id ? "text-neutral-200" : "text-neutral-600"}`}>
                          {item.subtitle || " "}
                        </p>
                        <p className={`text-[11px] font-semibold ${selectedItem?.id === item.id ? "text-neutral-300" : "text-neutral-500"}`}>
                          {item.dateLabel || ""}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-neutral-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              {hasPatientExplorer && selectedPatient ? (
                <nav aria-label="Document Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(null);
                      setSelectedDocumentId(null);
                    }}
                    className="font-bold text-neutral-600 hover:text-black hover:underline cursor-pointer"
                  >
                    Patients
                  </button>
                  <span className="text-neutral-400">/</span>
                  <span className="font-semibold text-neutral-700">{selectedPatient.name}</span>
                  <span className="text-neutral-400">–</span>
                  <span className="font-bold text-neutral-950 truncate">
                    {selectedItem?.title ?? "Medical Document"}
                  </span>
                </nav>
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-600">{selectedCategory}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-black">
                {selectedItem?.title ?? "No record selected"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                {selectedItem
                  ? `${selectedItem.subtitle ?? " "} ${selectedItem.dateLabel ? `| ${selectedItem.dateLabel}` : ""}`.trim()
                  : "Choose a document from the list to preview the exact file."}
              </p>
            </div>

            {selectedItem ? (
              <div className="flex flex-wrap items-center gap-2">
                {canEmailToPatient ? (
                  <ActionButton
                    label={emailSending ? "Sending..." : "Email to Patient"}
                    icon={<FaEnvelope className="h-4 w-4" />}
                    onClick={() => void emailToPatient(selectedItem)}
                    disabled={emailSending}
                  />
                ) : null}
                <ActionButton
                  label="Open"
                  icon={<FaArrowUpRightFromSquare className="h-4 w-4" />}
                  onClick={() => void openDocument(selectedItem)}
                />
                <ActionButton
                  label="Download"
                  icon={<FaDownload className="h-4 w-4" />}
                  filled
                  onClick={() => void downloadDocument(selectedItem)}
                />
              </div>
            ) : null}
          </div>

          {emailStatus ? (
            <div
              className={`mx-6 mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                emailStatus.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <span>{emailStatus.message}</span>
              <button
                type="button"
                onClick={() => setEmailStatus(null)}
                className="text-xs font-bold underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="p-4 sm:p-5">
            {selectedItem ? (
              <DocumentPreview item={selectedItem} previewSource={previewSource} previewLoading={previewLoading} previewError={previewError} />
            ) : (
              <div className="flex min-h-128 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-500">
                Select a document to preview it here.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  filled,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition ${
        disabled
          ? "cursor-not-allowed opacity-60 border-neutral-200 bg-neutral-100 text-neutral-400"
          : filled
            ? "border-black bg-black text-white hover:bg-neutral-800"
            : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DocumentPreview({
  item,
  previewSource,
  previewLoading,
  previewError,
}: {
  item: MedicalDocumentItem;
  previewSource: string | null;
  previewLoading: boolean;
  previewError: string | null;
}) {
  if (item.kind === "Prescription") {
    return <PrescriptionPreview item={item} />;
  }

  if (item.kind === "MD Referral" || item.kind === "Doctor Referral") {
    return <MDReferralPreview item={item} />;
  }

  if (item.kind === "Medical Certificate") {
    return <MedicalCertificatePreview item={item} />;
  }

  if (item.kind === "Laboratory Request" || item.kind === "Lab Request") {
    return <LaboratoryRequestPreview item={item} />;
  }

  if (item.kind === "Signed Consent Form") {
    return <ConsentPreview item={item} />;
  }

  if (item.previewType === "text") {
    return <AftercarePreview item={item} />;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-600">{item.kind}</p>
            <h3 className="mt-2 text-lg font-black text-black">{item.title}</h3>
            {item.summary ? <p className="mt-2 text-sm leading-6 text-neutral-600">{item.summary}</p> : null}
          </div>
          {item.badge ? <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">{item.badge}</span> : null}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {previewLoading ? (
          <div className="flex min-h-128 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500">
            Loading exact file preview...
          </div>
        ) : null}

        {!previewLoading && previewSource && item.previewType === "image" ? (
          <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
            <img src={previewSource} alt={item.title} className="h-auto w-full object-contain" />
          </div>
        ) : null}

        {!previewLoading && previewSource && item.previewType === "pdf" ? (
          <iframe
            src={previewSource}
            title={item.title}
            className="min-h-168 w-full rounded-3xl border border-neutral-200 bg-neutral-50"
          />
        ) : null}

        {!previewLoading && item.previewType === "link" && previewSource ? (
          <div className="flex min-h-112 items-center justify-center rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-center">
            <div>
              <p className="text-lg font-bold text-black">Exact file source</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                The original document is available from the clinic source. Use Open or Download to view it directly.
              </p>
            </div>
          </div>
        ) : null}

        {!previewLoading && !previewSource ? (
          <div className="flex min-h-128 items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
            <div>
              <p className="text-lg font-bold text-black">This document cannot be previewed here.</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Use Open or Download to view the exact file in a new tab or save it locally.
              </p>
            </div>
          </div>
        ) : null}

        {previewError ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{previewError}</p> : null}
      </div>
    </div>
  );
}

function PrescriptionPreview({ item }: { item: MedicalDocumentItem }) {
  const medicines = [...(item.prescriptionItems ?? [])].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
  );
  const doctorName = item.prescriptionDoctorName ?? "Doctor not recorded";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const specialty = formatPrescriptionSpecialty(item.prescriptionDoctorSpecialty);
  const prcNo = item.prescriptionDoctorLicenseNo ?? "0141185";
  const patientAge = ageFromDob(item.prescriptionPatientDob);
  const createdAt = formatDateTime(item.prescriptionCreatedAt);
  const signatureDataUrl = item.prescriptionDoctorSignatureDataUrl ?? "";

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12">
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-52 max-w-full object-contain sm:w-60"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">Prescription ID</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-black">{item.prescriptionNo}</p>
          </div>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">{doctorHeaderName}</p>
          <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">Family Medicine Specialist | Aesthetic Medicine</p>
          <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
          <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm leading-6 text-neutral-900">
                Patient: <span className="font-black text-black">{item.prescriptionPatientName ?? "Patient"}</span>
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                Age: {patientAge != null ? `${patientAge} years old` : "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                Gender: {item.prescriptionPatientGender || "Not recorded"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm leading-6 text-neutral-700">
                Prescribed on: {createdAt.date || "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-700">{createdAt.time ? `${createdAt.time} PHT` : ""}</p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-4">
            <p className="text-4xl font-black leading-none tracking-tight text-black">Rx</p>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <div className="mt-6 space-y-5">
            {medicines.length > 0 ? (
              medicines.map((medicine, index) => (
                <div key={`${item.id}-${medicine.id ?? index}`} className="pl-4">
                  <p className="text-[1.55rem] font-black leading-tight tracking-tight text-black">
                    {medicine.medicine_name}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-neutral-800">
                    {[medicine.dosage, medicine.duration ? `#${medicine.duration}` : null].filter(Boolean).join(" ") || "No dosage recorded"}
                  </p>
                  {medicine.frequency ? (
                    <p className="mt-0.5 text-sm leading-6 text-neutral-700">Sig.&#8194;{medicine.frequency}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="pl-4 text-sm text-neutral-500">No medicine items recorded.</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold italic text-black">Note:</p>
          <p className="mt-1 text-sm leading-6 text-neutral-800">
            {item.prescriptionGeneralInstructions || "No additional instructions recorded."}
          </p>
          {item.prescriptionFollowUpDate ? (
            <p className="mt-1 text-sm leading-6 text-neutral-800">
              Follow-up: {item.prescriptionFollowUpDate}
            </p>
          ) : null}
        </div>

        <div className="mt-16 flex justify-end">
          <div className="w-72 text-center">
            {signatureDataUrl ? (
              <div className="mb-0 flex h-24 items-end justify-center border-b border-black pb-1">
                <img
                  src={signatureDataUrl}
                  alt="Physician signature"
                  className="h-auto max-h-16 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="mb-0 h-24 border-b border-black" />
            )}
            <p className="mt-2 text-sm font-black text-neutral-950">{doctorHeaderName}</p>
            <p className="text-xs text-neutral-700">Family Medicine</p>
            <p className="text-xs text-neutral-700">Aesthetic Medicine</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-800">PRC License No.: {prcNo}</p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm font-semibold text-neutral-700">(End of Prescription)</p>
          <p className="mt-6 text-sm leading-6 text-neutral-800">
            Note to User: The information contained in this electronic prescription is provided by the prescriber and should be verified before dispensing.
          </p>
          <div className="mt-6 border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-neutral-700">Powered by Doc Kulot</p>
            <p className="text-sm text-neutral-700">For clinic use only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicalCertificatePreview({ item }: { item: MedicalDocumentItem }) {
  const { accessToken } = useRole();
  const [resolvedDoctorName, setResolvedDoctorName] = useState<string | null>(null);
  const [resolvedSpecialty, setResolvedSpecialty] = useState<string | null>(null);
  const [resolvedLicenseNo, setResolvedLicenseNo] = useState<string | null>(null);
  const [resolvedSignature, setResolvedSignature] = useState<string | null>(null);
  const [resolvedPatientName, setResolvedPatientName] = useState<string | null>(null);
  const [resolvedPatientDob, setResolvedPatientDob] = useState<string | null>(null);
  const [resolvedPatientGender, setResolvedPatientGender] = useState<string | null>(null);
  const [resolvedComplaints, setResolvedComplaints] = useState<string | null>(null);
  const [resolvedDiagnosis, setResolvedDiagnosis] = useState<string | null>(null);
  const [resolvedRecommendation, setResolvedRecommendation] = useState<string | null>(null);
  const [resolvedCreatedAt, setResolvedCreatedAt] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchMetadata = async () => {
      try {
        if (!item.id) {
          if (active) setMetadataLoading(false);
          return;
        }
        const response = await fetch(`/api/v2/medical-certificates/${item.id}/metadata`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (response.ok && active) {
          const data = await response.json();
          setResolvedDoctorName(data.doctorName ?? null);
          setResolvedSpecialty(data.doctorSpecialty ?? null);
          setResolvedLicenseNo(data.doctorLicenseNo ?? null);
          setResolvedSignature(data.doctorSignatureDataUrl ?? null);
          setResolvedPatientName(data.patientName ?? null);
          setResolvedPatientDob(data.patientDob ?? null);
          setResolvedPatientGender(data.patientGender ?? null);
          setResolvedComplaints(data.complaints ?? null);
          setResolvedDiagnosis(data.diagnosis ?? null);
          setResolvedRecommendation(data.recommendation ?? null);
          setResolvedCreatedAt(data.createdAt ?? null);
        }
      } catch {
        // Use fallback values
      } finally {
        if (active) setMetadataLoading(false);
      }
    };
    fetchMetadata();
    return () => {
      active = false;
    };
  }, [accessToken, item.id]);

  const certificateNo = item.title || item.fileName?.replace(/\.[^.]+$/, "") || "MC-00000000";
  const patientName =
    resolvedPatientName ||
    item.prescriptionPatientName ||
    item.details?.find((detail) => /patient/i.test(detail.label))?.value ||
    "Patient";
  const complaints =
    resolvedComplaints ||
    item.details?.find((detail) => /complaint/i.test(detail.label))?.value ||
    (item.summary && !/medical certificate issued/i.test(item.summary) ? item.summary : null) ||
    "Not recorded.";
  const diagnosis =
    resolvedDiagnosis ||
    item.details?.find((detail) => /diagnosis/i.test(detail.label))?.value ||
    (item.summary && !/medical certificate issued/i.test(item.summary) ? item.summary : null) ||
    "Not recorded.";
  const recommendation =
    resolvedRecommendation ||
    item.details?.find((detail) => /recommendation/i.test(detail.label))?.value ||
    item.note ||
    "Not recorded.";
  const patientDob = resolvedPatientDob ?? item.prescriptionPatientDob;
  const patientAge = ageFromDob(patientDob);
  const patientGender =
    resolvedPatientGender ||
    item.prescriptionPatientGender ||
    item.details?.find((detail) => /gender/i.test(detail.label))?.value ||
    "Not recorded";
  const createdAt = formatDateTime(resolvedCreatedAt || item.prescriptionCreatedAt || null);

  const rawDoctorName = metadataLoading
    ? (item.prescriptionDoctorName ?? "Dr. Fatimah Al-Zahra T. Ditti")
    : (resolvedDoctorName ?? item.prescriptionDoctorName ?? "Dr. Fatimah Al-Zahra T. Ditti");
  const doctorName = !rawDoctorName || /not recorded/i.test(rawDoctorName) ? "Dr. Fatimah Al-Zahra T. Ditti" : rawDoctorName;
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : "Fatimah Al-Zahra T. Ditti, MD";
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Fatimah Al-Zahra T. Ditti Online Clinic";
  const rawSpecialty = metadataLoading
    ? item.prescriptionDoctorSpecialty
    : (resolvedSpecialty ?? item.prescriptionDoctorSpecialty);
  const specialty = formatPrescriptionSpecialty(rawSpecialty);
  const prcNo = metadataLoading
    ? (item.prescriptionDoctorLicenseNo ?? "0141185")
    : (resolvedLicenseNo ?? item.prescriptionDoctorLicenseNo ?? "0141185");
  const signatureDataUrl = metadataLoading
    ? (item.prescriptionDoctorSignatureDataUrl ?? "")
    : (resolvedSignature ?? item.prescriptionDoctorSignatureDataUrl ?? "");

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12">
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-52 max-w-full object-contain sm:w-60"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">Medical Certificate ID</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-black">{certificateNo}</p>
          </div>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">
            {doctorHeaderName}
          </p>
          <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">Family Medicine Specialist | Aesthetic Medicine</p>
          <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
          <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
          <p className="mt-3 text-2xl font-black tracking-[0.12em] text-black">MEDICAL CERTIFICATE</p>
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm leading-6 text-neutral-900">
                Patient: <span className="font-black text-black">{patientName}</span>
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                Age: {patientAge != null ? `${patientAge} years old` : "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-800">Gender: {patientGender}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm leading-6 text-neutral-700">
                Issued on: {createdAt.date || item.dateLabel || "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-700">{createdAt.time ? `${createdAt.time} PHT` : ""}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-7">
          <section>
            <p className="text-sm font-semibold italic text-black">Complaints:</p>
            <p className="mt-1 text-sm leading-6 text-neutral-800">{complaints}</p>
          </section>
          <section>
            <p className="text-sm font-semibold italic text-black">Diagnosis:</p>
            <p className="mt-1 text-sm leading-6 text-neutral-800">{diagnosis}</p>
          </section>
          <section>
            <p className="text-sm font-semibold italic text-black">Recommendation:</p>
            <p className="mt-1 text-sm leading-6 text-neutral-800">{recommendation}</p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <p className="mx-auto max-w-3xl text-sm leading-6 text-neutral-800">
            This certificate is issued upon the request of the above patient for whatever purpose it may serve, except for medico-legal reasons.
          </p>
        </div>

        <div className="mt-16 flex justify-end">
          <div className="w-72 text-center">
            {signatureDataUrl ? (
              <div className="mb-0 flex h-24 items-end justify-center border-b border-black pb-1">
                <img
                  src={signatureDataUrl}
                  alt="Physician signature"
                  className="h-auto max-h-16 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="mb-0 h-24 border-b border-black" />
            )}
            <p className="mt-2 text-sm font-black text-neutral-950">{doctorHeaderName}</p>
            <p className="text-xs text-neutral-700">Family Medicine</p>
            <p className="text-xs text-neutral-700">Aesthetic Medicine</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-800">PRC License No.: {prcNo}</p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm font-semibold text-neutral-700">(End of Medical Certificate)</p>
          <p className="mt-6 text-sm leading-6 text-neutral-800">
            Note to User: The information contained in this medical certificate is provided by the prescriber and should be verified by the clinic before use.
          </p>
          <div className="mt-6 border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-neutral-700">Powered by Doc Kulot</p>
            <p className="text-sm text-neutral-700">For clinic use only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MDReferralPreview({ item }: { item: MedicalDocumentItem }) {
  const { accessToken } = useRole();
  const [resolvedDoctorName, setResolvedDoctorName] = useState<string | null>(null);
  const [resolvedSpecialty, setResolvedSpecialty] = useState<string | null>(null);
  const [resolvedLicenseNo, setResolvedLicenseNo] = useState<string | null>(null);
  const [resolvedSignature, setResolvedSignature] = useState<string | null>(null);
  const [resolvedPatientName, setResolvedPatientName] = useState<string | null>(null);
  const [resolvedPatientDob, setResolvedPatientDob] = useState<string | null>(null);
  const [resolvedPatientGender, setResolvedPatientGender] = useState<string | null>(null);
  const [resolvedReferredSpecialty, setResolvedReferredSpecialty] = useState<string | null>(null);
  const [resolvedReferredDoctor, setResolvedReferredDoctor] = useState<string | null>(null);
  const [resolvedReason, setResolvedReason] = useState<string | null>(null);
  const [resolvedCreatedAt, setResolvedCreatedAt] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchMetadata = async () => {
      try {
        if (!item.id) {
          if (active) setMetadataLoading(false);
          return;
        }
        const response = await fetch(`/api/v2/md-referrals/${item.id}/metadata`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (response.ok && active) {
          const data = await response.json();
          setResolvedDoctorName(data.doctorName ?? null);
          setResolvedSpecialty(data.doctorSpecialty ?? null);
          setResolvedLicenseNo(data.doctorLicenseNo ?? null);
          setResolvedSignature(data.doctorSignatureDataUrl ?? null);
          setResolvedPatientName(data.patientName ?? null);
          setResolvedPatientDob(data.patientDob ?? null);
          setResolvedPatientGender(data.patientGender ?? null);
          setResolvedReferredSpecialty(data.referredSpecialty ?? null);
          setResolvedReferredDoctor(data.referredDoctor ?? null);
          setResolvedReason(data.reasonForReferral ?? null);
          setResolvedCreatedAt(data.createdAt ?? null);
        }
      } catch {
        // Fallback to item
      } finally {
        if (active) setMetadataLoading(false);
      }
    };
    fetchMetadata();
    return () => {
      active = false;
    };
  }, [accessToken, item.id]);

  const referralNo =
    item.referralNo ||
    item.title?.replace(/\.[^.]+$/, "") ||
    item.fileName?.replace(/\.[^.]+$/, "") ||
    "REF-00000000";

  const patientName =
    resolvedPatientName ||
    item.prescriptionPatientName ||
    item.details?.find((detail) => /patient/i.test(detail.label))?.value ||
    "Patient";

  const patientDob = resolvedPatientDob ?? item.prescriptionPatientDob;
  const patientAge = ageFromDob(patientDob);
  const patientGender =
    resolvedPatientGender ||
    item.prescriptionPatientGender ||
    item.details?.find((detail) => /gender/i.test(detail.label))?.value ||
    "Not recorded";

  const referredSpecialty =
    resolvedReferredSpecialty ||
    item.referralSpecialty ||
    item.details?.find((detail) => /specialty/i.test(detail.label))?.value ||
    "Internal Medicine";

  const referredDoctor =
    resolvedReferredDoctor?.trim() ||
    item.referredDoctorName?.trim() ||
    item.details?.find((detail) => /^referred\s*doctor$/i.test(detail.label))?.value?.trim() ||
    null;

  const reason =
    resolvedReason ||
    item.referralReason ||
    item.note ||
    item.summary ||
    "Clinical consultation and management.";

  const createdAt = formatDateTime(resolvedCreatedAt || item.prescriptionCreatedAt || null);

  const rawDoctorName = metadataLoading
    ? (item.prescriptionDoctorName ?? "Dr. Fatimah Al-Zahra T. Ditti")
    : (resolvedDoctorName ?? item.prescriptionDoctorName ?? "Dr. Fatimah Al-Zahra T. Ditti");
  const doctorName = !rawDoctorName || /not recorded/i.test(rawDoctorName) ? "Dr. Fatimah Al-Zahra T. Ditti" : rawDoctorName;
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : "Fatimah Al-Zahra T. Ditti, MD";
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const rawSpecialty = metadataLoading
    ? item.prescriptionDoctorSpecialty
    : (resolvedSpecialty ?? item.prescriptionDoctorSpecialty);
  const specialty = rawSpecialty?.trim() || "Family Medicine Specialist | Aesthetic Medicine";
  const prcNo = metadataLoading
    ? (item.prescriptionDoctorLicenseNo ?? "0141185")
    : (resolvedLicenseNo ?? item.prescriptionDoctorLicenseNo ?? "0141185");
  const signatureDataUrl = metadataLoading
    ? (item.prescriptionDoctorSignatureDataUrl ?? "")
    : (resolvedSignature ?? item.prescriptionDoctorSignatureDataUrl ?? "");

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12">
        {/* Top Header matching prescription format */}
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-52 max-w-full object-contain sm:w-60"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">REFERRAL ID</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-black">{referralNo}</p>
          </div>
        </div>

        {/* Doctor and Clinic Header matching prescription */}
        <div className="mt-7 text-center">
          <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">{doctorHeaderName}</p>
          <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">Family Medicine Specialist | Aesthetic Medicine</p>
          <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
          <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
        </div>

        {/* Patient Details & Date */}
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm leading-6 text-neutral-900">
                Patient: <span className="font-black text-black">{patientName}</span>
              </p>
              <p className="text-sm leading-6 text-neutral-800">
                Age: {patientAge != null ? `${patientAge} years old` : "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-800">Gender: {patientGender}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm leading-6 text-neutral-700">
                Referred on: {createdAt.date || item.dateLabel || "Not recorded"}
              </p>
              <p className="text-sm leading-6 text-neutral-700">
                {createdAt.time ? `${createdAt.time} PHT` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Content Section: Referred Doctor & Reason for Referral */}
        <div className="mt-8 space-y-6">
          <div>
            <p className="text-base font-black text-black">Referred Doctor</p>
            <div className="mt-2 space-y-1">
              {referredDoctor ? (
                <p className="text-sm text-neutral-800">
                  Doctor: <span className="font-semibold text-neutral-900">{referredDoctor}</span>
                </p>
              ) : null}
              <p className="text-sm text-neutral-800">
                Specialty: <span className="font-semibold text-neutral-900">{referredSpecialty}</span>
              </p>
            </div>
          </div>

          <div>
            <p className="text-base font-black text-black">Reason for Referral</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
              {reason}
            </p>
          </div>
        </div>

        {/* Physician's Signature */}
        <div className="mt-16 flex justify-end">
          <div className="w-72 text-center">
            {signatureDataUrl ? (
              <div className="mb-0 flex h-24 items-end justify-center border-b border-black pb-1">
                <img
                  src={signatureDataUrl}
                  alt="Physician signature"
                  className="h-auto max-h-16 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="mb-0 h-24 border-b border-black" />
            )}
            <p className="mt-2 text-sm font-black text-neutral-950">{doctorHeaderName}</p>
            <p className="text-xs text-neutral-700">Family Medicine</p>
            <p className="text-xs text-neutral-700">Aesthetic Medicine</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-800">PRC License No.: {prcNo}</p>
          </div>
        </div>

        {/* Footer & Revised Disclaimer matching prescription */}
        <div className="mt-14 text-center">
          <p className="text-sm font-semibold text-neutral-700">(End of MD Referral)</p>
          <p className="mt-6 text-sm leading-6 text-neutral-800">
            Note to User: The information contained in this electronic referral is provided by the referring physician and should be verified upon presentation.
          </p>
          <div className="mt-6 border-t border-neutral-200 pt-3">
            <p className="text-sm font-semibold text-neutral-700">Powered by Doc Kulot</p>
            <p className="text-sm text-neutral-700">For clinic use only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaboratoryRequestPreview({ item }: { item: MedicalDocumentItem }) {
  const { accessToken } = useRole();
  const [meta, setMeta] = useState<{
    requestNo?: string;
    patientName?: string | null;
    patientDob?: string | null;
    patientGender?: string | null;
    patientAddress?: string | null;
    doctorName?: string | null;
    doctorSpecialty?: string | null;
    doctorLicenseNo?: string | null;
    doctorSignatureDataUrl?: string | null;
    selectedTests?: string[];
    bloodChemistry?: string[];
    hematology?: string[];
    immunoSerology?: string[];
    clinicalMicroscopy?: string[];
    ultrasound?: string | null;
    xray?: string | null;
    ctScan?: string | null;
    others?: string | null;
    notes?: string | null;
    createdAt?: string | null;
  } | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchMeta() {
      try {
        if (!item.id) return;
        const res = await fetch(`/api/v2/laboratory-requests/${item.id}/metadata`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (res.ok && active) {
          const data = await res.json();
          setMeta(data);
        }
      } catch {
        // Fallback to item props
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchMeta();
    return () => {
      active = false;
    };
  }, [accessToken, item.id]);

  const requestNo = meta?.requestNo || item.labRequestNo || item.title?.replace(/\.pdf$/i, "") || "LR-REQ";
  const patientName = meta?.patientName || item.labPatientName || item.prescriptionPatientName || "Patient";
  const patientDob = meta?.patientDob ?? item.labPatientDob ?? item.prescriptionPatientDob;
  const patientAge = ageFromDob(patientDob);
  const patientGender = meta?.patientGender || item.labPatientGender || item.prescriptionPatientGender || "";
  const patientAddress = meta?.patientAddress || item.labPatientAddress || "";
  const createdAt = formatDateTime(meta?.createdAt || item.labCreatedAt || item.prescriptionCreatedAt || null);

  const rawDoctorName = meta?.doctorName || item.labDoctorName || "FATIMAH AL-ZAHRA T. DITTI, MD, DFM";
  const doctorNameBase = rawDoctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD, DFM` : rawDoctorName;
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const specialty = meta?.doctorSpecialty || item.labDoctorSpecialty || "Family Medicine\nAesthetic Medicine";
  const prcNo = meta?.doctorLicenseNo || item.labDoctorLicenseNo || "0141185";
  const signatureDataUrl = meta?.doctorSignatureDataUrl || item.labDoctorSignatureDataUrl || "";

  const allSelected = useMemo(() => {
    const list = [
      ...(meta?.selectedTests ?? item.labSelectedTests ?? []),
      ...(meta?.bloodChemistry ?? item.labBloodChemistry ?? []),
      ...(meta?.hematology ?? item.labHematology ?? []),
      ...(meta?.immunoSerology ?? item.labImmunoSerology ?? []),
      ...(meta?.clinicalMicroscopy ?? item.labClinicalMicroscopy ?? []),
    ];
    return new Set(list);
  }, [meta, item]);

  const ultrasound = meta?.ultrasound ?? item.labUltrasound ?? "";
  const xray = meta?.xray ?? item.labXray ?? "";
  const ctScan = meta?.ctScan ?? item.labCtScan ?? "";
  const others = meta?.others ?? meta?.notes ?? item.labOthers ?? item.labNotes ?? "";

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12 font-sans">
        {/* Header Branding */}
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-52 max-w-full object-contain sm:w-60"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">Laboratory Request ID</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-black">{requestNo}</p>
          </div>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">{doctorHeaderName}</p>
          <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">Family Medicine Specialist | Aesthetic Medicine</p>
          <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
          <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
          <p className="mt-4 text-2xl font-black uppercase tracking-[0.25em] text-neutral-950">
            LABORATORY REQUEST
          </p>
        </div>

        {/* Patient Demographic Information Header */}
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</p>
              <p className="mt-0.5 font-bold text-neutral-900">{createdAt.date || "Not recorded"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Patient&apos;s Name</p>
              <p className="mt-0.5 font-bold text-neutral-950 text-base">{patientName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Age / Sex</p>
              <p className="mt-0.5 font-bold text-neutral-900">
                {patientAge != null ? `${patientAge} yrs` : "-"} / {patientGender || "-"}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Address</p>
              <p className="mt-0.5 text-neutral-800">{patientAddress || "Not recorded"}</p>
            </div>
          </div>
        </div>

        {/* 4 Laboratory Categories */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* BLOOD CHEMISTRY */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-sky-900 border-b border-neutral-200 pb-2 mb-3">
              BLOOD CHEMISTRY
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="space-y-2">
                {[
                  "Lipid Profile",
                  "Fasting Blood Sugar",
                  "Blood Uric Acid",
                  "SGOT (AST)",
                  "SGPT (ALT)",
                  "BUN",
                  "Creatinine",
                ].map((test) => (
                  <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
                ))}
              </div>
              <div className="space-y-2">
                {[
                  "Electrolytes",
                  "Total protein",
                  "B1, B2",
                  "HbA1c",
                ].map((test) => (
                  <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
                ))}
              </div>
            </div>
          </div>

          {/* HEMATOLOGY */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-rose-900 border-b border-neutral-200 pb-2 mb-3">
              HEMATOLOGY
            </h3>
            <div className="space-y-2 text-xs">
              {[
                "Complete Blood Count",
                "Blood Typing",
                "Clotting/Bleeding Time",
                "Protime",
                "APTT",
              ].map((test) => (
                <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
              ))}
            </div>
          </div>

          {/* IMMUNO/SEROLOGY */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-purple-900 border-b border-neutral-200 pb-2 mb-3">
              IMMUNO / SEROLOGY
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="space-y-2">
                {[
                  "HBsAg",
                  "Hepatitis C Virus",
                  "Hepatitis A Virus",
                  "HIV",
                  "Syphilis Test",
                ].map((test) => (
                  <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
                ))}
              </div>
              <div className="space-y-2">
                {[
                  "Typhoid",
                  "Dengue",
                  "H.Pylori",
                ].map((test) => (
                  <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
                ))}
              </div>
            </div>
          </div>

          {/* CLINICAL MICROSCOPY */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-emerald-900 border-b border-neutral-200 pb-2 mb-3">
              CLINICAL MICROSCOPY
            </h3>
            <div className="space-y-2 text-xs">
              {[
                "Urinalysis",
                "Fecalysis",
                "Pregnancy Test",
                "Fecal Occult Blood",
              ].map((test) => (
                <LabCheckboxItem key={test} label={test} checked={allSelected.has(test)} />
              ))}
            </div>
          </div>
        </div>

        {/* IMAGING & SPECIAL DIAGNOSTICS */}
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-900 mb-3">
            IMAGING & SPECIAL DIAGNOSTICS
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-bold text-neutral-900 shrink-0 w-28">Ultrasound:</span>
              <span className={`flex-1 border-b border-neutral-300 pb-0.5 ${ultrasound ? "font-bold text-neutral-950" : "text-neutral-400 italic"}`}>
                {ultrasound || "None specified"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-bold text-neutral-900 shrink-0 w-28">X-Ray:</span>
              <span className={`flex-1 border-b border-neutral-300 pb-0.5 ${xray ? "font-bold text-neutral-950" : "text-neutral-400 italic"}`}>
                {xray || "None specified"}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="font-bold text-neutral-900 shrink-0 w-28">CT Scan / Other:</span>
              <span className={`flex-1 border-b border-neutral-300 pb-0.5 ${ctScan ? "font-bold text-neutral-950" : "text-neutral-400 italic"}`}>
                {ctScan || "None specified"}
              </span>
            </div>
          </div>
        </div>

        {/* OTHERS / CLINICAL REMARKS */}
        {others ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-900 mb-2">
              OTHERS / CLINICAL REMARKS
            </h3>
            <p className="text-sm font-semibold text-neutral-950 whitespace-pre-wrap">{others}</p>
          </div>
        ) : null}

        {/* Requesting Physician Signature Block */}
        <div className="mt-12 flex justify-end">
          <div className="w-80 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1">
              Requesting Physician
            </p>
            {signatureDataUrl ? (
              <div className="flex h-20 items-end justify-center border-b border-neutral-950 pb-1">
                <img
                  src={signatureDataUrl}
                  alt="Doctor signature"
                  className="max-h-16 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="h-16 border-b border-neutral-950" />
            )}
            <p className="mt-2 text-sm font-black text-neutral-950">{doctorHeaderName}</p>
            <p className="text-xs text-neutral-700">Family Medicine</p>
            <p className="text-xs text-neutral-700">Aesthetic Medicine</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-800">PRC License No.: {prcNo}</p>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="mt-10 border-t border-neutral-200 pt-4 text-center text-xs text-neutral-500">
          <p>This laboratory / diagnostic request is issued for clinical evaluation. Results should be submitted for physician review.</p>
          <p className="mt-1 font-semibold text-neutral-600">Powered by Doc Kulot Online Clinic</p>
        </div>
      </div>
    </div>
  );
}

function LabCheckboxItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-4 w-4 rounded flex items-center justify-center text-[10px] font-black shrink-0 transition ${
          checked
            ? "bg-neutral-950 text-white border border-neutral-950"
            : "border border-neutral-300 bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </div>
      <span className={checked ? "font-bold text-neutral-950" : "text-neutral-700"}>{label}</span>
    </div>
  );
}

function ConsentPreview({ item }: { item: MedicalDocumentItem }) {
  const { accessToken } = useRole();
  const [resolvedDoctorSignature, setResolvedDoctorSignature] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDoctorSignature() {
      try {
        const res = await fetch("/api/v2/settings/online-payment-qr", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data.doctorSignatureDataUrl) {
            setResolvedDoctorSignature(data.doctorSignatureDataUrl);
          }
        }
      } catch {
        // Fallback
      }
    }
    void loadDoctorSignature();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const points = Array.isArray(item.consentSnapshot?.consentBullets) && item.consentSnapshot.consentBullets.length >= 6
    ? item.consentSnapshot.consentBullets.filter((point): point is string => typeof point === "string" && Boolean(point.trim()))
    : item.bullets?.length && item.bullets.length >= 6
      ? item.bullets
      : [
          "I confirm that all procedure/s to be done on me has been fully explained to me in a language that I understand, including the nature and purpose, expected benefits, possible risks, side effects, complications and possible alternatives, including doing nothing.",
          "I understand the intended outcome and that results may vary from person to person. No guarantees or promises have been made to me regarding specific results.",
          "I understand that while every effort will be made to ensure safety and the best possible care, no medical procedure is 100% risk-free.",
          "I am aware that the clinic and the attending physician (Doc Kulot) do not take responsibility for any uneventful incident, complication, or dissatisfaction that may occur despite proper care.",
          "I hereby consent willingly and voluntarily to undergo the above-stated procedure(s). I will not hold the clinic, its staff, or the attending physician liable for any adverse outcome, and I will not initiate any legal action or claim against them.",
          "I understand that I may withdraw my consent at any time prior to the procedure. Once the procedure has started, I understand that I may not be able to withdraw my consent.",
        ];

  const patientName = item.consentPatientName || "Patient";
  const procedureName = item.consentProcedureName || item.title || "Procedure";
  const signedDateStr = item.consentSignedAt
    ? formatDateTime(item.consentSignedAt).date
    : item.dateLabel || "Not recorded";

  const doctorName = item.consentPhysicianName || "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const prcNo = item.prescriptionDoctorLicenseNo || "0141185";
  const physicianSig = item.consentPhysicianSignature || resolvedDoctorSignature || "";

  const normProc = procedureName.toLowerCase();
  const isBotox = normProc.includes("botox");
  const isFillers = normProc.includes("filler");
  const isMeso = normProc.includes("mesotherapy") || normProc.includes("mesolipo");
  const isSclero = normProc.includes("sclerotherapy");
  const isGlp = normProc.includes("glp");
  const isOther = !isBotox && !isFillers && !isMeso && !isSclero && !isGlp;

  const procedureChecklist = [
    { label: "Botox", checked: isBotox },
    { label: "Fillers", checked: isFillers },
    { label: "Mesotherapy", checked: isMeso },
    { label: "Sclerotherapy", checked: isSclero },
    { label: "GLP Initiation", checked: isGlp },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12 font-sans">
        {/* Header Branding */}
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-36 max-w-full object-contain sm:w-44"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              PATIENT PROCEDURE CONSENT
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-700">Date: {signedDateStr}</p>
          </div>
        </div>

        {/* Center Clinic / Doctor Info matching reference */}
        <div className="mt-2 text-center">
          <p className="font-serif text-2xl sm:text-3xl font-black text-neutral-950">Doc Kulot</p>
          <p className="mt-0.5 text-xs font-black uppercase tracking-[0.2em] text-neutral-700">Family Medicine Specialist</p>
          <p className="text-[11px] font-semibold tracking-widest text-neutral-500">— AESTHETIC MEDICINE —</p>
          <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-black uppercase tracking-[0.08em] text-neutral-950">
            PATIENT CONSENT
          </h2>
          <p className="mt-1 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-neutral-600">
            INFORMED CONSENT FOR MEDICAL / AESTHETIC PROCEDURE(S)
          </p>
        </div>

        {/* PROCEDURE(S) TO BE PERFORMED box */}
        <div className="mt-6 rounded-xl border border-amber-800/30 bg-[#fbf9f4] p-4 text-xs sm:text-sm">
          <div className="flex justify-center -mt-7 mb-3">
            <span className="rounded-md bg-[#8d6741] px-4 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
              Procedure(s) to be performed:
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 font-semibold text-neutral-800">
            {procedureChecklist.map((proc) => (
              <label key={proc.label} className="inline-flex items-center gap-2">
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                    proc.checked
                      ? "bg-[#8d6741] text-white font-black"
                      : "border border-neutral-400 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={proc.checked ? "font-bold text-neutral-950" : "text-neutral-700"}>{proc.label}</span>
              </label>
            ))}
            <label className="inline-flex items-center gap-2">
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                  isOther
                    ? "bg-[#8d6741] text-white font-black"
                    : "border border-neutral-400 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span className={isOther ? "font-bold text-neutral-950" : "text-neutral-700"}>
                Other procedure:{" "}
                <span className="border-b border-neutral-400 px-2 font-bold text-neutral-950">
                  {isOther ? procedureName : "_______________________"}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Preamble Statement */}
        <div className="mt-5 text-xs sm:text-sm leading-relaxed text-neutral-800">
          <p>
            I, the undersigned, hereby voluntarily give my consent to undergo the above-stated procedure(s) to be
            performed by <span className="font-bold text-neutral-950">Doc Kulot, Family Medicine Specialist and Aesthetic Medicine</span>.
          </p>
        </div>

        {/* Numbered Points with styled check marks */}
        <div className="mt-4 space-y-3 text-xs sm:text-sm leading-relaxed text-neutral-800">
          {points.map((point, index) => (
            <div key={`${point}-${index}`} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-[#8d6741] text-[10px] font-black text-white">
                ✓
              </span>
              <p className="leading-snug">{point}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer Box */}
        <div className="mt-5 rounded-xl border border-amber-700/30 bg-[#fbf9f4] p-4 text-xs sm:text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#8d6741] text-base font-black text-white">
              +
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.14em] text-neutral-950 text-xs">DISCLAIMER</p>
              <p className="mt-1 text-xs text-neutral-700 leading-relaxed">
                By signing this form, I acknowledge that I have read, understood, and had the opportunity to ask
                questions. All procedures, benefits, risks, possible side effects, alternatives, and expected
                outcomes were explained to me. I am signing this consent form of my own free will.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Signature Columns: Patient, Witness, Physician */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {/* Patient Signature */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900 mb-1">
                PATIENT SIGNATURE
              </p>
              <div className="flex h-16 items-end justify-center border-b border-neutral-950 pb-1">
                {item.consentPatientSignature ? (
                  <img
                    src={item.consentPatientSignature}
                    alt="Patient signature"
                    className="max-h-14 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs text-neutral-400 italic mb-2">Not signed</span>
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-neutral-950">PRINTED NAME: {patientName}</p>
              <p className="text-[11px] text-neutral-600">DATE: {signedDateStr}</p>
            </div>

            {/* Witness Signature */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900 mb-1">
                WITNESS SIGNATURE
              </p>
              <div className="flex h-16 items-end justify-center border-b border-neutral-950 pb-1">
                {item.consentWitnessSignature ? (
                  <img
                    src={item.consentWitnessSignature}
                    alt="Witness signature"
                    className="max-h-14 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs text-neutral-400 italic mb-2">Pending witness</span>
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-neutral-950">PRINTED NAME: {item.consentWitnessName || "Clinic Witness"}</p>
              <p className="text-[11px] text-neutral-600">
                DATE: {item.consentWitnessSignedAt ? formatDateTime(item.consentWitnessSignedAt).date : (item.consentWitnessSignature ? signedDateStr : "Pending")}
              </p>
            </div>

            {/* Physician Signature */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-900 mb-1">
                PHYSICIAN (DOC KULOT) SIGNATURE
              </p>
              <div className="flex h-16 items-end justify-center border-b border-neutral-950 pb-1">
                {physicianSig ? (
                  <img
                    src={physicianSig}
                    alt="Physician signature"
                    className="max-h-14 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs text-neutral-400 italic mb-2">Pending signature</span>
                )}
              </div>
              <p className="mt-2 text-xs font-bold text-neutral-950">PRINTED NAME: {doctorHeaderName}</p>
              <p className="text-[11px] text-neutral-600">Family Medicine</p>
              <p className="text-[11px] text-neutral-600">Aesthetic Medicine</p>
              <p className="text-[11px] font-bold text-neutral-700">PRC License No.: {prcNo}</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                DATE: {item.consentPhysicianSignedAt ? formatDateTime(item.consentPhysicianSignedAt).date : (physicianSig ? signedDateStr : "Pending")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">
          <p className="font-semibold text-neutral-600">(End of Procedure Consent Form)</p>
          <p className="mt-0.5 font-bold text-neutral-700">Powered by Doc Kulot Online Clinic System</p>
        </div>
      </div>
    </div>
  );
}

function AftercarePreview({ item }: { item: MedicalDocumentItem }) {
  const { accessToken } = useRole();
  const [doctorSig, setDoctorSig] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDoctorSignature() {
      try {
        const res = await fetch("/api/v2/prescriptions/default-doctor-signature", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data.doctorSignatureDataUrl) {
            setDoctorSig(data.doctorSignatureDataUrl);
          }
        }
      } catch {
        // Fallback
      }
    }
    void loadDoctorSignature();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const procName = item.consentProcedureName || item.title || "Procedure";
  const guide = resolveAftercareGuideForService(procName);
  const guideTitle = item.consentAftercareGuideTitle || guide?.title || `${procName} Aftercare`;
  const summary =
    guide?.summary ||
    item.summary ||
    "Follow these post-procedure instructions carefully to support optimal healing and results.";
  const bullets =
    guide?.bullets && guide.bullets.length > 0
      ? guide.bullets
      : item.bullets && item.bullets.length > 0
        ? item.bullets
        : [
            "Follow all post-procedure care instructions given by the doctor.",
            "Keep the treated area clean, dry, and protected.",
            "Avoid strenuous activities and heat exposure for 24-48 hours.",
            "Contact the clinic immediately if you experience unusual symptoms or severe discomfort.",
          ];
  const dos = guide?.dos ?? [];
  const donts = guide?.donts ?? [];
  const followUp = guide?.followUp || "Keep your scheduled follow-up consultation with the doctor.";
  const alert =
    guide?.alert ||
    "Contact the clinic promptly for severe pain, unusual swelling, redness, fever, or concerning symptoms.";

  const patientName = item.consentPatientName || item.subtitle || "Patient";
  const dateStr = item.dateLabel || "Not recorded";
  const isAcknowledged = item.badge === "Acknowledged" || item.consentAftercareAcknowledged;
  const statusLabel = isAcknowledged ? "Acknowledged" : "Provided";

  const doctorName = item.prescriptionDoctorName || item.consentPhysicianName || "Dr. Fatimah Al-Zahra T. Ditti";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const prcNo = item.prescriptionDoctorLicenseNo || "0141185";

  const resolvedSignature = item.prescriptionDoctorSignatureDataUrl || item.consentPhysicianSignature || doctorSig;

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12 font-sans">
        {/* Header: Logo left, Date right */}
        <div className="flex items-start justify-between gap-6">
          <Image
            src="/images/dockulotslogonobg.png"
            alt="Doc Kulot logo"
            width={300}
            height={168}
            className="h-auto w-36 max-w-full object-contain sm:w-44"
            priority
          />
          <div className="min-w-44 text-right">
            <p className="text-sm font-semibold text-neutral-700">Date: {dateStr}</p>
          </div>
        </div>

        {/* Center Doctor / Clinic Info */}
        <div className="mt-2 text-center">
          <p className="text-base font-black tracking-tight text-neutral-950 sm:text-xl">
            {doctorHeaderName}
          </p>
          <p className="mt-0.5 text-xs text-neutral-600 sm:text-sm">
            Family Medicine Specialist | Aesthetic Medicine
          </p>
          <p className="mt-0.5 text-base font-black tracking-tight text-neutral-950 sm:text-lg">
            Doc Kulot Online Clinic
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">Zamboanga City, Zamboanga Del Sur</p>
        </div>

        <div className="mt-4 border-t border-neutral-300" />

        {/* Document Title */}
        <div className="mt-4 text-center">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-[0.14em] text-neutral-950">
            POST-PROCEDURE AFTERCARE INSTRUCTIONS
          </h2>
        </div>

        {/* Patient & Procedure Banner Box */}
        <div className="mt-4 rounded-xl border border-neutral-300 bg-neutral-50/70 px-4 py-3 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-bold text-neutral-950">Patient: </span>
              <span className="font-bold text-neutral-950">{patientName}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-neutral-700">Guide: </span>
              <span className="font-semibold text-neutral-900">{guideTitle}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-950">Procedure: </span>
              <span className="font-bold text-neutral-950">{procName}</span>
            </div>
            <div className="sm:text-right">
              <span className="text-neutral-700">Status: </span>
              <span className="font-semibold text-neutral-900">{statusLabel}</span>
            </div>
          </div>
        </div>

        {/* Guide Title & Summary */}
        <div className="mt-6">
          <h3 className="font-black uppercase tracking-[0.08em] text-neutral-950 text-sm sm:text-base">
            {guideTitle.toUpperCase()}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-neutral-800 leading-relaxed">{summary}</p>
        </div>

        {/* Key Care Instructions */}
        <div className="mt-5">
          <h4 className="font-black uppercase tracking-[0.14em] text-neutral-950 text-xs sm:text-sm">
            KEY CARE INSTRUCTIONS
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs sm:text-sm text-neutral-800 leading-relaxed">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <span className="font-bold text-neutral-700">-</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DOs & DON'Ts */}
        {(dos.length > 0 || donts.length > 0) && (
          <div className="mt-5 space-y-4">
            {dos.length > 0 && (
              <div>
                <h4 className="font-black uppercase tracking-[0.14em] text-neutral-950 text-xs sm:text-sm">
                  DOs:
                </h4>
                <ul className="mt-1.5 space-y-1 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                  {dos.map((doItem) => (
                    <li key={doItem} className="flex items-start gap-2.5">
                      <span className="font-bold text-emerald-700">+</span>
                      <span>{doItem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {donts.length > 0 && (
              <div>
                <h4 className="font-black uppercase tracking-[0.14em] text-neutral-950 text-xs sm:text-sm">
                  DON&apos;Ts:
                </h4>
                <ul className="mt-1.5 space-y-1 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                  {donts.map((dontItem) => (
                    <li key={dontItem} className="flex items-start gap-2.5">
                      <span className="font-bold text-red-600">✕</span>
                      <span>{dontItem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Follow-up & Urgent Alert */}
        <div className="mt-5 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 text-xs sm:text-sm">
          <p className="text-neutral-800">
            <span className="font-bold text-neutral-950">Follow-up: </span>
            {followUp}
          </p>
          <p className="text-red-800 italic">
            <span className="font-bold not-italic">Urgent Alert: </span>
            {alert}
          </p>
        </div>

        {/* Doctor Signature Block at Bottom Right */}
        <div className="mt-8 flex justify-end">
          <div className="w-64 text-center">
            <div className="flex h-16 items-end justify-center border-b border-neutral-950 pb-1">
              {resolvedSignature ? (
                <img
                  src={resolvedSignature}
                  alt="Doctor signature"
                  className="max-h-14 w-auto object-contain"
                />
              ) : (
                <span className="text-xs text-neutral-400 italic mb-2">Physician Verified</span>
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-neutral-950">{doctorHeaderName}</p>
            <p className="text-[11px] text-neutral-600">Family Medicine Specialist | Aesthetic Medicine</p>
            <p className="text-[11px] font-bold text-neutral-700">PRC License No.: {prcNo}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">
          <p className="font-semibold text-neutral-600">(End of Post-Procedure Aftercare Instructions)</p>
          <p className="mt-0.5 font-bold text-neutral-700">Powered by Doc Kulot Online Clinic System</p>
        </div>
      </div>
    </div>
  );
}
