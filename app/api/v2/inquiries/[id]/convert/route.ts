import { HttpError, httpError, isClinicStaff, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { resolveBookingPatientId, validateSharedSlotOrThrow } from "@/src/lib/server/appointments-store";
import { enqueueAppointmentTeamNotifications, enqueueNotification } from "@/src/lib/services/notification";

type ConvertPayload = {
  doctorId?: string;
  date?: string;
  startTime?: string;
  appointmentType?: "Clinic" | "Online";
  reason?: string;
};

type Ctx = { params: Promise<{ id: string }> };

type InquiryRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  inquiry_type: string | null;
  message: string;
  status: string;
  converted_appointment_id: string | null;
};

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function addOneHour(value: string) {
  const [hoursText, minutesText = "0", secondsText = "0"] = normalizeTime(value).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    throw new HttpError(400, "Invalid startTime");
  }
  const nextHours = (hours + 1) % 24;
  return `${String(nextHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const actor = await requireActor(req);
    if (!isClinicStaff(actor.profile.role)) throw new HttpError(403, "Forbidden");

    const { id } = await ctx.params;
    const body = (await req.json()) as ConvertPayload;
    if (!body.doctorId || !body.date || !body.startTime || !body.appointmentType) {
      throw new HttpError(400, "doctorId, date, startTime, and appointmentType are required");
    }

    const supabase = getSupabaseAdmin();
    const { data: inquiry, error: inquiryError } = await supabase
      .from("inquiries")
      .select("*")
      .eq("id", id)
      .single<InquiryRow>();
    if (inquiryError) throw inquiryError;

    if (inquiry.converted_appointment_id) {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", inquiry.converted_appointment_id)
        .maybeSingle();
      if (appointmentError) throw appointmentError;
      return ok({ inquiry, appointment, alreadyConverted: true });
    }

    if (!inquiry.email) {
      throw new HttpError(400, "This inquiry does not have an email address to convert into a patient record.");
    }

    const patientId = await resolveBookingPatientId(
      {
        email: inquiry.email,
        patientName: inquiry.name,
        phone: inquiry.phone ?? "",
      },
      { actorRole: actor.profile.role === "patient" ? "PATIENT" : undefined, actorUserId: actor.id },
    );

    const start_time = normalizeTime(body.startTime);
    const end_time = addOneHour(start_time);
    const reason = (body.reason ?? inquiry.message).trim();

    const { queueNumber } = await validateSharedSlotOrThrow({
      doctorUuid: body.doctorId,
      date: body.date,
      start_time,
      end_time,
      type: body.appointmentType,
      patientId,
    });

    let meetingLink: string | null = null;
    if (body.appointmentType === "Online") {
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("default_meeting_link")
        .maybeSingle<{ default_meeting_link: string | null }>();
      if (settingsError) throw settingsError;
      meetingLink = settings?.default_meeting_link?.trim() || null;
    }

    const { data: appointment, error: createError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        doctor_id: body.doctorId,
        appointment_date: body.date,
        start_time,
        end_time,
        appointment_type: body.appointmentType,
        reason,
        status: "Confirmed",
        queue_number: queueNumber,
        meeting_link: meetingLink,
      })
      .select()
      .single();
    if (createError) throw createError;

    const { error: updateError } = await supabase
      .from("inquiries")
      .update({
        status: "Closed",
        converted_appointment_id: appointment.id,
      })
      .eq("id", id);

    if (updateError) {
      await supabase.from("appointments").delete().eq("id", appointment.id);
      throw updateError;
    }

    try {
      await enqueueNotification({
        user_id: patientId,
        template: "appointment_confirmed",
        channels: ["email", "sms"],
        payload: {
          appointment_id: appointment.id,
          appointment_type: body.appointmentType,
          appointment_date: body.date,
          start_time,
          meeting_link: meetingLink,
        },
      });

      await enqueueAppointmentTeamNotifications({
        appointment_id: appointment.id,
        appointment_type: body.appointmentType,
        patient_user_id: patientId,
        patient_name: inquiry.name,
        appointment_date: body.date,
        start_time,
        doctor_user_id: body.doctorId,
        excludeUserIds: [patientId, actor.id],
        template: "appointment_staff_confirmed",
      });
    } catch (notificationError) {
      console.error("[inquiries] conversion notifications failed", notificationError);
    }

    return ok({ inquiry: { ...inquiry, status: "Closed", converted_appointment_id: appointment.id }, appointment });
  } catch (e) {
    return httpError(e);
  }
}
