import { HttpError, httpError, ok } from "@/src/lib/http";
import type { ApptType } from "@/src/lib/db/types";
import {
  buildSharedDayAvailability,
  findNextAvailableSharedSlot,
} from "@/src/lib/services/appointment-availability";
import { resolveDoctorIdBySlug } from "@/src/lib/server/legacy-bridge";
import {
  CONSULTATION_SLOT_MINUTES,
  PROCEDURE_SLOT_MINUTES,
  VIRTUAL_CONSULTATION_SLOT_MINUTES,
} from "@/src/lib/clinic-schedule";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctor_id");
    const date = searchParams.get("date");
    const typeParam = searchParams.get("type");
    const scanDays = Number(searchParams.get("scan_days") ?? "14");
    const rawSlotMinutes = searchParams.get("slot_minutes");

    if (!doctorId || !date || (typeParam !== "Clinic" && typeParam !== "Online")) {
      throw new HttpError(400, "doctor_id, date, and a valid type are required");
    }

    const type = typeParam as ApptType;
    const resolvedDoctorId = await resolveDoctorIdBySlug(doctorId);
    const parsedMinutes = rawSlotMinutes ? Number(rawSlotMinutes) : null;
    const slotMinutes = type === "Online"
      ? VIRTUAL_CONSULTATION_SLOT_MINUTES
      : parsedMinutes === 60
        ? PROCEDURE_SLOT_MINUTES
        : CONSULTATION_SLOT_MINUTES;

    const current = await buildSharedDayAvailability(resolvedDoctorId, date, type, { slotMinutes });
    const nextAvailable = await findNextAvailableSharedSlot(resolvedDoctorId, date, type, scanDays, { slotMinutes });

    return ok({
      doctorId,
      date,
      type,
      slots: current.slots,
      blockedReason: current.blockedReason,
      nextAvailable,
    });
  } catch (error) {
    return httpError(error);
  }
}
