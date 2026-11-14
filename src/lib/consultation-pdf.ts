import { formatDisplayDate } from "@/src/lib/appointments";

export type ConsultSummaryData = {
  patientName: string;
  patientNumber: string;
  age?: number | string | null;
  gender?: string | null;
  consultDate: string;
  consultTime?: string | null;
  doctorName: string;
  doctorSpecialty?: string | null;
  doctorLicenseNo?: string | null;
  type: string;
  reason?: string | null;
  diagnosis?: string | null;
  soapSubjective?: string | null;
  soapObjective?: string | null;
  soapNote?: string | null;
  prescription?: string | null;
  vitals?: {
    bpSystolic?: number | null;
    bpDiastolic?: number | null;
    temperatureC?: number | null;
    pulseRate?: number | null;
    oxygenSaturation?: number | null;
    respiratoryRate?: number | null;
    weightKg?: number | null;
    heightCm?: number | null;
  } | null;
};

export async function downloadConsultationNotePdf(
  data: ConsultSummaryData,
  accessToken?: string | null,
): Promise<void> {
  try {
    const res = await fetch("/api/v2/consultations/notes/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        patientName: data.patientName,
        patientNumber: data.patientNumber,
        age: data.age,
        gender: data.gender,
        consultDate: data.consultDate,
        consultTime: data.consultTime,
        type: data.type,
        reason: data.reason,
        diagnosis: data.diagnosis,
        soapNote: [
          data.soapSubjective ? `Subjective: ${data.soapSubjective}` : "",
          data.soapObjective ? `Objective: ${data.soapObjective}` : "",
          data.soapNote ? data.soapNote : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        prescription: data.prescription,
        doctorName: data.doctorName,
        doctorSpecialty: data.doctorSpecialty,
        doctorLicenseNo: data.doctorLicenseNo,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || "Failed to download consultation note PDF.");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const safeName = (data.patientName || "Patient").replace(/[^\w.-]+/g, "_");
    const safeDate = (data.consultDate || new Date().toISOString().slice(0, 10)).replace(/[^\w.-]+/g, "_");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Consultation_Note_${safeName}_${safeDate}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    openConsultationNotePrintWindow(data);
  }
}

export function openConsultationNotePrintWindow(data: ConsultSummaryData) {
  // If called directly, trigger downloadConsultationNotePdf
  void downloadConsultationNotePdf(data);
}
