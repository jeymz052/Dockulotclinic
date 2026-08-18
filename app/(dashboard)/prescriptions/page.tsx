"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FaDownload,
  FaEye,
  FaPaperPlane,
  FaPrint,
  FaPrescriptionBottleMedical,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type DiagnosisRecord = {
  id: string;
  diagnosis_text: string;
  treatment_plan: string | null;
  follow_up_date: string | null;
  visible_to_patient: boolean;
};

type PrescriptionItem = {
  id?: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  sort_order?: number | null;
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
  prescription_items?: PrescriptionItem[];
  diagnoses?: DiagnosisRecord | null;
  doctors?: {
    specialty?: string | null;
    license_no?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
  doctor_signature_data_url?: string | null;
  patients?: {
    dob?: string | null;
    gender?: string | null;
    profiles?: { full_name?: string; email?: string } | null;
  } | null;
};

function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}

function formatPrescriptionSpecialty(raw?: string | null) {
  const specialty = raw?.trim();
  if (!specialty) return "Family and Aesthetic Medicine Specialist";
  if (/family medicine specialist/i.test(specialty)) return "Family and Aesthetic Medicine Specialist";
  if (/family medicine and aesthetic medicine/i.test(specialty)) return "Family and Aesthetic Medicine Specialist";
  return specialty;
}

