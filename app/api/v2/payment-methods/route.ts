import { ok, requireActor, httpError } from "@/src/lib/http";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

export async function GET(req: Request) {
  try {
    await requireActor(req);
    const settings = await readSystemSettings();
    return ok({
      data: {
        onlinePaymentAccounts: settings.onlinePaymentAccounts,
      },
    });
  } catch (e) {
    return httpError(e);
  }
}
