import { HttpError, httpError, isClinicStaff, ok, requireActor } from "@/src/lib/http";
import { enqueueNotification } from "@/src/lib/services/notification";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { DbRole } from "@/src/lib/db/types";

type PrescriptionItemInput = {
  medicine_name?: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
};

function canManagePrescriptions(role: DbRole) {
  return role === "super_admin" || role === "admin" || role === "doctor";
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();
    let q = supabase
      .from("prescriptions")
      .select("*, prescription_items(*), diagnoses(id, diagnosis_text, treatment_plan, follow_up_date, visible_to_patient), patients(dob, gender, profiles(full_name, email)), doctors(specialty, license_no, profiles(full_name))")
      .order("created_at", { ascending: false });
    if (!isClinicStaff(actor.profile.role)) {
      q = q.eq("patient_id", actor.id).eq("released_to_patient", true);
    }
    const { data, error } = await q.limit(200);
    if (error) throw error;
    const settings = await readSystemSettings();
    return ok({
      prescriptions: (data ?? []).map((row) => ({
        ...row,
        doctor_signature_data_url: settings.doctorSignatureDataUrl,
      })),
    });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    if (!canManagePrescriptions(actor.profile.role)) throw new HttpError(403, "Only doctors and admins can create prescriptions.");
    const body = await req.json();
    if (!body.patient_id || !body.doctor_id) throw new HttpError(400, "patient_id and doctor_id required");
    const supabase = getSupabaseAdmin();
    let diagnosisId: string | null = null;

    const diagnosisText = normalizeText(body.diagnosis_text);
    const treatmentPlan = normalizeText(body.treatment_plan);
    const generalInstructions = normalizeText(body.general_instructions);
    const followUpDate = body.follow_up_date || null;
    const releaseToPortal = body.released_to_patient ?? true;
    const items: PrescriptionItemInput[] = Array.isArray(body.items) ? body.items : [];
    const cleanedItems = items
      .map((item) => ({
        medicine_name: normalizeText(item.medicine_name),
        dosage: normalizeText(item.dosage),
        frequency: normalizeText(item.frequency),
        duration: normalizeText(item.duration),
        instructions: normalizeText(item.instructions),
      }))
      .filter((item): item is Required<Pick<typeof item, "medicine_name">> & typeof item => Boolean(item.medicine_name));

    if (!diagnosisText) throw new HttpError(400, "Diagnosis is required.");
    if (cleanedItems.length === 0) throw new HttpError(400, "Add at least one medicine item.");

    if (diagnosisText || treatmentPlan || followUpDate) {
      const { data: diagnosis, error: diagnosisError } = await supabase
        .from("diagnoses")
        .insert({
          appointment_id: body.appointment_id || null,
          patient_id: body.patient_id,
          doctor_id: body.doctor_id,
          diagnosis_text: diagnosisText,
          treatment_plan: treatmentPlan,
          follow_up_date: followUpDate,
          visible_to_patient: releaseToPortal,
        })
        .select("id")
        .single<{ id: string }>();
      if (diagnosisError) throw diagnosisError;
      diagnosisId = diagnosis.id;
    }

    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .insert({
        appointment_id: body.appointment_id || null,
        patient_id: body.patient_id,
        doctor_id: body.doctor_id,
        diagnosis_id: diagnosisId ?? body.diagnosis_id ?? null,
        general_instructions: generalInstructions ?? treatmentPlan,
        follow_up_date: followUpDate,
        released_to_patient: releaseToPortal,
      })
      .select()
      .single();
    if (error) throw error;

    if (cleanedItems.length) {
      const { error: itemsError } = await supabase.from("prescription_items").insert(
        cleanedItems.map((item, index) => ({
          prescription_id: prescription.id,
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          instructions: item.instructions,
          sort_order: index,
        })),
      );
      if (itemsError) throw itemsError;
    }

    if (releaseToPortal) {
      await enqueueNotification({
        user_id: body.patient_id,
        template: "prescription_released",
        channels: ["email"],
        payload: {
          prescription_id: prescription.id,
          prescription_no: prescription.prescription_no,
        },
      });
    }

    return ok({ prescription }, 201);
  } catch (e) {
    return httpError(e);
  }
}
