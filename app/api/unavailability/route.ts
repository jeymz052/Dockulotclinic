import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import {
  addDoctorUnavailability,
  deleteDoctorUnavailability,
  readDoctorUnavailability,
  updateDoctorUnavailability,
} from "@/src/lib/server/clinic-store";

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "schedules.read")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  } 

  return NextResponse.json({ data: await readDoctorUnavailability() });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "schedules.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const payload = await request.json();
  return NextResponse.json({ data: await addDoctorUnavailability(payload) });
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "schedules.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing id" }, { status: 400 });
  }
  return NextResponse.json({ data: await deleteDoctorUnavailability(id) });
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "schedules.manage")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as
    | ({ id: string } & Parameters<typeof updateDoctorUnavailability>[1])
    | null;
  if (!payload?.id) {
    return NextResponse.json({ message: "Missing id" }, { status: 400 });
  }
  return NextResponse.json({
    data: await updateDoctorUnavailability(payload.id, {
      doctorId: payload.doctorId,
      date: payload.date,
      reason: payload.reason,
      note: payload.note,
      affectedType: payload.affectedType,
    }),
  });
}
