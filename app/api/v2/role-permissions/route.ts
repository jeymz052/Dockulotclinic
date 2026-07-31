import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";

type RoleKey = "doctor" | "secretary" | "patient" | "super_admin";
type RolePermissions = Record<RoleKey, Record<string, boolean>>;

const ROLE_PERMISSIONS_PATH = path.join(
  process.cwd(),
  ".data",
  "role-permissions.json",
);

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

function defaultPermissions(): RolePermissions {
  return {
    doctor: {
      "appointments.manage": true,
      "patients.manage": true,
      "consultations.manage": true,
      "schedules.manage": true,
      "payments.pos": true,
      "inquiries.manage": true,
      "faq.manage": true,
      "landing.manage": true,
      "reports.read": true,
      "security.read": true,
      "users.manage": true,
    },
    secretary: {
      "appointments.manage": true,
      "patients.manage": true,
      "walkins.manage": true,
      "queue.manage": true,
      "billing.manage": true,
      "payments.pos": true,
      "inquiries.manage": true,
      "faq.manage": true,
      "landing.manage": true,
    },
    patient: {
      register_login: true,
      book_appointment: true,
      "portal.read": true,
      "prescriptions.read": true,
      "consultations.read": true,
      "billing.read": true,
      "files.read": true,
      "inquiries.create": true,
    },
    super_admin: {
      "appointments.manage": true,
      "patients.manage": true,
      "consultations.manage": true,
      "schedules.manage": true,
      "payments.pos": true,
      "inquiries.manage": true,
      "faq.manage": true,
      "landing.manage": true,
      "reports.read": true,
      "security.read": true,
      "users.manage": true,
      "settings.manage": true,
    },
  };
}

async function readPermissionsFile(): Promise<RolePermissions> {
  try {
    const raw = await readFile(ROLE_PERMISSIONS_PATH, "utf8");
    return JSON.parse(raw) as RolePermissions;
  } catch {
    return defaultPermissions();
  }
}

async function writePermissionsFile(payload: RolePermissions) {
  await mkdir(path.dirname(ROLE_PERMISSIONS_PATH), { recursive: true });
  await writeFile(ROLE_PERMISSIONS_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth || (auth.role !== "SUPER_ADMIN" && auth.role !== "DOCTOR")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const rolePermissions = await readPermissionsFile();
  return NextResponse.json({ rolePermissions });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || (auth.role !== "SUPER_ADMIN" && auth.role !== "DOCTOR")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { rolePermissions?: RolePermissions }
    | null;

  if (!body?.rolePermissions) {
    return NextResponse.json(
      { message: "Invalid payload. rolePermissions is required." },
      { status: 400 },
    );
  }

  await writePermissionsFile(body.rolePermissions);
  return NextResponse.json({ rolePermissions: body.rolePermissions });
}

