import { HttpError, httpError, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("patient_files")
      .select("patient_id, appointment_id, file_name, document_metadata, visible_to_patient, created_at")
      .eq("id", id)
      .single<{
        patient_id: string;
        appointment_id: string | null;
        file_name: string;
        document_metadata: {
          request_no?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          doctor_specialty?: string | null;
          doctor_license_no?: string | null;
          patient_name?: string | null;
          patient_dob?: string | null;
          patient_gender?: string | null;
          patient_address?: string | null;
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
        } | null;
        visible_to_patient: boolean;
        created_at: string;
      }>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Laboratory request not found.");

    if (actor.profile.role === "patient") {
      if (data.patient_id !== actor.id || !data.visible_to_patient) {
        throw new HttpError(403, "Forbidden");
      }
    } else if (actor.profile.role !== "doctor" && actor.profile.role !== "admin" && actor.profile.role !== "super_admin") {
      throw new HttpError(403, "Forbidden");
    }

    const metadata = data.document_metadata;
    const requestNo = metadata?.request_no || data.file_name.replace(/\.pdf$/i, "");

    const { data: patient } = await supabase
      .from("patients")
      .select("dob, gender, address, profiles(full_name)")
      .eq("id", data.patient_id)
      .maybeSingle<{ dob?: string | null; gender?: string | null; address?: string | null; profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null }>();

    const patientProfile = Array.isArray(patient?.profiles) ? patient?.profiles[0] : patient?.profiles;
    const patientName = patientProfile?.full_name ?? metadata?.patient_name ?? null;
    const patientDob = patient?.dob ?? metadata?.patient_dob ?? null;
    const patientGender = patient?.gender ?? metadata?.patient_gender ?? null;
    const patientAddress = patient?.address ?? metadata?.patient_address ?? null;

    const settings = await readSystemSettings();

    return Response.json({
      requestNo,
      patientName,
      patientDob,
      patientGender,
      patientAddress,
      doctorName: metadata?.doctor_name ?? "FATIMAH AL-ZAHRA T. DITTI, MD, DFM",
      doctorSpecialty: metadata?.doctor_specialty ?? "Family Medicine, Aesthetic Medicine",
      doctorLicenseNo: metadata?.doctor_license_no ?? "0141185",
      doctorSignatureDataUrl: settings.doctorSignatureDataUrl,
      selectedTests: metadata?.selected_tests ?? [],
      bloodChemistry: metadata?.blood_chemistry ?? [],
      hematology: metadata?.hematology ?? [],
      immunoSerology: metadata?.immuno_serology ?? [],
      clinicalMicroscopy: metadata?.clinical_microscopy ?? [],
      ultrasound: metadata?.ultrasound ?? null,
      xray: metadata?.xray ?? null,
      ctScan: metadata?.ct_scan ?? null,
      others: metadata?.others ?? null,
      notes: metadata?.notes ?? null,
      createdAt: data.created_at,
      visibleToPatient: data.visible_to_patient,
    });
  } catch (error) {
    return httpError(error);
  }
}
