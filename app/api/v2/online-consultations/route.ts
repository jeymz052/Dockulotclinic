import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type UploadedFilePayload = {
  file_name: string;
  file_type: string;
  file_url: string;
};

const MAX_CONCERN_FILES = 3;
const MAX_CONCERN_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function estimateDataUrlSizeBytes(dataUrl: string) {
  const match = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const base64 = match[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function mapAppointmentStatusToOnlineStatus(status: string): "Pending" | "Confirmed" | "InProgress" | "Completed" | "Cancelled" {
  if (status === "Completed") return "Completed";
  if (status === "In Progress" || status === "InProgress") return "InProgress";
  if (status === "Cancelled") return "Cancelled";
  if (status === "Confirmed") return "Confirmed";
  return "Pending";
}

function resolveMeetingPlatform(meetingLink: string | null): string {
  if (!meetingLink) return "Video Call";
  try {
    const host = new URL(meetingLink).hostname.toLowerCase();
    if (host.includes("zoom")) return "Zoom";
    if (host.includes("meet.google") || host.includes("google.com")) return "Google Meet";
    return "Video Call";
  } catch {
    return "Video Call";
  }
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const appointmentId = url.searchParams.get("appointment_id");

    if (actor.profile.role === "patient") {
      const { data: appointmentIds, error: appointmentError } = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", actor.id)
        .eq("appointment_type", "Online");
      if (appointmentError) throw appointmentError;
      const ids = (appointmentIds ?? []).map((row) => row.id as string);
      if (ids.length === 0) return ok({ consultations: [] });

      let query = supabase
        .from("online_consultations")
        .select("*")
        .in("appointment_id", ids)
        .order("created_at", { ascending: false });
      if (appointmentId) query = query.eq("appointment_id", appointmentId);

      const { data, error } = await query;
      if (error) throw error;
      const consultations = data ?? [];
      if (consultations.length === 0) return ok({ consultations: [] });
      const appointmentIdsForSymptoms = consultations.map((row) => row.appointment_id as string);
      const { data: appointmentRows } = await supabase
        .from("appointments")
        .select("id, symptoms")
        .in("id", appointmentIdsForSymptoms);
      const symptomByAppointmentId = new Map(
        (appointmentRows ?? []).map((row) => [row.id as string, row.symptoms as string | null]),
      );
      return ok({
        consultations: consultations.map((row) => ({
          ...row,
          symptoms: symptomByAppointmentId.get(row.appointment_id as string) ?? null,
        })),
      });
    }

    if (actor.profile.role !== "doctor" && actor.profile.role !== "super_admin" && actor.profile.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    let query = supabase
      .from("online_consultations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (appointmentId) query = query.eq("appointment_id", appointmentId);

    const { data, error } = await query;
    if (error) throw error;
    const consultations = data ?? [];
    if (consultations.length === 0) return ok({ consultations: [] });
    const appointmentIdsForSymptoms = consultations.map((row) => row.appointment_id as string);
    const { data: appointmentRows } = await supabase
      .from("appointments")
      .select("id, symptoms")
      .in("id", appointmentIdsForSymptoms);
    const symptomByAppointmentId = new Map(
      (appointmentRows ?? []).map((row) => [row.id as string, row.symptoms as string | null]),
    );
    return ok({
      consultations: consultations.map((row) => ({
        ...row,
        symptoms: symptomByAppointmentId.get(row.appointment_id as string) ?? null,
      })),
    });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as {
      appointment_id?: string;
      concern?: string;
      symptoms?: string;
      files?: UploadedFilePayload[];
    };

    if (!body.appointment_id) {
      throw new HttpError(400, "appointment_id required");
    }

    const supabase = getSupabaseAdmin();
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type, status, meeting_link")
      .eq("id", body.appointment_id)
      .single<{
        id: string;
        patient_id: string;
        appointment_type: string;
        status: string;
        meeting_link: string | null;
      }>();
    if (appointmentError) throw appointmentError;
    if (appointment.appointment_type !== "Online") {
      throw new HttpError(400, "Only virtual consult appointments can use this module.");
    }
    if (actor.profile.role === "patient" && appointment.patient_id !== actor.id) {
      throw new HttpError(403, "Forbidden");
    }
    if (actor.profile.role !== "patient"
      && actor.profile.role !== "doctor"
      && actor.profile.role !== "super_admin"
      && actor.profile.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const files = (body.files ?? [])
      .filter((file) => file.file_name && file.file_url)
      .map((file) => ({
        file_name: String(file.file_name).trim(),
        file_type: String(file.file_type ?? "attachment").trim(),
        file_url: String(file.file_url).trim(),
      }));

    if (files.length > MAX_CONCERN_FILES) {
      throw new HttpError(400, `You can upload up to ${MAX_CONCERN_FILES} concern files or photos.`);
    }

    for (const file of files) {
      const sizeBytes = estimateDataUrlSizeBytes(file.file_url);
      if (sizeBytes != null && sizeBytes > MAX_CONCERN_FILE_SIZE_BYTES) {
        throw new HttpError(400, `${file.file_name} is too large. Please keep each file under 10 MB.`);
      }
    }

    const concern = String(body.concern ?? "").trim();
    const symptoms = String(body.symptoms ?? "").trim();

    const { data: existing, error: existingError } = await supabase
      .from("online_consultations")
      .select("id")
      .eq("appointment_id", appointment.id)
      .maybeSingle<{ id: string }>();
    if (existingError) throw existingError;

    const payload = {
      appointment_id: appointment.id,
      concern: concern || null,
      file_urls: files,
      platform: resolveMeetingPlatform(appointment.meeting_link),
      meeting_link: appointment.meeting_link,
      status: mapAppointmentStatusToOnlineStatus(appointment.status),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("online_consultations")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("online_consultations")
        .insert(payload);
      if (error) throw error;
    }

    const { error: symptomError } = await supabase
      .from("appointments")
      .update({ symptoms: symptoms || null })
      .eq("id", appointment.id);
    if (symptomError) throw symptomError;

    if (files.length > 0) {
      const { error: filesError } = await supabase
        .from("patient_files")
        .insert(
          files.map((file) => ({
            patient_id: appointment.patient_id,
            appointment_id: appointment.id,
            file_name: file.file_name,
            file_url: file.file_url,
            file_type: file.file_type || "attachment",
            visible_to_patient: true,
          })),
        );
      if (filesError) throw filesError;
    }

    const { data, error } = await supabase
      .from("online_consultations")
      .select("*")
      .eq("appointment_id", appointment.id)
      .single();
    if (error) throw error;

    return ok({ consultation: data });
  } catch (e) {
    return httpError(e);
  }
}
