import { httpError, ok, requireActor } from "@/src/lib/http";
import {
  createRescheduleRequest,
  listRescheduleRequests,
} from "@/src/lib/services/reschedule-requests";
import type { AppointmentRescheduleRequestStatus } from "@/src/lib/db/types";

function readStatus(value: string | null): AppointmentRescheduleRequestStatus | "all" {
  if (value === "Approved" || value === "Rejected" || value === "Cancelled" || value === "all") {
    return value;
  }
  return "Pending";
}

export async function GET(req: Request) {
  try {
    const actor = await requireActor(req);
    const url = new URL(req.url);
    const requests = await listRescheduleRequests(actor, readStatus(url.searchParams.get("status")));
    return ok({ requests });
  } catch (e) {
    return httpError(e);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = await req.json();
    const request = await createRescheduleRequest(body, actor);
    return ok({ request }, 201);
  } catch (e) {
    return httpError(e);
  }
}
