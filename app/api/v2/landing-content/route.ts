import { httpError, ok, requireActor } from "@/src/lib/http";
import { revalidatePath } from "next/cache";
import {
  getLandingContent,
  updateLandingContent,
  type LandingContentInput,
} from "@/src/lib/services/landing-content";

// GET — public. The landing page calls this without a session, so we
// intentionally do NOT require an actor. RLS allows public read on the
// table (see migrations/20260508_landing_content.sql).
export async function GET() {
  try {
    const content = await getLandingContent();
    return ok({ content });
  } catch (e) {
    return httpError(e);
  }
}

// PATCH — auth + role check inside updateLandingContent (super_admin or
// doctor). Whitelists writable columns; never touches id/updated_at.
export async function PATCH(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as LandingContentInput;
    const content = await updateLandingContent(body, actor);
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/register");
    return ok({ content });
  } catch (e) {
    return httpError(e);
  }
}
