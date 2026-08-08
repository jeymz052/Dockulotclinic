"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  FaDownload,
  FaFloppyDisk,
  FaEye,
  FaPenToSquare,
  FaPlus,
  FaPaperPlane,
  FaPrint,
  FaPrescriptionBottleMedical,
  FaTrash,
  FaXmark,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type Patient = { id: string; profiles?: { full_name?: string; email?: string } | null };
type Doctor = { id: string; name: string };
type DiagnosisRecord = {
  id: string;
  diagnosis_text: string;
  treatment_plan: string | null;
  follow_up_date: string | null;
  visible_to_patient: boolean;
};
type Prescription = {
  id: string;
  prescription_no: string;
  patient_id: string;
  doctor_id: string;
  general_instructions: string | null;
  follow_up_date: string | null;
  released_to_patient: boolean;
  created_at: string;
  prescription_items?: Array<{ id?: string; medicine_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; sort_order?: number | null }>;
  diagnoses?: DiagnosisRecord | null;
  doctors?: { profiles?: { full_name?: string | null } | null } | null;
  patients?: { profiles?: { full_name?: string; email?: string } | null } | null;
};

type PrescriptionItemDraft = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

const EMPTY_ITEM: PrescriptionItemDraft = {
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export default function PrescriptionsPage() {
  const { accessToken, role } = useRole();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    doctor_id: "",
    diagnosis_text: "",
    treatment_plan: "",
    general_instructions: "",
    follow_up_date: "",
    released_to_patient: true,
  });
  const [items, setItems] = useState<PrescriptionItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const canManage = role === "DOCTOR" || role === "SUPER_ADMIN" || role === "SECRETARY";

  const headers = useMemo(() => ({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [accessToken]);

  async function load() {
    if (!accessToken) return;
    const prescriptionRes = await fetch("/api/v2/prescriptions", { headers, cache: "no-store" });
    if (prescriptionRes.ok) {
      const rows = ((await prescriptionRes.json()).prescriptions ?? []) as Prescription[];
      setPrescriptions(rows.map((row) => ({
        ...row,
        prescription_items: [...(row.prescription_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      })));
      setSelectedPreviewId((current) => current ?? rows[0]?.id ?? null);
    }
    if (canManage) {
      const [patientsRes, doctorsRes] = await Promise.all([
        fetch("/api/v2/patients", { headers, cache: "no-store" }),
        fetch("/api/v2/doctors", { headers, cache: "no-store" }),
      ]);
      if (patientsRes.ok) setPatients((await patientsRes.json()).patients ?? []);
      if (doctorsRes.ok) setDoctors((await doctorsRes.json()).doctors ?? []);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPrescription =
    prescriptions.find((item) => item.id === selectedPreviewId) ?? prescriptions[0] ?? null;

  function resetEditor() {
    setEditingId(null);
    setForm((s) => ({
      ...s,
      patient_id: "",
      doctor_id: "",
      diagnosis_text: "",
      treatment_plan: "",
      general_instructions: "",
      follow_up_date: "",
      released_to_patient: true,
    }));
    setItems([{ ...EMPTY_ITEM }]);
  }

  function selectPreview(item: Prescription) {
    setSelectedPreviewId(item.id);
  }

  function editPrescription(item: Prescription) {
    setEditingId(item.id);
    setForm({
      patient_id: item.patient_id,
      doctor_id: item.doctor_id,
      diagnosis_text: item.diagnoses?.diagnosis_text ?? "",
      treatment_plan: item.diagnoses?.treatment_plan ?? "",
      general_instructions: item.general_instructions ?? "",
      follow_up_date: item.follow_up_date ?? item.diagnoses?.follow_up_date ?? "",
      released_to_patient: item.released_to_patient,
    });
    setItems((item.prescription_items?.length ? item.prescription_items : [{ ...EMPTY_ITEM }]).map((rx) => ({
      medicine_name: rx.medicine_name,
      dosage: rx.dosage ?? "",
      frequency: rx.frequency ?? "",
      duration: rx.duration ?? "",
      instructions: rx.instructions ?? "",
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateItem(index: number, field: keyof PrescriptionItemDraft, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItemRow() {
    setItems((current) => [...current, { ...EMPTY_ITEM }]);
  }

  function removeItemRow(index: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  async function submitPrescription(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const cleanedItems = items
      .map((item) => ({
        medicine_name: item.medicine_name.trim(),
        dosage: item.dosage.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        instructions: item.instructions.trim(),
      }))
      .filter((item) => item.medicine_name);

    if (cleanedItems.length === 0) {
      setFeedback("Add at least one medicine item before saving the prescription.");
      return;
    }

    const endpoint = editingId ? `/api/v2/prescriptions/${editingId}` : "/api/v2/prescriptions";
    const res = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers,
      body: JSON.stringify({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        diagnosis_text: form.diagnosis_text,
        treatment_plan: form.treatment_plan,
        general_instructions: form.general_instructions,
        follow_up_date: form.follow_up_date || null,
        released_to_patient: form.released_to_patient,
        items: cleanedItems,
      }),
    });
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to save prescription");
      return;
    }
    setFeedback(editingId ? "Prescription history updated." : "Prescription created and saved to history.");
    resetEditor();
    await load();
  }

  async function toggleRelease(item: Prescription) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ released_to_patient: !item.released_to_patient }),
    });
    setFeedback(res.ok
      ? (!item.released_to_patient ? "Prescription sent to the patient portal." : "Prescription hidden from the patient portal.")
      : "Unable to update patient portal visibility.");
    await load();
  }

  async function downloadPdf(item: Prescription) {
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

  async function emailPrescription(item: Prescription) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      setFeedback("Unable to email prescription.");
      return;
    }
    setFeedback("Prescription emailed to the patient.");
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
    const revoke = () => window.URL.revokeObjectURL(url);
    printWindow.addEventListener("load", () => {
      printWindow.print();
      setTimeout(revoke, 5_000);
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-neutral-100 bg-linear-to-br from-neutral-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-700">Prescription & Diagnosis</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Prescription records</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          Create prescriptions, release them to patients, and preview the official clinic format before it is downloaded, printed, or emailed.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <CapabilityCard icon={<FaPrescriptionBottleMedical />} title="Clinic format" text="Official header, patient details, medicine list, signature line, and follow-up." />
        <CapabilityCard icon={<FaEye />} title="Patient view" text="Released prescriptions appear in the portal in the same format." />
        <CapabilityCard icon={<FaDownload />} title="PDF + Email" text="Download a PDF copy, print it, or email it directly to the patient." />
      </div>

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-700">Preview</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-black">Prescription format</h2>
            <p className="mt-2 text-sm text-neutral-600">This is the live clinic layout used for PDF and print output.</p>
          </div>
          {selectedPrescription ? (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button onClick={() => void downloadPdf(selectedPrescription)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700">
                <FaDownload /> Download PDF
              </button>
              {canManage ? (
                <button onClick={() => void emailPrescription(selectedPrescription)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700">
                  <FaPaperPlane /> Email to patient
                </button>
              ) : null}
              <button onClick={() => void printPrescription(selectedPrescription)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
                <FaPrint /> Print
              </button>
            </div>
          ) : null}
        </div>

        {selectedPrescription ? (
          <PrescriptionSheet prescription={selectedPrescription} />
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
            No prescription available to preview yet.
          </div>
        )}
      </section>

      {canManage ? (
        <form onSubmit={submitPrescription} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-black">{editingId ? "Edit prescription" : "Create prescription"}</h2>
              <p className="mt-1 text-xs text-neutral-500">Saved records remain available in prescription history.</p>
            </div>
            {editingId ? (
              <button type="button" onClick={resetEditor} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600">
                <FaXmark className="h-3 w-3" />
                Cancel edit
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select required disabled={Boolean(editingId)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:bg-neutral-100" value={form.patient_id} onChange={(e) => setForm((s) => ({ ...s, patient_id: e.target.value }))}>
              <option value="">Select patient</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.profiles?.full_name ?? p.id}</option>)}
            </select>
            <select required disabled={Boolean(editingId)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 disabled:bg-neutral-100" value={form.doctor_id} onChange={(e) => setForm((s) => ({ ...s, doctor_id: e.target.value }))}>
              <option value="">Select doctor</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input required className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100" placeholder="Diagnosis" value={form.diagnosis_text} onChange={(e) => setForm((s) => ({ ...s, diagnosis_text: e.target.value }))} />
            <input className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100" placeholder="Treatment plan" value={form.treatment_plan} onChange={(e) => setForm((s) => ({ ...s, treatment_plan: e.target.value }))} />
            <input type="date" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100" value={form.follow_up_date} onChange={(e) => setForm((s) => ({ ...s, follow_up_date: e.target.value }))} />
            <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold">
              <input type="checkbox" checked={form.released_to_patient} onChange={(e) => setForm((s) => ({ ...s, released_to_patient: e.target.checked }))} />
              Send to patient portal
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-black">Medicine Items</p>
                <p className="text-xs text-neutral-500">Add one or more medicines with dosage and usage instructions.</p>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
              >
                <FaPlus className="h-3 w-3" />
                Add medicine
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {items.map((item, index) => (
                <div key={`item-${index}`} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Medicine #{index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      disabled={items.length === 1}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaTrash className="h-3 w-3" />
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      required={index === 0}
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      placeholder="Medicine name"
                      value={item.medicine_name}
                      onChange={(e) => updateItem(index, "medicine_name", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      placeholder="Dosage"
                      value={item.dosage}
                      onChange={(e) => updateItem(index, "dosage", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      placeholder="Frequency"
                      value={item.frequency}
                      onChange={(e) => updateItem(index, "frequency", e.target.value)}
                    />
                    <input
                      className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                      placeholder="Duration"
                      value={item.duration}
                      onChange={(e) => updateItem(index, "duration", e.target.value)}
                    />
                  </div>
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    placeholder="Dosage instructions, reminders, or pharmacy notes"
                    value={item.instructions}
                    onChange={(e) => updateItem(index, "instructions", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <textarea className="mt-3 min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100" placeholder="General instructions" value={form.general_instructions} onChange={(e) => setForm((s) => ({ ...s, general_instructions: e.target.value }))} />
          <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white">
            {editingId ? <FaFloppyDisk /> : <FaPlus />}
            {editingId ? "Save changes" : "Create prescription"}
          </button>
        </form>
      ) : null}

      {feedback ? <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}

      <div className="grid gap-4">
        {prescriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
            <FaPrescriptionBottleMedical className="mx-auto h-8 w-8 text-neutral-300" />
            <h2 className="mt-3 text-lg font-bold text-black">No prescription history yet</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {canManage ? "Create a prescription above to save it here." : "Released prescriptions from your doctor will appear here."}
            </p>
          </div>
        ) : null}
        {prescriptions.map((item) => (
          <article
            key={item.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm print:border-0 print:shadow-none hover:bg-neutral-50 transition ${
              selectedPrescription?.id === item.id ? "border-neutral-300 ring-2 ring-neutral-100" : "border-neutral-200"
            }`}
            onClick={() => selectPreview(item)}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-700">{item.prescription_no}</span>
                <h2 className="mt-2 text-lg font-bold text-black">{item.patients?.profiles?.full_name ?? "Patient"}</h2>
                <p className="text-sm text-neutral-500">
                  Created {new Date(item.created_at).toLocaleDateString()}
                  {item.doctors?.profiles?.full_name ? ` • ${item.doctors.profiles.full_name}` : ""}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button onClick={() => selectPreview(item)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700">
                  <FaEye /> Preview
                </button>
                {canManage ? <button onClick={() => editPrescription(item)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700"><FaPenToSquare /> Edit</button> : null}
                {canManage ? <button onClick={() => toggleRelease(item)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700">{item.released_to_patient ? <FaEye /> : <FaPaperPlane />}{item.released_to_patient ? "Released" : "Send to portal"}</button> : null}
                <button onClick={() => downloadPdf(item)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700"><FaDownload /> Download PDF</button>
                {canManage ? <button onClick={() => emailPrescription(item)} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700"><FaPaperPlane /> Email</button> : null}
                <button onClick={() => printPrescription(item)} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-bold text-white"><FaPrint /> Print</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {item.diagnoses?.diagnosis_text ? (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Diagnosis</p>
                  <p className="mt-2 text-sm text-neutral-700">{item.diagnoses.diagnosis_text}</p>
                </div>
              ) : null}
              {item.diagnoses?.treatment_plan ? (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700">Treatment Plan</p>
                  <p className="mt-2 text-sm text-neutral-700">{item.diagnoses.treatment_plan}</p>
                </div>
              ) : null}
              {(item.prescription_items ?? []).map((rx, index) => (
                <div key={`${item.id}-${index}`} className="rounded-xl border border-neutral-200 p-4">
                  <p className="font-bold text-black">{rx.medicine_name}</p>
                  <p className="mt-1 text-sm text-neutral-600">{[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" - ")}</p>
                  {rx.instructions ? <p className="mt-2 text-sm text-neutral-600">{rx.instructions}</p> : null}
                </div>
              ))}
            </div>
            {item.general_instructions ? <p className="mt-4 text-sm leading-6 text-neutral-700">{item.general_instructions}</p> : null}
            {item.follow_up_date ? <p className="mt-3 text-sm font-semibold text-neutral-700">Follow-up: {item.follow_up_date}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function CapabilityCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="text-2xl text-neutral-400">{icon}</div>
      <h2 className="mt-4 text-base font-bold text-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
    </article>
  );
}

function PrescriptionSheet({ prescription }: { prescription: Prescription }) {
  const medicines = prescription.prescription_items ?? [];

  return (
    <div className="mt-5 overflow-hidden rounded-[2rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-sm">
      <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-neutral-300 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.07)]">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-700">Doc Kulot</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-black">Prescription</h3>
            <p className="mt-1 text-sm text-neutral-600">Family Medicine | Aesthetic Medicine</p>
          </div>
          <div className="text-right text-sm text-neutral-600">
            <p className="font-semibold text-black">{prescription.prescription_no}</p>
            <p>{new Date(prescription.created_at).toLocaleDateString()}</p>
            <p>{prescription.released_to_patient ? "Released to patient" : "For clinic use only"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <DetailBlock label="Patient" value={prescription.patients?.profiles?.full_name ?? "Patient"} />
          <DetailBlock label="Doctor" value={prescription.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti"} />
          <DetailBlock label="Diagnosis" value={prescription.diagnoses?.diagnosis_text ?? "Not set"} />
          <DetailBlock label="Treatment Plan" value={prescription.diagnoses?.treatment_plan ?? "Not set"} />
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Medicines</p>
          <div className="mt-4 space-y-3">
            {medicines.length > 0 ? (
              medicines.map((rx, index) => (
                <div key={`${prescription.id}-${rx.medicine_name}-${index}`} className="rounded-[1.25rem] border border-neutral-200 bg-white p-4">
                  <p className="font-bold text-black">
                    {index + 1}. {rx.medicine_name}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" | ") || "Dosage to be advised"}
                  </p>
                  {rx.instructions ? <p className="mt-3 text-sm leading-6 text-neutral-600">{rx.instructions}</p> : null}
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500">
                No medicine items added yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">General Instructions</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              {prescription.general_instructions ?? "No general instructions provided."}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Follow-up</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              {prescription.follow_up_date ?? prescription.diagnoses?.follow_up_date ?? "No follow-up date set."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-6 border-t border-dashed border-neutral-300 pt-6">
          <div className="text-sm text-neutral-600">
            <p className="font-semibold text-black">Physician signature</p>
            <div className="mt-6 h-px w-64 bg-neutral-400" />
            <p className="mt-2 font-semibold text-black">Dr. Fatimah Al-Zahra T. Ditti</p>
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Doc Kulot</p>
          </div>
          <div className="text-right text-xs leading-5 text-neutral-500">
            <p>Downloadable PDF format</p>
            <p>Patient portal ready</p>
            <p>Email release available from staff</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

