import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import {
  canReadAppointment,
  cancelAppointment,
  getAppointment,
} from "@/src/lib/services/booking";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const appt = await getAppointment(id);
    if (!canReadAppointment(appt, actor)) throw new HttpError(403, "Forbidden");
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { reason?: string };
    const appt = await cancelAppointment(id, actor, body.reason);
    return ok({ appointment: appt });
  } catch (e) {
    return httpError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    await params;
    throw new HttpError(410, "Clinic appointment approval is no longer used. Clinic bookings are confirmed immediately.");
  } catch (e) {
    return httpError(e);
  }
}
