import { NextResponse } from "next/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await readSystemSettings();
    return NextResponse.json({
      doctorSignatureDataUrl: settings.doctorSignatureDataUrl || "",
    });
  } catch (error) {
    console.error("default-doctor-signature error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load doctor signature." },
      { status: 500 },
    );
  }
}
