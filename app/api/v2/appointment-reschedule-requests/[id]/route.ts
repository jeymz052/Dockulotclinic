import { httpError, ok, requireActor } from "@/src/lib/http";
import { reviewRescheduleRequest } from "@/src/lib/services/reschedule-requests";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = await req.json();
    const result = await reviewRescheduleRequest(id, body, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