async function cropSignatureDataUrl(dataUrl: string) {
  return await new Promise<string>((resolve) => {
    const image = document.createElement("img");
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0);
      const { width, height } = canvas;
      const pixels = context.getImageData(0, 0, width, height).data;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const alpha = pixels[(y * width + x) * 4 + 3];
          if (alpha <= 8) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0 || maxY < 0) {
        resolve(dataUrl);
        return;
      }
      const padding = 18;
      const leftPadding = Math.max(8, Math.floor(padding * 0.7));
      const rightPadding = Math.max(8, Math.floor(padding * 0.7));
      const topPadding = Math.max(padding + 6, 18);
      const bottomPadding = 0;
      const cropX = Math.max(0, minX - leftPadding);
      const cropY = Math.max(0, minY - topPadding);
      const cropWidth = Math.min(width - cropX, maxX - minX + leftPadding + rightPadding + 1);
      const cropHeight = Math.min(height - cropY, maxY - minY + topPadding + bottomPadding + 1);
      const output = document.createElement("canvas");
      output.width = Math.max(1, cropWidth);
      output.height = Math.max(1, cropHeight);
      const outputContext = output.getContext("2d");
      if (!outputContext) {
        resolve(dataUrl);
        return;
      }
      outputContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(output.toDataURL("image/png"));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export default function PrescriptionsPage() {
  const { accessToken, role } = useRole();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [clinicSignatureDataUrl, setClinicSignatureDataUrl] = useState("");

  const authHeaders = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken],
  );
  const canEmail = role === "SUPER_ADMIN" || role === "DOCTOR";

  useEffect(() => {
    async function loadPrescriptions() {
      if (!authHeaders) return;
      setIsLoading(true);
      setFeedback("");

      const res = await fetch("/api/v2/prescriptions", {
        headers: authHeaders,
        cache: "no-store",
      });
      if (!res.ok) {
        setFeedback("Unable to load prescription records.");
        setIsLoading(false);
        return;
      }

      const rows = ((await res.json()).prescriptions ?? []) as Prescription[];
      const settingsRes = await fetch("/api/settings", {
        headers: authHeaders,
        cache: "no-store",
      });
      const rawSignatureDataUrl = settingsRes.ok
        ? (((await settingsRes.json()) as { data?: { doctorSignatureDataUrl?: string } }).data?.doctorSignatureDataUrl ?? "")
        : "";
      const signatureDataUrl = rawSignatureDataUrl ? await cropSignatureDataUrl(rawSignatureDataUrl) : "";
      const sortedRows = rows.map((row) => ({
        ...row,
        prescription_items: [...(row.prescription_items ?? [])].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      }));
      setPrescriptions(sortedRows);
      setClinicSignatureDataUrl(signatureDataUrl);
      setSelectedId((current) => current ?? sortedRows[0]?.id ?? null);
      setIsLoading(false);
    }

    void loadPrescriptions();
  }, [authHeaders]);

  const selectedPrescription =
    prescriptions.find((item) => item.id === selectedId) ?? prescriptions[0] ?? null;

  async function downloadPdf(item: Prescription) {
    if (!authHeaders) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}/pdf`, { headers: authHeaders });
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
    if (!authHeaders) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}/pdf`, { headers: authHeaders });
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
      setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
    });
  }

  async function emailPrescription(item: Prescription) {
    if (!authHeaders) return;
    const res = await fetch(`/api/v2/prescriptions/${item.id}`, {
      method: "POST",
      headers: authHeaders,
    });
    setFeedback(
      res.ok
        ? `Prescription ${item.prescription_no} was emailed to the patient.`
        : "Unable to email prescription to the patient.",
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">Prescription overview</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-black">Clinic prescription compilation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              All saved prescriptions are compiled here for clinic review. Creating prescriptions stays inside consultation charting.
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
            <span className="font-black text-black">{prescriptions.length}</span>
            <span className="ml-2 text-neutral-600">prescription records</span>
          </div>
        </div>
      </section>

      {feedback ? (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 shadow-sm">
          {feedback}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">Compilation</p>
            <h2 className="mt-1 text-lg font-black text-black">All prescriptions</h2>
          </div>

          {isLoading ? <p className="px-4 py-6 text-sm text-neutral-500">Loading prescription records...</p> : null}

          {!isLoading && prescriptions.length === 0 ? (
            <div className="p-6 text-center">
              <FaPrescriptionBottleMedical className="mx-auto h-8 w-8 text-neutral-300" />
              <h3 className="mt-3 text-base font-bold text-black">No prescriptions yet</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Prescriptions created in consultation charting will appear here.
              </p>
            </div>
          ) : null}

          <div className="max-h-[calc(100vh-18rem)] overflow-y-auto p-3">
            {prescriptions.map((item) => (
              <PrescriptionListItem
                key={item.id}
                item={item}
                selected={selectedPrescription?.id === item.id}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        </aside>

        <main className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <SelectedHeader
            prescription={selectedPrescription}
            canEmail={canEmail}
            onDownload={downloadPdf}
            onEmail={emailPrescription}
            onPrint={printPrescription}
          />
          {selectedPrescription ? (
            <PrescriptionDetails
              prescription={selectedPrescription}
              clinicSignatureDataUrl={clinicSignatureDataUrl}
            />
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              Select a prescription from the compilation list to view it.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PrescriptionListItem({
  item,
  selected,
  onClick,
}: {
  item: Prescription;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-3 w-full rounded-md border p-4 text-left transition ${
        selected
          ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-[0.14em] ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
            {item.prescription_no}
          </p>
          <p className="mt-2 break-words text-base font-black leading-tight">
            {item.patients?.profiles?.full_name ?? "Patient"}
          </p>
        </div>
        <FaEye className={`mt-1 h-4 w-4 shrink-0 ${selected ? "text-white" : "text-neutral-400"}`} />
      </div>
      <p className={`mt-3 text-sm ${selected ? "text-neutral-200" : "text-neutral-600"}`}>
        {new Date(item.created_at).toLocaleDateString()}
        {item.doctors?.profiles?.full_name ? ` | ${item.doctors.profiles.full_name}` : ""}
      </p>
      <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.12em] ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
        {item.released_to_patient ? "Shared with patient" : "Clinic record only"}
      </p>
    </button>
  );
}

function SelectedHeader({
  prescription,
  canEmail,
  onDownload,
  onEmail,
  onPrint,
}: {
  prescription: Prescription | null;
  canEmail: boolean;
  onDownload: (item: Prescription) => void | Promise<void>;
  onEmail: (item: Prescription) => void | Promise<void>;
  onPrint: (item: Prescription) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-600">Selected prescription</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-black">
          {prescription?.prescription_no ?? "No prescription selected"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          {prescription
            ? `${prescription.patients?.profiles?.full_name ?? "Patient"} | ${new Date(prescription.created_at).toLocaleDateString()}`
            : "Choose a prescription from the compilation list to preview it."}
        </p>
      </div>
      {prescription ? (
        <div className="flex flex-col gap-2 print:hidden">
          <div className="flex flex-wrap gap-2">
          <ActionButton icon={<FaDownload />} label="Download PDF" onClick={() => void onDownload(prescription)} />
          {canEmail ? (
            <ActionButton icon={<FaPaperPlane />} label="Email to patient" onClick={() => void onEmail(prescription)} />
          ) : null}
          </div>
          <button
            type="button"
            onClick={() => void onPrint(prescription)}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-black px-4 py-3 text-xs font-bold text-white"
          >
            <FaPrint /> Print
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700"
    >
      {icon} {label}
    </button>
  );
}

function PrescriptionDetails({
  prescription,
  clinicSignatureDataUrl,
}: {
  prescription: Prescription;
  clinicSignatureDataUrl: string;
}) {
  const medicines = prescription.prescription_items ?? [];
  const doctorName = prescription.doctors?.profiles?.full_name ?? "Doctor not recorded";
  const doctorNameBase = doctorName.replace(/^Dr\.?\s*/i, "").replace(/,\s*MD$/i, "").trim();
  const doctorHeaderName = doctorNameBase ? `${doctorNameBase}, MD` : doctorName;
  const clinicHeaderName = doctorNameBase ? `${doctorNameBase} Online Clinic` : "Doc Kulot Online Clinic";
  const patientName = prescription.patients?.profiles?.full_name ?? "Patient";
  const prescribedAt = new Date(prescription.created_at);
  const prescribedDate = prescribedAt.toLocaleDateString();
  const prescribedTime = prescribedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const specialty = formatPrescriptionSpecialty(prescription.doctors?.specialty);
  const prcNo = prescription.doctors?.license_no ?? "0141185";
  const patientAge = ageFromDob(prescription.patients?.dob);
  const signatureDataUrl = prescription.doctor_signature_data_url ?? clinicSignatureDataUrl;

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
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
          <div className="min-w-[11rem] text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">Prescription ID</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-black">{prescription.prescription_no}</p>
          </div>
        </div>

        <div className="mt-7 text-center">
          <p className="text-lg font-black tracking-tight text-black sm:text-[1.65rem]">{doctorHeaderName}</p>
          <p className="mt-2 text-sm text-neutral-700 sm:text-[0.95rem]">{specialty}</p>
          <p className="mt-1 text-xl font-black tracking-tight text-black sm:text-[1.5rem]">{clinicHeaderName}</p>
          <p className="mt-1 text-sm text-neutral-700 sm:text-[0.95rem]">Zamboanga City, Zamboanga Del Sur</p>
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
              <p className="text-sm leading-6 text-neutral-800">Gender: {prescription.patients?.gender || "Not recorded"}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm leading-6 text-neutral-700">Prescribed on: {prescribedDate}</p>
              <p className="text-sm leading-6 text-neutral-700">{prescribedTime} PHT</p>
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
              medicines.map((item, index) => (
                <div key={`${prescription.id}-${item.id ?? index}`} className="pl-4">
                  <p className="text-[1.55rem] font-black leading-tight tracking-tight text-black">{item.medicine_name}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-neutral-800">
                    {item.dosage || "No dosage recorded"}
                    {item.frequency ? `, ${item.frequency}` : ""}
                    {item.duration ? `, ${item.duration}` : ""}
                  </p>
                  {item.instructions ? (
                    <p className="mt-1 text-sm leading-6 text-neutral-700">{item.instructions}</p>
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
            {prescription.general_instructions || prescription.diagnoses?.treatment_plan || "No additional instructions recorded."}
          </p>
        </div>

        <div className="mt-16 flex justify-end">
          <div className="w-72 text-center">
            {signatureDataUrl ? (
              <div className="mb-0 flex h-24 items-end justify-center border-b border-black/80 pb-0">
                <Image
                  src={signatureDataUrl}
                  alt="Physician signature"
                  width={380}
                  height={160}
                  className="h-auto max-h-52 w-auto translate-y-10 object-contain sm:translate-y-12"
                />
              </div>
            ) : (
              <div className="mb-0 h-24 border-b border-black/80" />
            )}
            <p className="text-sm text-neutral-700">Physician&apos;s Signature</p>
            <p className="mt-1 text-sm font-semibold text-neutral-800">PRC No.: {prcNo}</p>
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
