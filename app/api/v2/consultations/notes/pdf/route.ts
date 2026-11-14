import { NextResponse } from "next/server";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import {
  createConsultationNotePdf,
  getConsultationNotePdfFilename,
  type ConsultationNotePdfRow,
} from "@/src/lib/services/consultation-note-pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ConsultationNotePdfRow;
    const settings = await readSystemSettings();

    const pdfBuffer = createConsultationNotePdf({
      ...payload,
      doctor_signature_data_url: settings.doctorSignatureDataUrl || undefined,
    });

    const filename = getConsultationNotePdfFilename(payload.patientName, payload.consultDate);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("consultation-note-pdf error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate consultation note PDF." },
      { status: 500 },
    );
  }
}
