import { httpError, ok, requireActor } from "@/src/lib/http";
import { listProcedureConsents } from "@/src/lib/services/procedure-consent";

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const url = new URL(req.url);
    const consents = await listProcedureConsents(actor, {
      patientId: url.searchParams.get("patient_id"),
      appointmentId: url.searchParams.get("appointment_id"),
    });

    return ok({ consents });
  } catch (e) {
    return httpError(e);
  }
}
