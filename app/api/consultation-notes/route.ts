import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  type ConsultationNotesFilter,
  deleteConsultationNote,
  readConsultationNotes,
  upsertConsultationNote,
} from "@/src/lib/server/clinic-store";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return await requireAuthenticatedUser(token);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "consultations.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let filter: ConsultationNotesFilter = {};

  if (auth.role === "PATIENT") {
    filter = { patientId: auth.user.id };
  } else if (auth.role === "DOCTOR") {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", auth.user.id)
      .maybeSingle<{ id: string }>();

    if (!data) {
      return NextResponse.json({ data: [] });
    }

    filter = { doctorId: data.id };
  }

  return NextResponse.json({ data: await readConsultationNotes(filter) });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "consultations.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ data: await upsertConsultationNote(await request.json()) });
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "consultations.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing id" }, { status: 400 });
  }
  return NextResponse.json({ data: await deleteConsultationNote(id) });
}
