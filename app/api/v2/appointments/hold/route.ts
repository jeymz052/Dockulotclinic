import { httpError, ok, getActor } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { resolveBookingPatientId, validateSharedSlotOrThrow, resolveAssignedDoctorUuid } from "@/src/lib/server/appointments-store";
import { normalizeSqlTime } from "@/src/lib/server/legacy-bridge";
import { resolveSchedulableSlotForStart } from "@/src/lib/services/schedule";
import { CONSULTATION_SLOT_MINUTES } from "@/src/lib/clinic-schedule";
import { parseAppointmentContext } from "@/src/lib/appointment-context";
import { resolveClinicConsultationAmount, resolveVirtualConsultAmount } from "@/src/lib/server/booking-pricing-store";
import { enqueueNotification } from "@/src/lib/services/notification";

function isMissingPatientCategoryColumn(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "42703"
      && "message" in error
      && /patient_category/i.test(String((error as { message?: unknown }).message ?? "")),
  );
}

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);
    enforceRateLimit(req, "appointment-hold", 20, 60_000);

    const actor = await getActor(req);
    const body = await req.json();

    const {
      patientName,
      email,
      phone,
      doctorId,
      date,
      start,
      type,
      reason,
      patientStatus,
    } = body as {
      patientName: string;
      email: string;
      phone: string;
      doctorId?: string;
      date: string;
      start: string;
      type: "Clinic" | "Online";
      reason?: string;
      patientStatus?: "New" | "Existing";
    };

    const doctorUuid = await resolveAssignedDoctorUuid(doctorId);
    const slot = await resolveSchedulableSlotForStart(doctorUuid, date, start, type, {
      slotMinutes: CONSULTATION_SLOT_MINUTES,
    });
    const start_time = normalizeSqlTime(slot.start);
    const end_time = slot.end;

    const patientId = await resolveBookingPatientId({ email, patientName, phone, patientStatus }, {
      actorRole: actor?.profile.role === "patient" ? "PATIENT" : undefined,
      actorUserId: actor?.profile.role === "patient" ? actor.id : undefined,
    });

    const { queueNumber } = await validateSharedSlotOrThrow({
      doctorUuid,
      date,
      start_time,
      end_time,
      type,
      patientId,
    });

    let amount = 0;
    if (type === "Online") {
      amount = await resolveVirtualConsultAmount();
    } else {
      const { data: patientRow, error: patientCategoryError } = await getSupabaseAdmin()
        .from("patients")
        .select("patient_category")
        .eq("id", patientId)
        .maybeSingle<{ patient_category: string | null }>();
      if (patientCategoryError && !isMissingPatientCategoryColumn(patientCategoryError)) {
        throw patientCategoryError;
      }
      const hasExistingPatientRecord = patientRow?.patient_category !== "New";
      const requestedConsultKind = parseAppointmentContext(reason).consultKind;
      const resolvedConsultKind =
        patientStatus === "Existing" || hasExistingPatientRecord
          ? "FirstConsult"
          : requestedConsultKind;
      const { data: priorClinicAppointments } = await getSupabaseAdmin()
        .from("appointments")
        .select("id")
        .eq("patient_id", patientId)
        .eq("appointment_type", "Clinic")
        .not("status", "in", '("Cancelled","NoShow")')
        .limit(1);
      amount = await resolveClinicConsultationAmount({
        patientCategory: patientCategoryError
          ? undefined
          : patientRow?.patient_category === "New"
            ? "New"
            : "Existing",
        patientStatus,
        consultKind: resolvedConsultKind,
        hasPriorClinicConsultation: (priorClinicAppointments?.length ?? 0) > 0,
      });
    }

    const supabase = getSupabaseAdmin();
    const { data: reservation, error } = await supabase
      .from("online_booking_reservations")
      .insert({
        patient_id: patientId,
        doctor_id: doctorUuid,
        appointment_type: type,
        appointment_date: date,
        start_time,
        end_time,
        queue_number: queueNumber,
        reason: reason ?? "",
        amount,
        status: "Pending",
      })
      .select()
      .single();
    if (error) throw error;

    try {
      await enqueueNotification({
        user_id: patientId,
        template: "appointment_booked",
        channels: ["email"],
        payload: {
          reservation_id: reservation.id,
          appointment_date: reservation.appointment_date,
          start_time: reservation.start_time,
          end_time: reservation.end_time,
          amount: reservation.amount,
          status: reservation.status,
        },
      });
    } catch (notifyErr) {
      console.error("Failed to enqueue reservation notification", notifyErr);
    }

    return ok({ reservation });
  } catch (e) {
    return httpError(e);
  }
}
