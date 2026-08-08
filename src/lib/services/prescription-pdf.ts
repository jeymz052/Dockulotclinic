import { createSimplePdf } from "@/src/lib/pdf";

export type PrescriptionPdfRow = {
  id: string;
  prescription_no: string;
  patient_id: string;
  doctor_id: string;
  general_instructions: string | null;
  follow_up_date: string | null;
  released_to_patient: boolean;
  created_at: string;
  diagnoses?: {
    diagnosis_text?: string | null;
    treatment_plan?: string | null;
    follow_up_date?: string | null;
  } | null;
  prescription_items?: Array<{
    medicine_name: string;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
    sort_order?: number | null;
  }>;
  patients?: { profiles?: { full_name?: string | null } | null } | null;
  doctors?: { profiles?: { full_name?: string | null } | null } | null;
};

export function getPrescriptionPdfFilename(prescriptionNo: string) {
  return `${prescriptionNo.replace(/[^\w.-]+/g, "_")}.pdf`;
}

export function createPrescriptionPdf(row: PrescriptionPdfRow) {
  const medicines = [...(row.prescription_items ?? [])].sort((a, b) => {
    const left = typeof a.sort_order === "number" ? a.sort_order : 0;
    const right = typeof b.sort_order === "number" ? b.sort_order : 0;
    return left - right;
  });

  const lines = [
    "Doc Kulot",
    "Family Medicine | Aesthetic Medicine",
    "Prescription for pharmacy reference",
    `Prescription No: ${row.prescription_no}`,
    `Patient: ${row.patients?.profiles?.full_name ?? "Patient"}`,
    `Doctor: ${row.doctors?.profiles?.full_name ?? "Dr. Fatimah Al-Zahra T. Ditti"}`,
    `Created: ${new Date(row.created_at).toLocaleDateString("en-US")}`,
    row.diagnoses?.diagnosis_text ? `Diagnosis: ${row.diagnoses.diagnosis_text}` : "Diagnosis: Not set",
    row.diagnoses?.treatment_plan ? `Treatment Plan: ${row.diagnoses.treatment_plan}` : "Treatment Plan: Not set",
    row.follow_up_date ? `Follow-up: ${row.follow_up_date}` : "Follow-up: Not set",
    " ",
    "Medicines",
    ...medicines.flatMap((item, index) => {
      const details = [item.dosage, item.frequency, item.duration].filter(Boolean).join(" | ");
      const result = [`${index + 1}. ${item.medicine_name}`];
      if (details) result.push(`   ${details}`);
      if (item.instructions) result.push(`   ${item.instructions}`);
      return result;
    }),
    " ",
    "General Instructions",
    row.general_instructions ?? "No general instructions provided.",
    " ",
    "Physician Signature: ________________________________",
    "Dr. Fatimah Al-Zahra T. Ditti",
    "PRC No.: 0141185",
    "Please present this prescription to the pharmacy if needed.",
  ];

  return createSimplePdf(lines);
}
