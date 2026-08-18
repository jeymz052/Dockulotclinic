import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  readSystemSettings,
  saveSystemSettings,
} from "@/src/lib/server/clinic-store";

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "settings.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ data: await readSystemSettings() });
}

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth || !hasPermission(auth.role, "settings.read")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ data: await saveSystemSettings(await request.json()) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save settings." },
      { status: 500 },
    );
  }
}
