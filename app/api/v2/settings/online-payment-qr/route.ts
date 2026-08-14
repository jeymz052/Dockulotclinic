import { httpError, ok, requireActor, HttpError } from "@/src/lib/http";
import { uploadOnlinePaymentQr } from "@/src/lib/server/clinic-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "file is required");
    }

    return ok(await uploadOnlinePaymentQr(file, actor));
  } catch (e) {
    return httpError(e);
  }
}
