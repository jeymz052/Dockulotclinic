import { HttpError, httpError, requireActor } from "@/src/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    await requireActor(req);
    await params;
    throw new HttpError(410, "POS billing accepts cash payments only.");
  } catch (e) {
    return httpError(e);
  }
}
