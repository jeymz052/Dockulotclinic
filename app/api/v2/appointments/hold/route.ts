import { httpError, ok, getActor } from "@/src/lib/http";
import { assertTrustedOrigin, enforceRateLimit } from "@/src/lib/security";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { resolveBookingPatientId, validateSharedSlotOrThrow, resolveAssignedDoctorUuid } from "@/src/lib/server/appointments-store";
import { addOneHourSql, normalizeSqlTime } from "@/src/lib/server/legacy-bridge";
import {
  ONLINE_CONSULTATION_FEE,
  resolveClinicConsultationFee,
} from "@/src/lib/consultation-pricing";
import { enqueueNotification } from "@/src/lib/services/notification";

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
      doctorId, // optional, legacy uses assigned doctor
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
    const start_time = normalizeSqlTime(start);
    const end_time = addOneHourSql(start);

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
      amount = ONLINE_CONSULTATION_FEE;
    } else {
      const { data: patientRow } = await getSupabaseAdmin()
        .from("patients")
        .select("patient_category")
        .eq("id", patientId)
        .maybeSingle<{ patient_category: "New" | "Regular" | "OldRecord" | null }>();
      const { data: priorClinicAppointments } = await getSupabaseAdmin()
        .from("appointments")
        .select("id")
        .eq("patient_id", patientId)
        .eq("appointment_type", "Clinic")
        .not("status", "in", '("Cancelled","NoShow")')
        .limit(1);
      amount = resolveClinicConsultationFee({
        patientCategory: patientRow?.patient_category ?? undefined,
        patientStatus,
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

    // Notify patient by email; SMS is reserved for paid confirmations and 24h reminders.
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
