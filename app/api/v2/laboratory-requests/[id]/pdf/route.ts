import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createLaboratoryRequestPdf,
  type LaboratoryRequestPdfRow,
} from "@/src/lib/services/laboratory-request-pdf";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

type Ctx = { params: Promise<{ id: string }> };

function decodePdfDataUrl(dataUrl: string) {
  const match = dataUrl.trim().match(/^data:application\/pdf;base64,(.+)$/i);
  if (!match?.[1]) return null;
  return Buffer.from(match[1], "base64");
}

type LaboratoryRequestMetadata = {
  request_no?: string;
  doctor_id?: string | null;
  selected_tests?: string[];
  blood_chemistry?: string[];
  hematology?: string[];
  immuno_serology?: string[];
  clinical_microscopy?: string[];
  ultrasound?: string | null;
  xray?: string | null;
  ct_scan?: string | null;
  others?: string | null;
  notes?: string | null;
};

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("patient_files")
      .select("id, patient_id, appointment_id, file_name, file_url, file_type, document_metadata, visible_to_patient, created_at")
      .eq("id", id)
      .single<{
        id: string;
        patient_id: string;
        appointment_id: string | null;
        file_name: string;
        file_url: string;
        file_type: string;
        document_metadata: LaboratoryRequestMetadata | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data || (data.file_type !== "Laboratory Request" && data.file_type !== "Lab Request")) {
      throw new HttpError(404, "Laboratory request not found.");
    }

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

    let pdf = decodePdfDataUrl(data.file_url);
    if (!pdf) {
      const metadata = data.document_metadata;
      const requestNo = metadata?.request_no || data.file_name.replace(/\.pdf$/i, "");
      const { data: patient } = await supabase
        .from("patients")
        .select("dob, gender, address, profiles(full_name)")
        .eq("id", data.patient_id)
        .maybeSingle<{ dob?: string | null; gender?: string | null; address?: string | null; profiles?: { full_name?: string | null } | null }>();

      let doctor: LaboratoryRequestPdfRow["doctors"] = null;
      if (metadata?.doctor_id) {
        const { data: doctorRow } = await supabase
          .from("doctors")
          .select("specialty, license_no, profiles(full_name)")
          .eq("id", metadata.doctor_id)
          .maybeSingle<LaboratoryRequestPdfRow["doctors"]>();
        doctor = doctorRow ?? null;
      }

      const settings = await readSystemSettings();
      pdf = createLaboratoryRequestPdf({
        request_no: requestNo,
        created_at: data.created_at,
        selected_tests: metadata?.selected_tests ?? [],
        blood_chemistry: metadata?.blood_chemistry ?? [],
        hematology: metadata?.hematology ?? [],
        immuno_serology: metadata?.immuno_serology ?? [],
        clinical_microscopy: metadata?.clinical_microscopy ?? [],
        ultrasound: metadata?.ultrasound,
        xray: metadata?.xray,
        ct_scan: metadata?.ct_scan,
        others: metadata?.others,
        notes: metadata?.notes,
        released_to_patient: data.visible_to_patient,
        patients: patient,
        doctors: doctor,
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      });
    }

    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.file_name}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return httpError(error);
  }
}
