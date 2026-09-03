import { HttpError, httpError, ok } from "@/src/lib/http";
import type { ApptType } from "@/src/lib/db/types";
import {
  buildSharedDayAvailability,
  findNextAvailableSharedSlot,
} from "@/src/lib/services/appointment-availability";
import { resolveDoctorIdBySlug } from "@/src/lib/server/legacy-bridge";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctor_id");
    const date = searchParams.get("date");
    const typeParam = searchParams.get("type");
    const scanDays = Number(searchParams.get("scan_days") ?? "14");
    const slotMinutesParam = Number(searchParams.get("slot_minutes") ?? "20");

    if (!doctorId || !date || (typeParam !== "Clinic" && typeParam !== "Online")) {
      throw new HttpError(400, "doctor_id, date, and a valid type are required");
    }

    const type = typeParam as ApptType;
    const resolvedDoctorId = await resolveDoctorIdBySlug(doctorId);
    const slotMinutes = slotMinutesParam === 60 ? 60 : 20;
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
