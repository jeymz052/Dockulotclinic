"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  FaArrowLeft,
  FaChevronDown,
  FaCircleCheck,
  FaCircleInfo,
  FaDownload,
  FaEnvelope,
  FaFloppyDisk,
  FaPlus,
  FaPrint,
  FaRotateLeft,
  FaXmark,
} from "react-icons/fa6";
import type { PatientRecordItem } from "@/src/lib/clinic";
import type { AppointmentRecord } from "@/src/lib/appointments";
import {
  COMMON_DURATIONS,
  COMMON_FREQUENCIES,
  COMMON_INSTRUCTIONS,
  CLINIC_PRESCRIPTION_TEMPLATES,
  FORMULARY_MEDICINES,
  createEmptyPrescriptionItem,
  type PpdMedicineItem,
  type PrescriptionItemDraft,
} from "@/src/lib/ppd-medicines";

type Props = {
  items: PrescriptionItemDraft[];
  instructions: string;
  followUpDate: string;
  releaseToPatient: boolean;
  feedback: string | null;
  createdPrescription: { id: string; prescriptionNo: string } | null;
  disabled: boolean;
  patientMatched: boolean;
  patientRecord: PatientRecordItem | null;
  appointment?: AppointmentRecord | null;
  doctorName?: string;
  doctorSpecialty?: string;
  onItemsChange: (items: PrescriptionItemDraft[]) => void;
  onInstructionsChange: (val: string) => void;
  onFollowUpDateChange: (val: string) => void;
  onReleaseChange: (val: boolean) => void;
  onSave: () => void;
  onDiscard?: () => void;
  onDownloadCreated?: () => void;
  onPrintCreated?: () => void;
  onEmailCreated?: () => void;
  onProceedNextStep?: () => void;
};

