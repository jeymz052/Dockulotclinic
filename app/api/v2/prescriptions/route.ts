import { HttpError, httpError, isClinicStaff, ok, requireActor } from "@/src/lib/http";
import { enqueueNotification } from "@/src/lib/services/notification";
import { sendEmail } from "@/src/lib/services/notifier";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import {
  createPrescriptionPdf,
  getPrescriptionPdfFilename,
  type PrescriptionPdfRow,
} from "@/src/lib/services/prescription-pdf";
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

async function assertVirtualConsultationAppointment(supabase: ReturnType<typeof getSupabaseAdmin>, appointmentId: string) {
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("appointment_type")
    .eq("id", appointmentId)
    .single<{ appointment_type: string }>();
  if (error) throw error;
  if (appointment.appointment_type !== "Online") {
    throw new HttpError(400, "Prescriptions are only available for virtual consultations.");
  }
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    let q = supabase
      .from("prescriptions")
      .select("*, appointments(appointment_type), prescription_items(*), diagnoses(id, diagnosis_text, treatment_plan, follow_up_date, visible_to_patient), patients(dob, gender, profiles(full_name, email)), doctors(specialty, license_no, profiles(full_name))")
      .order("created_at", { ascending: false });
    if (!isClinicStaff(actor.profile.role)) {
      q = q.eq("patient_id", actor.id).eq("released_to_patient", true);
    } else if (url.searchParams.get("patient_id")) {
      q = q.eq("patient_id", url.searchParams.get("patient_id"));
    }
    const { data, error } = await q.limit(200);
    if (error) throw error;
    const settings = await readSystemSettings();
    const prescriptions = (data ?? []).filter((row) => row.appointments?.appointment_type === "Online");
    return ok({
      prescriptions: prescriptions.map((row) => ({
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
    if (!body.appointment_id) throw new HttpError(400, "appointment_id required for virtual consult prescriptions.");
    const supabase = getSupabaseAdmin();
    await assertVirtualConsultationAppointment(supabase, String(body.appointment_id));
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

    // Auto-email prescription PDF copy to patient if email exists
    let emailedToPatient = false;
    try {
      const { data: fullData } = await supabase
        .from("prescriptions")
        .select(
          "*, appointments(appointment_type), diagnoses(diagnosis_text, treatment_plan, follow_up_date), prescription_items(*), patients(dob, gender, profiles(full_name, email)), doctors(specialty, license_no, profiles(full_name))",
        )
        .eq("id", prescription.id)
        .maybeSingle<
          PrescriptionPdfRow & {
            patients?: { profiles?: { full_name?: string | null; email?: string | null } | null } | null;
            doctors?: { profiles?: { full_name?: string | null } | null } | null;
          }
        >();

      const patientEmail = fullData?.patients?.profiles?.email?.trim();
      if (patientEmail && fullData) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
        const portalUrl = appUrl ? `${appUrl}/profile/files` : "/profile/files";
        const settings = await readSystemSettings();
        const pdf = createPrescriptionPdf({ ...fullData, doctor_signature_data_url: settings.doctorSignatureDataUrl });
        const filename = getPrescriptionPdfFilename(fullData.prescription_no);

        await sendEmail({
          to: patientEmail,
          subject: `Prescription Copy: ${fullData.prescription_no}`,
          body: [
            `Hello ${fullData.patients?.profiles?.full_name ?? "Patient"},`,
            "",
            `Your prescription (${fullData.prescription_no}) from ${fullData.doctors?.profiles?.full_name ?? "Doc Kulot"} has been issued.`,
            "A copy of the PDF document is attached to this email for your reference.",
            "",
            `You can also view and download it directly from your patient portal: ${portalUrl}`,
          ].join("\n"),
          attachments: [
            {
              filename,
              content: Buffer.from(pdf).toString("base64"),
            },
          ],
        });
        emailedToPatient = true;
      }
    } catch (emailErr) {
      console.error("[prescriptions:auto-email] Failed to email prescription:", emailErr);
    }

    return ok({ prescription, emailed: emailedToPatient }, 201);
  } catch (e) {
    return httpError(e);
  }
}
