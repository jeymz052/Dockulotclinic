import { httpError, ok, requireActor } from "@/src/lib/http";
import { signProcedureConsentAsStaff } from "@/src/lib/services/procedure-consent";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const body = await req.json().catch(() => null) as { signature?: string } | null;
    const consent = await signProcedureConsentAsStaff(actor, id, body?.signature ?? "");
    return ok({ consent });
  } catch (error) {
    return httpError(error);
  }
}
