import { httpError, ok, requireActor, HttpError } from "@/src/lib/http";
import { uploadLandingImage } from "@/src/lib/services/landing-content";

// POST /api/v2/landing-content/upload
// Multipart form: { kind: landing image kind, file: <image> }
// Returns { url } — caller then PATCHes /landing-content with that URL.
//
// Kept as two requests (upload then PATCH) so a failed save doesn't leave
// orphan rows pointing at a missing image, and a successful upload can be
// previewed before commit.
export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const form = await req.formData();
    const kindRaw = String(form.get("kind") ?? "");
    const file = form.get("file");
    const allowedKinds = new Set([
      "hero-bg",
      "hero-slide",
      "doctor-photo",
      "program-photo",
      "result-before",
      "result-after",
      "result-single",
    ]);

    if (!allowedKinds.has(kindRaw)) {
      throw new HttpError(400, "Unsupported landing image kind");
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, "file is required");
    }

    const result = await uploadLandingImage(kindRaw as Parameters<typeof uploadLandingImage>[0], file, actor);
    return ok(result);
  } catch (e) {
    return httpError(e);
  }
}
