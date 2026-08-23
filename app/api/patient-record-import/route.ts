import { NextResponse } from "next/server";
import { hasPermission } from "@/src/lib/auth/permissions";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { importPatients, mapImportRows, parseCsv, parseXlsx } from "@/src/lib/patient-import";

async function authenticate(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? requireAuthenticatedUser(token) : null;
}

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

function isXlsxFile(file: File) {
  return /\.xlsx$/i.test(file.name)
    || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function isCsvFile(file: File) {
  return /\.csv$/i.test(file.name)
    || file.type === "text/csv"
    || file.type === "application/vnd.ms-excel";
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth || !hasPermission(auth.role, "patients.manage")) {
    return unauthorized();
  }

  const previewOnly = new URL(request.url).searchParams.get("preview") === "1";

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Upload a CSV or XLSX file." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ message: "File is too large. Use an 8MB or smaller CSV/XLSX file." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = isXlsxFile(file)
      ? parseXlsx(buffer)
      : isCsvFile(file)
        ? parseCsv(buffer.toString("utf8"))
        : null;

    if (!rows) {
      return NextResponse.json({ message: "Only CSV and XLSX imports are supported." }, { status: 400 });
    }

    const records = mapImportRows(rows);
    if (!records.length) {
      return NextResponse.json(
        { message: "No patient rows were found. Check that the sheet has Doc Kulot patient headers." },
        { status: 400 },
      );
    }

    if (previewOnly) {
      return NextResponse.json({
        preview: records.slice(0, 10),
        summary: {
          total: records.length,
          newCount: records.filter((record) => record.patientCategory === "New").length,
          existingCount: records.filter((record) => record.patientCategory === "Existing").length,
        },
      });
    }

    const result = await importPatients(records);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to import patient records." },
      { status: 400 },
    );
  }
}