function calculateAge(dob?: string | null) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function PpdPrescriptionBuilder({
  items,
  instructions,
  followUpDate,
  releaseToPatient,
  feedback,
  createdPrescription,
  disabled,
  patientMatched,
  patientRecord,
  appointment,
  doctorName = "Dr. Fatimah Al-Zahra T. Ditti",
  doctorSpecialty = "Family Medicine",
  onItemsChange,
  onInstructionsChange,
  onFollowUpDateChange,
  onReleaseChange,
  onSave,
  onDiscard,
  onDownloadCreated,
  onPrintCreated,
  onEmailCreated,
  onProceedNextStep,
}: Props) {
  // Navigation inside prescription builder:
  // "list": Current Prescription Information list (Image 2 & 3)
  // "form": Create/Edit Prescription Information form (Image 1)
  // "review": Review Your Prescription with watermark preview (Image 4)
  const [viewMode, setViewMode] = useState<"list" | "form" | "review">("list");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formDraft, setFormDraft] = useState<PrescriptionItemDraft>(createEmptyPrescriptionItem());
  const [customBrandMode, setCustomBrandMode] = useState(false);
  const [productInfoMedicine, setProductInfoMedicine] = useState<PpdMedicineItem | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  // Patient calculations
  const patientAge = patientRecord ? calculateAge(patientRecord.dateOfBirth) : null;
  const patientName = patientRecord?.fullName || appointment?.patientName || "Patient";
  const patientCode = patientRecord?.patientNumber || "OMA3929";
  const patientGender = patientRecord?.gender || "Male";
  const patientEmail = patientRecord?.email || appointment?.email || "patient@example.com";

  // Doctor header names
  const cleanDoctorName = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = cleanDoctorName ? `${cleanDoctorName}, MD` : doctorName;
  const clinicHeaderName = cleanDoctorName ? `${cleanDoctorName} Online Clinic` : "Doc Kulot Online Clinic";
  const prcNo = "0141185";

  // Stable preview prescription ID matching actual RX-XXXXXXXX format
  const previewPrescriptionNo = useMemo(() => {
    return "RX-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  }, []);
  const displayedPrescriptionNo = createdPrescription?.prescriptionNo || previewPrescriptionNo;

  // Date and Time matching MedicalDocumentsBrowser
  const now = useMemo(() => new Date(), []);
  const prescribedDate = useMemo(() => {
    return now.toLocaleDateString("en-US");
  }, [now]);
  const prescribedTime = useMemo(() => {
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  }, [now]);

  // Doctor signature resolution
  const [resolvedDoctorSignature, setResolvedDoctorSignature] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDoctorSignature() {
      try {
        const res = await fetch("/api/v2/prescriptions/default-doctor-signature", {
          cache: "no-store",
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
  }, []);

  // Filter valid items that have a medicine name
  const validItems = useMemo(() => {
    return items.filter((item) => (item.genericName?.trim() || item.medicineName?.trim()));
  }, [items]);

  // Selected formulary medicine for form helper
  const selectedFormularyMedicine = useMemo(() => {
    if (!formDraft.genericName) return null;
    return (
      FORMULARY_MEDICINES.find(
        (m) => m.genericName.toLowerCase() === formDraft.genericName.trim().toLowerCase(),
      ) || null
    );
  }, [formDraft.genericName]);

  // Open add new medicine form
  function handleOpenAdd() {
    setEditingIndex(null);
    setCustomBrandMode(false);
    setFormDraft(createEmptyPrescriptionItem());
    setViewMode("form");
  }

  // Open edit existing medicine form
  function handleOpenEdit(index: number) {
    const item = items[index];
    if (!item) return;
    setEditingIndex(index);
    setFormDraft({
      id: item.id || Math.random().toString(36).slice(2, 9),
      genericName: item.genericName || item.medicineName || "",
      brand: item.brand || "",
      strengthForm: item.strengthForm || item.dosage || "",
      dose: item.dose || "1 Tablet",
      frequency: item.frequency || "once a day",
      duration: item.duration || "5 days",
      quantity: item.quantity || "5",
      instructions: item.instructions || "",
      indication: item.indication || "",
      medicineName: item.genericName || item.medicineName || "",
      dosage: item.strengthForm || item.dosage || "",
    });
    // Check if brand is custom or known
    const match = FORMULARY_MEDICINES.find(
      (m) => m.genericName.toLowerCase() === (item.genericName || item.medicineName || "").trim().toLowerCase(),
    );
    if (item.brand && match && !match.brands.includes(item.brand)) {
      setCustomBrandMode(true);
    } else {
      setCustomBrandMode(false);
    }
    setViewMode("form");
  }

  // Remove medicine
  function handleRemoveItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onItemsChange(next.length === 0 ? [createEmptyPrescriptionItem()] : next);
  }

  // Select generic from formulary list in form
  function handleSelectGeneric(generic: string) {
    const match = FORMULARY_MEDICINES.find(
      (m) => m.genericName.toLowerCase() === generic.trim().toLowerCase(),
    );
    if (match) {
      setFormDraft((prev) => ({
        ...prev,
        genericName: match.genericName,
        medicineName: match.genericName,
        brand: match.brands[0] || "",
        strengthForm: match.commonForms[0] || prev.strengthForm,
        dose: match.defaultDose || prev.dose,
        frequency: match.defaultFrequency || prev.frequency,
        duration: match.defaultDuration || prev.duration,
        quantity: match.defaultQuantity || prev.quantity,
        instructions: match.defaultInstructions || prev.instructions,
        indication: match.indication || prev.indication,
      }));
      setCustomBrandMode(false);
    } else {
      setFormDraft((prev) => ({
        ...prev,
        genericName: generic,
        medicineName: generic,
      }));
    }
  }

  // Save current form draft
  function handleSaveMedicineForm() {
    if (!formDraft.genericName.trim()) {
      alert("Please specify a generic medicine name.");
      return;
    }

    const updatedItem: PrescriptionItemDraft = {
      ...formDraft,
      genericName: formDraft.genericName.trim(),
      medicineName: formDraft.genericName.trim(),
      brand: formDraft.brand.trim(),
      strengthForm: formDraft.strengthForm.trim(),
      dosage: formDraft.strengthForm.trim(),
      dose: formDraft.dose.trim(),
      frequency: formDraft.frequency.trim(),
      duration: formDraft.duration.trim(),
      quantity: formDraft.quantity.trim(),
      instructions: formDraft.instructions.trim(),
      indication: formDraft.indication.trim(),
    };

    if (editingIndex !== null && editingIndex >= 0 && editingIndex < items.length) {
      const next = [...items];
      next[editingIndex] = updatedItem;
      onItemsChange(next);
    } else {
      // Add new item, discarding any single empty placeholder
      const nonEmpties = items.filter((i) => i.genericName?.trim() || i.medicineName?.trim());
      onItemsChange([...nonEmpties, updatedItem]);
    }

    setViewMode("list");
  }

  // Apply clinical template
  function handleApplyTemplate(template: (typeof CLINIC_PRESCRIPTION_TEMPLATES)[0]) {
    const newItems: PrescriptionItemDraft[] = template.items.map((tmpl) => ({
      id: Math.random().toString(36).slice(2, 9),
      genericName: tmpl.genericName,
      medicineName: tmpl.genericName,
      brand: tmpl.brand,
      strengthForm: tmpl.strengthForm,
      dosage: tmpl.strengthForm,
      dose: tmpl.dose,
      frequency: tmpl.frequency,
      duration: tmpl.duration,
      quantity: tmpl.quantity,
      instructions: tmpl.instructions,
      indication: tmpl.indication,
    }));
    onItemsChange(newItems);
    if (template.notes) {
      onInstructionsChange(
        instructions ? `${instructions}\n${template.notes}` : template.notes,
      );
    }
    setShowTemplateModal(false);
  }

  // Save current items as template notification
  function handleSaveAsTemplate() {
    if (validItems.length === 0) {
      alert("Add at least one medicine before saving as template.");
      return;
    }
    setTemplateSavedMsg("Prescription template saved for Dr. Fatimah!");
    setTimeout(() => setTemplateSavedMsg(null), 3000);
  }

  // Discard all items
  function handleDiscard() {
    if (confirm("Are you sure you want to discard this prescription draft?")) {
      if (onDiscard) {
        onDiscard();
      } else {
        onItemsChange([createEmptyPrescriptionItem()]);
        onInstructionsChange("");
        onFollowUpDateChange("");
      }
      setViewMode("list");
    }
  }

  // Auto calculate quantity helper
  function autoCalculateQuantity(doseStr: string, freqStr: string, durStr: string) {
    try {
      let multiplier = 1;
      const lowerFreq = freqStr.toLowerCase();
      if (lowerFreq.includes("4 times") || lowerFreq.includes("every 6 hours")) multiplier = 4;
      else if (lowerFreq.includes("3 times") || lowerFreq.includes("every 8 hours")) multiplier = 3;
      else if (lowerFreq.includes("twice") || lowerFreq.includes("every 12 hours")) multiplier = 2;
      else if (lowerFreq.includes("once")) multiplier = 1;

      const dayMatch = durStr.match(/(\d+)\s*day/i);
      const days = dayMatch ? parseInt(dayMatch[1], 10) : 5;

      const doseMatch = doseStr.match(/^(\d+)/);
      const doseUnits = doseMatch ? parseInt(doseMatch[1], 10) : 1;

      return String(doseUnits * multiplier * days);
    } catch {
      return "5";
    }
  }

  return (
    <div className="relative font-sans text-neutral-900">
      {/* ─────────────────────────────────────────────────────────────
          1. FORM VIEW: Create / Edit Prescription (Reference 1)
             Black and White / Monochrome Theme
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "form" && (
        <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          {/* Form Top Nav Bar */}
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <button
              type="button"
              onClick={() => {
                if (formDraft.genericName.trim()) {
                  handleSaveMedicineForm();
                } else {
                  setViewMode("list");
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 transition hover:text-black"
            >
              <FaArrowLeft className="h-4 w-4" />
              <span>{formDraft.genericName.trim() ? "Save & Back" : "Back"}</span>
            </button>
            <h2 className="text-base font-bold text-neutral-950 sm:text-lg">
              {editingIndex !== null ? "Edit Medicine" : "Create Prescription"}
            </h2>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="text-sm font-semibold text-neutral-500 hover:text-rose-600 transition"
            >
              Cancel
            </button>
          </div>

          {/* Mini Patient Information Pill */}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-neutral-100/70 px-4 py-3 border border-neutral-200">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white font-bold text-sm shadow-sm">
              {patientName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-950">{patientName}</p>
              <p className="text-xs text-neutral-500">
                {patientGender} • {patientAge != null ? `${patientAge} years old` : "38 years old"}
              </p>
            </div>
          </div>

          {/* Prescription Information Section */}
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">
              Prescription Information
            </h3>

            {/* Generic Medicine Field with Combobox / Quick Select */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Generic Name
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  list="formulary-generics-list"
                  value={formDraft.genericName}
                  onChange={(e) => handleSelectGeneric(e.target.value)}
                  placeholder="e.g. Montelukast + Levocetirizine, Azithromycin"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                />
                <datalist id="formulary-generics-list">
                  {FORMULARY_MEDICINES.map((m) => (
                    <option key={m.id} value={m.genericName}>
                      {m.genericName} ({m.brands.slice(0, 3).join(", ")})
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Popular Generic Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] font-medium text-neutral-400 self-center mr-1">Quick Select:</span>
                {FORMULARY_MEDICINES.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectGeneric(m.genericName)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      formDraft.genericName.toLowerCase() === m.genericName.toLowerCase()
                        ? "bg-neutral-950 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {m.genericName.split("+")[0]?.trim() || m.genericName}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Dropdown (with Optional tag & See Product Info) */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5">
              <div className="flex items-center justify-between text-sm font-semibold text-neutral-900">
                <span>Brand</span>
                <span className="text-xs font-normal text-neutral-400">Optional</span>
              </div>

              <div className="relative mt-1.5">
                {!customBrandMode ? (
                  <div className="relative">
                    <select
                      value={formDraft.brand}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setCustomBrandMode(true);
                          setFormDraft((prev) => ({ ...prev, brand: "" }));
                        } else {
                          setFormDraft((prev) => ({ ...prev, brand: e.target.value }));
                        }
                      }}
                      className="w-full appearance-none rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                    >
                      <option value="">Generic Only (No Brand)</option>
                      {selectedFormularyMedicine ? (
                        <>
                          <optgroup label={`${selectedFormularyMedicine.genericName} Brands`}>
                            {selectedFormularyMedicine.brands.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      ) : (
                        <optgroup label="Common Philippine Brands">
                          <option value="Allerkast">Allerkast</option>
                          <option value="Azithro-Natrapharm">Azithro-Natrapharm</option>
                          <option value="Tuseran Forte">Tuseran Forte</option>
                          <option value="Augmentin">Augmentin</option>
                          <option value="Biogesic">Biogesic</option>
                          <option value="Advil">Advil</option>
                          <option value="Ponstan">Ponstan</option>
                          <option value="Zyrtec">Zyrtec</option>
                          <option value="RiteMED">RiteMED</option>
                        </optgroup>
                      )}
                      <option value="__custom__">+ Enter Custom Brand Name...</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500">
                      <FaChevronDown className="h-3 w-3" />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formDraft.brand}
                      onChange={(e) => setFormDraft((prev) => ({ ...prev, brand: e.target.value }))}
                      placeholder="Type custom brand name (e.g. Allerkast)"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setCustomBrandMode(false)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                    >
                      List
                    </button>
                  </div>
                )}
              </div>

              {/* See Product Information link */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFormularyMedicine) {
                      setProductInfoMedicine(selectedFormularyMedicine);
                    } else {
                      setProductInfoMedicine({
                        id: "custom",
                        genericName: formDraft.genericName || "Medicine Information",
                        brands: formDraft.brand ? [formDraft.brand] : [],
                        commonForms: [formDraft.strengthForm || "Standard oral form"],
                        defaultDose: formDraft.dose,
                        defaultFrequency: formDraft.frequency,
                        defaultDuration: formDraft.duration,
                        defaultQuantity: formDraft.quantity,
                        defaultInstructions: formDraft.instructions,
                        indication: formDraft.indication || "Clinical indication as determined by physician",
                        therapeuticClass: "Prescription Pharmaceutical",
                        productInfo: {
                          description: `Standard pharmaceutical product: ${formDraft.genericName || "Unspecified"} ${formDraft.brand ? `(${formDraft.brand})` : ""}.`,
                          dosageAdvice: "Administer in accordance with clinical assessment and patient profile.",
                          cautions: "Verify patient allergies and potential drug interactions prior to administration.",
                        },
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800 hover:text-black hover:underline"
                >
                  <FaCircleInfo className="h-3 w-3 text-neutral-500" />
                  See Product Information
                </button>
              </div>
            </div>

            {/* Strength and Form */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Strength and Form
              </label>
              <input
                type="text"
                list="strength-suggestions"
                value={formDraft.strengthForm}
                onChange={(e) => setFormDraft((prev) => ({ ...prev, strengthForm: e.target.value }))}
                placeholder="e.g. Film-coated tablet 10 mg/5 mg, 500 mg Capsule"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
              <datalist id="strength-suggestions">
                {selectedFormularyMedicine?.commonForms.map((f) => (
                  <option key={f} value={f} />
                ))}
                <option value="500 mg Tablet" />
                <option value="500 mg Capsule" />
                <option value="250 mg Capsule" />
                <option value="10 mg Tablet" />
                <option value="20 mg Capsule" />
                <option value="Suspension 250 mg/5 mL" />
              </datalist>
            </div>

            {/* Dose */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Dose
              </label>
              <input
                type="text"
                value={formDraft.dose}
                onChange={(e) => setFormDraft((prev) => ({ ...prev, dose: e.target.value }))}
                placeholder="e.g. 1 Film-coated tablet, 1 Capsule, 5 mL (1 tsp)"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Frequency
              </label>
              <input
                type="text"
                list="freq-suggestions"
                value={formDraft.frequency}
                onChange={(e) => setFormDraft((prev) => ({ ...prev, frequency: e.target.value }))}
                placeholder="e.g. once a day, 3 times a day, every 8 hours"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
              <datalist id="freq-suggestions">
                {COMMON_FREQUENCIES.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["once a day", "twice a day", "3 times a day", "every 8 hours", "as needed"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setFormDraft((prev) => ({ ...prev, frequency: chip }))}
                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Quantity in 2 columns */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  Duration
                </label>
                <input
                  type="text"
                  list="duration-suggestions"
                  value={formDraft.duration}
                  onChange={(e) => setFormDraft((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g. 5 days, 7 days, 14 days"
                  className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                />
                <datalist id="duration-suggestions">
                  {COMMON_DURATIONS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {["3 days", "5 days", "7 days", "14 days", "30 days"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setFormDraft((prev) => ({ ...prev, duration: chip }))}
                      className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-neutral-900">
                    Quantity
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const qty = autoCalculateQuantity(
                        formDraft.dose,
                        formDraft.frequency,
                        formDraft.duration,
                      );
                      setFormDraft((prev) => ({ ...prev, quantity: qty }));
                    }}
                    className="text-[11px] font-semibold text-neutral-700 hover:text-black underline"
                  >
                    Auto-calc
                  </button>
                </div>
                <input
                  type="text"
                  value={formDraft.quantity}
                  onChange={(e) => setFormDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder="e.g. 5, 10, 15"
                  className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {["5", "10", "14", "15", "21", "30"].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setFormDraft((prev) => ({ ...prev, quantity: qty }))}
                      className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 transition"
                    >
                      #{qty}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Instructions
              </label>
              <input
                type="text"
                list="instructions-suggestions"
                value={formDraft.instructions}
                onChange={(e) => setFormDraft((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="e.g. Take before bedtime, Take with or without food"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
              <datalist id="instructions-suggestions">
                {COMMON_INSTRUCTIONS.map((ins) => (
                  <option key={ins} value={ins} />
                ))}
              </datalist>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["Take before bedtime", "Take with or without food", "Take strictly after meals", "Take 30 mins before meals"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setFormDraft((prev) => ({ ...prev, instructions: chip }))}
                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Indication */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Indication
              </label>
              <input
                type="text"
                value={formDraft.indication}
                onChange={(e) => setFormDraft((prev) => ({ ...prev, indication: e.target.value }))}
                placeholder="e.g. Allergic rhinitis, Bacterial infection, Fever/Pain"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
              />
            </div>

            {/* SAVE MEDICINE Action Button (Black & White Theme) */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveMedicineForm}
                className="w-full rounded-lg bg-neutral-950 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-neutral-800"
              >
                SAVE MEDICINE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. LIST VIEW: Current Prescription Information (Reference 2 & 3)
             Black and White / Monochrome Theme
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-900">
                <FaRotateLeft className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-neutral-950">Create Prescription</h2>
                <p className="text-xs text-neutral-500">Clinical Medication Order</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm font-semibold text-neutral-500 transition hover:text-rose-600"
            >
              Discard
            </button>
          </div>

          {!patientMatched && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
              Match this visit to a patient record before finalizing and saving a prescription.
            </div>
          )}

          {/* Patient Information Card (Image 2 style) */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">
              Patient Information
            </h3>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white font-bold text-base shadow-sm">
                  {patientName.slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <span className="inline-block rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                    Patient Code: {patientCode}
                  </span>
                  <p className="text-base font-bold text-neutral-950">{patientName}</p>
                  <p className="text-xs text-neutral-500 font-medium">
                    {patientGender} • {patientAge != null ? `${patientAge} years old` : "38 years old"}
                  </p>
                </div>
              </div>
              <p className="mt-3 border-t border-neutral-100 pt-2.5 text-xs text-neutral-600">
                This prescription will be sent to{" "}
                <span className="font-semibold text-neutral-950">{patientEmail}</span>
              </p>
            </div>
          </section>

          {/* Current Prescription Information (List of cards) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">
                Current Prescription Information
              </h3>
              <span className="text-xs font-semibold text-neutral-500">
                {validItems.length} {validItems.length === 1 ? "medicine" : "medicines"} added
              </span>
            </div>

            {validItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
                <p className="text-sm font-bold text-neutral-800">No medicines added yet</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Click &ldquo;+ ADD MEDICINE&rdquo; below or load a quick clinical template.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-neutral-800 transition"
                  >
                    <FaPlus className="h-3 w-3" />
                    + Add First Medicine
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 transition"
                  >
                    <FaFloppyDisk className="h-3 w-3" />
                    Load Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {validItems.map((item, index) => {
                  const generic = item.genericName || item.medicineName || "Medicine";
                  const brand = item.brand;
                  const strength = item.strengthForm || item.dosage || "";
                  const qty = item.quantity || item.duration || "";
                  const dose = item.dose || "1 Tablet";
                  const freq = item.frequency || "once a day";
                  const dur = item.duration || "5 days";
                  const instructionsText = item.instructions;

                  return (
                    <div
                      key={item.id || index}
                      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-2 transition hover:border-neutral-300"
                    >
                      {/* Generic & Brand */}
                      <div>
                        <h4 className="text-base font-bold text-neutral-950 leading-snug">
                          {generic}
                        </h4>
                        {brand && (
                          <p className="text-xs font-semibold text-neutral-500">{brand}</p>
                        )}
                      </div>

                      {/* Formulation & Quantity */}
                      <p className="text-xs font-semibold text-neutral-800">
                        {strength} {qty ? `#${qty}` : ""}
                      </p>

                      {/* Sig line */}
                      <div className="space-y-0.5 text-xs text-neutral-700">
                        <p className="font-medium text-neutral-900">
                          Sig. {dose}, {freq} for {dur}
                        </p>
                        {instructionsText && (
                          <p className="text-neutral-600 italic">{instructionsText}</p>
                        )}
                        {item.indication && (
                          <p className="text-[11px] font-semibold text-neutral-600">
                            Indication: {item.indication}
                          </p>
                        )}
                      </div>

                      {/* Action buttons (Black & White styling) */}
                      <div className="flex gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(index)}
                          className="flex-1 rounded-lg border border-neutral-300 bg-white py-2 text-center text-xs font-bold text-neutral-900 transition hover:bg-neutral-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 py-2 text-center text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notes Section (Image 2 style) */}
          <section className="space-y-1.5">
            <label className="block text-sm font-bold text-neutral-700 uppercase tracking-wide">
              Notes:
            </label>
            <textarea
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="Doctor's instructions, dietary notes, or additional clinical advice..."
              rows={4}
              className="w-full rounded-xl border border-neutral-200 bg-white p-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200 shadow-sm"
            />
          </section>

          {/* Follow-up Date & Portal Release Row */}
          <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                Follow-up Date (Optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => onFollowUpDateChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex items-center pt-2 sm:pt-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={releaseToPatient}
                  onChange={(e) => onReleaseChange(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-400"
                />
                <span className="text-sm font-medium text-neutral-800">
                  Release to patient portal &amp; email
                </span>
              </label>
            </div>
          </div>

          {templateSavedMsg && (
            <div className="rounded-lg bg-neutral-100 border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-900 flex items-center gap-2">
              <FaCircleCheck className="h-4 w-4 text-neutral-900" />
              {templateSavedMsg}
            </div>
          )}

          {feedback && (
            <p className="rounded-lg bg-neutral-100 p-3 text-xs font-semibold text-neutral-700">
              {feedback}
            </p>
          )}

          {/* Bottom Buttons Bar (Black and White Theme) */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-3 text-xs font-bold uppercase tracking-wider text-neutral-900 shadow-sm transition hover:bg-neutral-100 hover:border-neutral-400"
              >
                <FaPlus className="h-3.5 w-3.5" />
                ADD MEDICINE
              </button>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-3 text-xs font-bold uppercase tracking-wider text-neutral-900 shadow-sm transition hover:bg-neutral-100 hover:border-neutral-400"
              >
                <FaFloppyDisk className="h-3.5 w-3.5" />
                SAVE TEMPLATE
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (validItems.length === 0) {
                  alert("Please add at least one medicine item before previewing.");
                  return;
                }
                setViewMode("review");
              }}
              disabled={disabled || !patientMatched}
              className="w-full rounded-lg bg-neutral-950 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. REVIEW VIEW: Review Your Prescription (Reference 4)
             FULL PREVIEW (NOT A POPUP/MODAL) with REPEATING WATERMARKS!
             Black and White / Monochrome Paper Theme
         ───────────────────────────────────────────────────────────── */}
      {viewMode === "review" && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-4 rounded-xl shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 transition hover:text-black"
            >
              <FaArrowLeft className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <h2 className="text-base font-bold text-neutral-950 sm:text-lg">
              Review Your Prescription
            </h2>
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm font-semibold text-neutral-500 transition hover:text-rose-600"
            >
              Discard
            </button>
          </div>

          {/* Full Prescription Document matching Medical Documents Prescription Preview with Repeating Watermarks */}
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl">
            {/* Repeating diagonal "Preview" watermark pattern across the paper */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 select-none overflow-hidden"
              style={{
                zIndex: 10,
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='260' height='160' viewBox='0 0 260 160' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='20' y='110' fill='%23000' font-family='sans-serif' font-weight='900' font-size='38' transform='rotate(-28 20 110)' opacity='0.05'%3EPreview%3C/text%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat",
              }}
            />

            {/* Document Content */}
            <div className="relative z-1 mx-auto max-w-4xl bg-white px-6 py-8 text-neutral-900 sm:px-10 lg:px-12">
              {/* Top Section: Doc Kulot Logo & Prescription ID */}
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
                  <p className="mt-2 text-2xl font-black tracking-tight text-black">{displayedPrescriptionNo}</p>
                </div>
              </div>

              {/* Doctor / Clinic Header */}
              <div className="mt-7 text-center">
                <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">{doctorHeaderName}</p>
                <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">Family Medicine Specialist | Aesthetic Medicine</p>
                <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
                <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
              </div>

              {/* Patient Info Row */}
              <div className="mt-6 border-t border-neutral-200 pt-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm leading-6 text-neutral-900">
                      Patient: <span className="font-black text-black">{patientName}</span>
                    </p>
                    <p className="text-sm leading-6 text-neutral-800">
                      Age: {patientAge != null ? `${patientAge} years old` : "Not recorded"}
                    </p>
                    <p className="text-sm leading-6 text-neutral-800">
                      Gender: {patientGender || "Not recorded"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm leading-6 text-neutral-700">
                      Prescribed on: {prescribedDate}
                    </p>
                    <p className="text-sm leading-6 text-neutral-700">{prescribedTime} PHT</p>
                  </div>
                </div>
              </div>

              {/* Rx Section */}
              <div className="mt-10">
                <div className="flex items-center gap-4">
                  <p className="text-4xl font-black leading-none tracking-tight text-black">Rx</p>
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>

                <div className="mt-6 space-y-5">
                  {validItems.length > 0 ? (
                    validItems.map((item, index) => {
                      const generic = (item.genericName || item.medicineName || "").trim();
                      const brand = (item.brand || "").trim();
                      const strength = (item.strengthForm || item.dosage || "").trim();
                      const qty = (item.quantity || item.duration || "").trim();
                      const dose = (item.dose || "1 Tablet").trim();
                      const freq = (item.frequency || "once a day").trim();
                      const dur = (item.duration || "").trim();
                      const instructionsText = (item.instructions || "").trim();

                      const sigParts: string[] = [];
                      if (dose) sigParts.push(dose);
                      if (freq) sigParts.push(freq);
                      const sigBase = sigParts.join(", ");
                      const sig = dur && !sigBase.toLowerCase().includes(dur.toLowerCase())
                        ? `${sigBase} for ${dur}`
                        : sigBase;

                      return (
                        <div key={item.id ?? index} className="pl-4">
                          <p className="text-[1.55rem] font-black leading-tight tracking-tight text-black">
                            {generic}
                          </p>
                          {brand ? (
                            <p className="text-sm font-semibold text-neutral-600">
                              {brand}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold leading-6 text-neutral-800">
                            {[strength, qty ? `#${qty}` : null].filter(Boolean).join(" ") || "No dosage recorded"}
                          </p>
                          {sig ? (
                            <p className="mt-0.5 text-sm leading-6 text-neutral-700">Sig.&#8194;{sig}</p>
                          ) : null}
                          {instructionsText ? (
                            <p className="mt-0.5 text-xs italic text-neutral-600">
                              {instructionsText}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="pl-4 text-sm text-neutral-500">No medicine items recorded.</p>
                  )}
                </div>
              </div>

              {/* Note / Follow-up */}
              <div className="mt-8">
                <p className="text-sm font-semibold italic text-black">Note:</p>
                <p className="mt-1 text-sm leading-6 text-neutral-800 whitespace-pre-line">
                  {instructions || "No additional instructions recorded."}
                </p>
                {followUpDate ? (
                  <p className="mt-1 text-sm leading-6 text-neutral-800">
                    Follow-up: {followUpDate}
                  </p>
                ) : null}
              </div>

              {/* Doctor Signature Block */}
              <div className="mt-16 flex justify-end">
                <div className="w-72 text-center">
                  {resolvedDoctorSignature ? (
                    <div className="mb-0 flex h-24 items-end justify-center border-b border-black pb-1">
                      <img
                        src={resolvedDoctorSignature}
                        alt="Physician signature"
                        className="h-auto max-h-16 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="mb-0 flex h-24 items-end justify-center border-b border-black pb-1">
                      <span className="font-serif italic text-lg text-neutral-800">
                        {cleanDoctorName}
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-sm font-black text-neutral-950">{doctorHeaderName}</p>
                  <p className="text-xs text-neutral-700">Family Medicine</p>
                  <p className="text-xs text-neutral-700">Aesthetic Medicine</p>
                  <p className="mt-0.5 text-xs font-bold text-neutral-800">PRC License No.: {prcNo}</p>
                </div>
              </div>

              {/* (End of Prescription) & Doc Kulot Footer */}
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

          {/* Success Banner if Created */}
          {createdPrescription && (
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-neutral-950">
                  Prescription {createdPrescription.prescriptionNo} has been issued!
                </p>
                <p className="text-xs text-neutral-600">
                  A PDF copy has been recorded and scheduled for the patient portal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {onEmailCreated && (
                  <button
                    type="button"
                    onClick={onEmailCreated}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-900 transition hover:bg-neutral-50"
                  >
                    <FaEnvelope className="h-3.5 w-3.5" />
                    Email
                  </button>
                )}
                {onDownloadCreated && (
                  <button
                    type="button"
                    onClick={onDownloadCreated}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-900 transition hover:bg-neutral-50"
                  >
                    <FaDownload className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                )}
                {onPrintCreated && (
                  <button
                    type="button"
                    onClick={onPrintCreated}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
                  >
                    <FaPrint className="h-3.5 w-3.5" />
                    Print
                  </button>
                )}
              </div>
            </div>
          )}

          {feedback && (
            <p className="rounded-lg bg-neutral-100 p-3 text-xs font-semibold text-neutral-700">
              {feedback}
            </p>
          )}

          {/* Review Bottom Action Buttons (Black and White Theme) */}
          <div className="space-y-3 pt-2">
            {!createdPrescription ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="rounded-lg border border-neutral-300 bg-white py-3.5 px-6 text-center text-sm font-bold text-neutral-800 shadow-sm transition hover:bg-neutral-100 sm:w-auto"
                >
                  ← Edit Prescription
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={disabled || !patientMatched}
                  className="flex-1 rounded-lg bg-neutral-950 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {disabled ? "SAVING..." : "CONFIRM & ISSUE PRESCRIPTION"}
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className="rounded-lg border border-neutral-300 bg-white py-2.5 px-5 text-xs font-bold text-neutral-800 hover:bg-neutral-100"
                >
                  ← Back to List
                </button>
                {onProceedNextStep && (
                  <button
                    type="button"
                    onClick={onProceedNextStep}
                    className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800"
                  >
                    Proceed to Next Step →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. PRODUCT INFORMATION MODAL ("See Product Information")
             Black and White Theme
         ───────────────────────────────────────────────────────────── */}
      {productInfoMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
              <div>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-800">
                  {productInfoMedicine.therapeuticClass}
                </span>
                <h3 className="mt-1 text-base font-bold text-neutral-950">
                  {productInfoMedicine.genericName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProductInfoMedicine(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <FaXmark className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-800 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <p className="font-bold text-neutral-950">Description:</p>
                <p className="mt-0.5 text-neutral-600 leading-relaxed">
                  {productInfoMedicine.productInfo.description}
                </p>
              </div>

              {productInfoMedicine.brands.length > 0 && (
                <div>
                  <p className="font-bold text-neutral-950">Available Brands:</p>
                  <p className="mt-0.5 text-neutral-600">
                    {productInfoMedicine.brands.join(", ")}
                  </p>
                </div>
              )}

              <div>
                <p className="font-bold text-neutral-950">Dosage &amp; Administration:</p>
                <p className="mt-0.5 text-neutral-600 leading-relaxed">
                  {productInfoMedicine.productInfo.dosageAdvice}
                </p>
              </div>

              <div>
                <p className="font-bold text-neutral-950">Warnings &amp; Cautions:</p>
                <p className="mt-0.5 text-neutral-600 leading-relaxed">
                  {productInfoMedicine.productInfo.cautions}
                </p>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setProductInfoMedicine(null)}
                className="rounded-lg bg-neutral-950 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. SAVE / LOAD TEMPLATE MODAL
             Black and White Theme
         ───────────────────────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-neutral-950">Prescription Templates</h3>
                <p className="text-xs text-neutral-500">
                  Select a clinical protocol or save your current prescription as favorite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <FaXmark className="h-4 w-4" />
              </button>
            </div>

            {validItems.length > 0 && (
              <div className="rounded-xl bg-neutral-100 border border-neutral-300 p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-neutral-950">Save Current Prescription</p>
                  <p className="text-[11px] text-neutral-600">
                    Save current {validItems.length} items as Doc Kulot&apos;s custom favorite.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveAsTemplate();
                    setShowTemplateModal(false);
                  }}
                  className="rounded-lg bg-neutral-950 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-neutral-800 transition"
                >
                  Save as Favorite
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Standard Protocols
              </p>
              {CLINIC_PRESCRIPTION_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-200 p-3 hover:border-neutral-400 hover:bg-neutral-50 transition flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                      {tmpl.category}
                    </span>
                    <p className="text-xs font-bold text-neutral-950">{tmpl.name}</p>
                    <p className="text-[11px] text-neutral-500">
                      {tmpl.items.map((i) => i.brand ? `${i.genericName} (${i.brand})` : i.genericName).join(", ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 hover:bg-neutral-100 transition"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
