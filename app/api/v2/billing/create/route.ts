import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { createClinicBilling } from "@/src/lib/services/pos-billing";

/**
 * POST /api/v2/billing/create
 * 
 * Create a billing record for a clinic appointment
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await requireAuthenticatedUser(token);
    if (!hasPermission(user.role, "payments.pos")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const result = await createClinicBilling(body);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      billing: result.billing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[billing/create]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
