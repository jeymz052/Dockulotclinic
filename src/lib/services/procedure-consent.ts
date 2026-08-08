import { isProcedureServiceTitle } from "@/src/lib/appointment-context";
import { aftercareGuides, consentGuide, resolveAftercareGuideForService } from "@/src/lib/healthcare-content";
import { HttpError, isClinicStaff, type Actor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

export type ProcedureConsentPayload = {
  procedureName?: string;
  patientName?: string;
  patientSignature?: string;
  patientSignatureName?: string;
  consentAccepted?: boolean;
  aftercareAcknowledged?: boolean;
  aftercareGuideTitle?: string | null;
  aftercareImageUrl?: string | null;
  consentImageUrl?: string | null;
};

export type PatientProcedureConsent = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  reservation_id: string | null;
  procedure_name: string;
  patient_name: string;
  patient_signature: string;
  witness_name: string | null;
  witness_signature: string | null;
  witness_signed_at: string | null;
  physician_name: string | null;
  physician_signature: string | null;
  physician_signed_at: string | null;
  consent_form_url: string;
  consent_version: string;
  consent_snapshot: Record<string, unknown>;
  aftercare_acknowledged: boolean;
  aftercare_guide_title: string | null;
  aftercare_image_url: string | null;
  signed_at: string;
  created_at: string;
  updated_at: string;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildConsentSnapshot(procedureName: string) {
  const aftercareGuide = resolveAftercareGuideForService(procedureName);
  return {
    consentTitle: consentGuide.title,
    consentSummary: consentGuide.summary,
    consentBullets: consentGuide.bullets,
    procedureOptions: ["Botox", "Fillers", "Mesolipo / Mesotherapy", "Sclerotherapy", "GLP Initiation", "Other procedure"],
    procedureName,
    aftercareGuides: aftercareGuides.map((guide) => ({
      title: guide.title,
      image: guide.image,
      summary: guide.summary,
      bullets: guide.bullets,
    })),
    matchedAftercareGuide: aftercareGuide
      ? {
        title: aftercareGuide.title,
        image: aftercareGuide.image,
        summary: aftercareGuide.summary,
        bullets: aftercareGuide.bullets,
      }
      : null,
  };
}

export function validateProcedureConsentPayload(
  payload: ProcedureConsentPayload | null | undefined,
  expectedPatientName: string,
) {
  if (!payload) {
    throw new HttpError(400, "Procedure consent is required before reserving a medical procedure.");
  }

  const procedureName = payload.procedureName?.trim() ?? "";
  const patientName = payload.patientName?.trim() ?? "";
  const patientSignature = payload.patientSignature?.trim() ?? "";
  const patientSignatureName = payload.patientSignatureName?.trim() ?? "";

  if (!isProcedureServiceTitle(procedureName)) {
    throw new HttpError(400, "Procedure consent must be linked to a valid medical procedure.");
  }
  if (!payload.consentAccepted) {
    throw new HttpError(400, "Please accept the procedure consent before payment.");
  }
  if (!payload.aftercareAcknowledged) {
    throw new HttpError(400, "Please acknowledge the aftercare instructions before payment.");
  }
  if (!patientName || normalizeName(patientName) !== normalizeName(expectedPatientName)) {
    throw new HttpError(400, "Patient name on the consent must match the booking name.");
  }
  if (!patientSignatureName || normalizeName(patientSignatureName) !== normalizeName(expectedPatientName)) {
    throw new HttpError(400, "The name used to attest the signature must match the booking name.");
  }
  if (!patientSignature.startsWith("data:image/png;base64,") || patientSignature.length > 500_000) {
    throw new HttpError(400, "Please provide a valid drawn signature before payment.");
  }

  const matchedAftercareGuide = resolveAftercareGuideForService(procedureName);
  return {
    procedureName,
    patientName,
    patientSignature,
    consentImageUrl: payload.consentImageUrl?.trim() || consentGuide.image,
    aftercareGuideTitle: payload.aftercareGuideTitle?.trim() || matchedAftercareGuide?.title || null,
    aftercareImageUrl: payload.aftercareImageUrl?.trim() || matchedAftercareGuide?.image || null,
    consentSnapshot: {
      ...buildConsentSnapshot(procedureName),
      signatureName: patientSignatureName,
      signatureFormat: "drawn-png",
    },
  };
}

export async function upsertProcedureConsentForReservation(input: {
  reservationId: string;
  patientId: string;
  appointmentId?: string | null;
  consent: ReturnType<typeof validateProcedureConsentPayload>;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const row = {
    patient_id: input.patientId,
    appointment_id: input.appointmentId ?? null,
    reservation_id: input.reservationId,
    procedure_name: input.consent.procedureName,
    patient_name: input.consent.patientName,
    patient_signature: input.consent.patientSignature,
    consent_form_url: input.consent.consentImageUrl,
    consent_version: "doc-kulot-procedure-consent-2026-08-01",
    consent_snapshot: input.consent.consentSnapshot,
    procedure_explained: true,
    outcomes_vary_acknowledged: true,
    risk_acknowledged: true,
    liability_acknowledged: true,
    withdrawal_acknowledged: true,
    voluntary_acknowledged: true,
    aftercare_acknowledged: true,
    aftercare_guide_title: input.consent.aftercareGuideTitle,
    aftercare_image_url: input.consent.aftercareImageUrl,
    signed_at: now,
  };

  const { data: existing, error: existingError } = await supabase
    .from("patient_procedure_consents")
    .select("id")
    .eq("reservation_id", input.reservationId)
    .maybeSingle<{ id: string }>();
  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase
      .from("patient_procedure_consents")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single<PatientProcedureConsent>();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("patient_procedure_consents")
    .insert(row)
    .select()
    .single<PatientProcedureConsent>();
  if (error) throw error;
  return data;
}

export async function linkProcedureConsentToAppointment(reservationId: string, appointmentId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("patient_procedure_consents")
    .update({ appointment_id: appointmentId })
    .eq("reservation_id", reservationId);
  if (error) throw error;
}

export async function signProcedureConsentAsStaff(actor: Actor, consentId: string, signature: string) {
  const trimmedSignature = signature.trim();
  if (!trimmedSignature.startsWith("data:image/png;base64,") || trimmedSignature.length > 500_000) {
    throw new HttpError(400, "Please provide a valid signature image.");
  }

  const isDoctor = actor.profile.role === "doctor";
  if (!isDoctor && !isClinicStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");

  const supabase = getSupabaseAdmin();
  const signatureFields = isDoctor
    ? { physician_name: actor.profile.full_name, physician_signature: trimmedSignature, physician_signed_at: new Date().toISOString() }
    : { witness_name: actor.profile.full_name, witness_signature: trimmedSignature, witness_signed_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("patient_procedure_consents")
    .update(signatureFields)
    .eq("id", consentId)
    .select()
    .single<PatientProcedureConsent>();
  if (error) throw error;
  return data;
}

export async function listProcedureConsents(actor: Actor, filters: {
  patientId?: string | null;
  appointmentId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("patient_procedure_consents")
    .select("id, patient_id, appointment_id, reservation_id, procedure_name, patient_name, patient_signature, witness_name, witness_signature, witness_signed_at, physician_name, physician_signature, physician_signed_at, consent_form_url, consent_version, consent_snapshot, aftercare_acknowledged, aftercare_guide_title, aftercare_image_url, signed_at, created_at, updated_at")
    .order("signed_at", { ascending: false });

  if (actor.profile.role === "patient") {
    query = query.eq("patient_id", actor.id);
  } else if (isClinicStaff(actor.profile.role) || actor.profile.role === "doctor") {
    if (filters.patientId) query = query.eq("patient_id", filters.patientId);
    if (filters.appointmentId) query = query.eq("appointment_id", filters.appointmentId);
  } else {
    throw new HttpError(403, "Forbidden");
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data ?? []) as PatientProcedureConsent[];
}
