import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import { issueBilling, listBillings } from "@/src/lib/services/billing";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const url = new URL(req.url);
    const appointmentTypeParam = url.searchParams.get("appointment_type");
    const appointmentType =
      appointmentTypeParam === "Clinic" || appointmentTypeParam === "Online"
        ? appointmentTypeParam
        : undefined;
    if (appointmentTypeParam && !appointmentType) {
      throw new HttpError(400, "appointment_type must be Clinic or Online");
    }
    const billings = await listBillings(actor, {
      patient_id: url.searchParams.get("patient_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      appointment_type: appointmentType,
    });
    return ok({ billings });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = await req.json();
    if (!body.appointment_id) throw new HttpError(400, "appointment_id required");
    if (!Array.isArray(body.items)) throw new HttpError(400, "items[] required");
    const result = await issueBilling(body, actor);
    return ok(result, 201);
  } catch (e) {
    return httpError(e);
  }
}
