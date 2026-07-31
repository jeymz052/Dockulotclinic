import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { sendEmail } from "@/src/lib/services/notifier";
import { enqueueNotification } from "@/src/lib/services/notification";
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

export async function PATCH(req: Request, ctx: RouteContext<"/api/v2/prescriptions/[id]">) {
  try {
    const actor = await requireActor(req);
    if (!canManagePrescriptions(actor.profile.role)) throw new HttpError(403, "Only doctors and admins can update prescriptions.");
    const { id } = await ctx.params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    for (const key of ["general_instructions", "follow_up_date", "pdf_url"] as const) {
      if (key in body) patch[key] = body[key] || null;
    }
    if ("released_to_patient" in body) patch.released_to_patient = Boolean(body.released_to_patient);
    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("prescriptions")
      .select("id, patient_id, doctor_id, appointment_id, diagnosis_id, prescription_no, released_to_patient")
      .eq("id", id)
      .single<{
        id: string;
        patient_id: string;
        doctor_id: string;
        appointment_id: string | null;
        diagnosis_id: string | null;
        prescription_no: string;
        released_to_patient: boolean;
      }>();
    if (currentError) throw currentError;

    const diagnosisText = "diagnosis_text" in body ? normalizeText(body.diagnosis_text) : undefined;
    const treatmentPlan = "treatment_plan" in body ? normalizeText(body.treatment_plan) : undefined;
    const nextFollowUpDate =
      "follow_up_date" in body ? (body.follow_up_date || null) : undefined;
    const nextVisibleToPatient =
      "released_to_patient" in body ? Boolean(body.released_to_patient) : undefined;

    const shouldTouchDiagnosis =
      diagnosisText !== undefined
      || treatmentPlan !== undefined
      || nextFollowUpDate !== undefined
      || (nextVisibleToPatient !== undefined && Boolean(current.diagnosis_id));

    if (shouldTouchDiagnosis) {
      const diagnosisPatch = {
        appointment_id: current.appointment_id,
        patient_id: current.patient_id,
        doctor_id: current.doctor_id,
        diagnosis_text: diagnosisText || "Diagnosis recorded in prescription module",
        treatment_plan: treatmentPlan ?? null,
        follow_up_date: nextFollowUpDate ?? null,
        visible_to_patient: nextVisibleToPatient ?? true,
      };

      if (current.diagnosis_id) {
        const { error: diagnosisError } = await supabase
          .from("diagnoses")
          .update(diagnosisPatch)
          .eq("id", current.diagnosis_id);
        if (diagnosisError) throw diagnosisError;
      } else {
        const { data: diagnosis, error: diagnosisError } = await supabase
          .from("diagnoses")
          .insert(diagnosisPatch)
          .select("id")
          .single<{ id: string }>();
        if (diagnosisError) throw diagnosisError;
        patch.diagnosis_id = diagnosis.id;
      }
    }

    const { data, error } = await supabase.from("prescriptions").update(patch).eq("id", id).select().single();
    if (error) throw error;
    if (Array.isArray(body.items)) {
      const { error: deleteError } = await supabase.from("prescription_items").delete().eq("prescription_id", id);
      if (deleteError) throw deleteError;
      const nextItems = (body.items as PrescriptionItemInput[])
        .map((item) => ({
          medicine_name: normalizeText(item.medicine_name),
          dosage: normalizeText(item.dosage),
          frequency: normalizeText(item.frequency),
          duration: normalizeText(item.duration),
          instructions: normalizeText(item.instructions),
        }))
        .filter((item) => item.medicine_name);
      if (nextItems.length) {
        const { error: insertError } = await supabase.from("prescription_items").insert(
          nextItems.map((item, index) => ({
            prescription_id: id,
            medicine_name: item.medicine_name,
            dosage: item.dosage ?? null,
            frequency: item.frequency ?? null,
            duration: item.duration ?? null,
            instructions: item.instructions ?? null,
            sort_order: index,
          })),
        );
        if (insertError) throw insertError;
      }
    }
    if ("released_to_patient" in body && Boolean(body.released_to_patient) && !current.released_to_patient) {
      await enqueueNotification({
        user_id: current.patient_id,
        template: "prescription_released",
        channels: ["email"],
        payload: {
          prescription_id: current.id,
          prescription_no: current.prescription_no,
        },
      });
    }
    return ok({ prescription: data });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/v2/prescriptions/[id]">) {
  try {
    const actor = await requireActor(req);
    if (!canManagePrescriptions(actor.profile.role)) {
      throw new HttpError(403, "Only doctors and admins can email prescriptions.");
    }

    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("prescriptions")
      .select("prescription_no, released_to_patient, patients(profiles(full_name,email)), doctors(profiles(full_name))")
      .eq("id", id)
      .maybeSingle<{
        prescription_no: string;
        released_to_patient: boolean;
        patients?: { profiles?: { full_name?: string | null; email?: string | null } | null } | null;
        doctors?: { profiles?: { full_name?: string | null } | null } | null;
      }>();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Prescription not found.");

    const patientEmail = data.patients?.profiles?.email?.trim();
    if (!patientEmail) {
      throw new HttpError(400, "Patient email is missing.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
    const portalUrl = appUrl ? `${appUrl}/prescriptions` : "/prescriptions";
    await sendEmail({
      to: patientEmail,
      subject: `Your prescription ${data.prescription_no} is ready`,
      body: [
        `Hello ${data.patients?.profiles?.full_name ?? "Patient"},`,
        "",
        `Your prescription ${data.prescription_no} from ${data.doctors?.profiles?.full_name ?? "Doc Kulot"} is ready.`,
        `Open your patient portal to view, download, or print the PDF: ${portalUrl}`,
        "",
        data.released_to_patient
          ? "The prescription is already visible in the portal."
          : "The prescription is currently not released to the patient portal.",
      ].join("\n"),
    });

    return ok({ message: "Prescription email sent." });
  } catch (e) {
    return httpError(e);
  }
}
