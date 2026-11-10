import { NextResponse } from "next/server";
import { HttpError, httpError, ok } from "@/src/lib/http";
import { createPayMongoCheckoutSession } from "@/src/lib/services/paymongo";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";

type SaleCheckoutBody = {
  procedureId: string;
  procedureName: string;
  originalPrice: number;
  salePrice: number;
  patientName: string;
  email: string;
  phone: string;
  date: string;
  timeSlot: string;
};

// Sale buying period: Nov 11–14, 2026 PHT
const SALE_START = new Date("2026-11-11T00:00:00+08:00").getTime();
const SALE_END = new Date("2026-11-14T23:59:59+08:00").getTime();

function validateSaleCheckout(body: SaleCheckoutBody) {
  const now = Date.now();

  // Verify sale is active
  if (now < SALE_START || now > SALE_END) {
    throw new HttpError(400, "The 11.11 sale buying period is Nov 11–14, 2026 only.");
  }

  // Required fields
  if (
    !body.procedureId
    || !body.procedureName
    || !body.originalPrice
    || !body.salePrice
    || !body.patientName?.trim()
    || !body.email?.trim()
    || !body.phone?.trim()
    || !body.date
    || !body.timeSlot
  ) {
    throw new HttpError(400, "All fields are required.");
  }

  // Verify 11% discount calculation
  const expectedSalePrice = Math.round(body.originalPrice * 0.89);
  if (body.salePrice !== expectedSalePrice) {
    throw new HttpError(400, "Invalid sale price.");
  }

  // Verify date is Mon–Fri between Nov 11–30
  const dateObj = new Date(`${body.date}T00:00:00+08:00`);
  const day = dateObj.getDay();
  if (day < 1 || day > 5) {
    throw new HttpError(400, "Procedures can only be scheduled Monday to Friday.");
  }
  if (body.date < "2026-11-11" || body.date > "2026-11-30") {
    throw new HttpError(400, "Procedure must be scheduled between Nov 11–30, 2026.");
  }

  // Verify time slot is 09:00–14:00 (last slot starts at 14:00, ends 15:00)
  const validSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
  if (!validSlots.includes(body.timeSlot)) {
    throw new HttpError(400, "Invalid time slot. Available: 9 AM – 2 PM (1-hour slots).");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaleCheckoutBody;

    validateSaleCheckout(body);

    const supabase = getSupabaseAdmin();

    // Create the PayMongo checkout session
    const { sessionId, checkoutUrl } = await createPayMongoCheckoutSession({
      description: `11.11 Sale — ${body.procedureName}`,
      amount: body.salePrice,
      customerEmail: body.email.trim(),
      customerName: body.patientName.trim(),
      customerPhone: body.phone.trim(),
      paymentMethods: ["qrph"],
      successPath: `/sale/success?session_id=${encodeURIComponent("{SESSION_ID}")}&procedure=${encodeURIComponent(body.procedureName)}`,
      lineItemName: `11.11 Sale: ${body.procedureName}`,
      metadata: {
        sale_event: "1111_sale_2026",
        procedure_id: body.procedureId,
        procedure_name: body.procedureName,
        original_price: String(body.originalPrice),
        sale_price: String(body.salePrice),
        patient_name: body.patientName.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        schedule_date: body.date,
        schedule_time: body.timeSlot,
      },
    });

    // Store the sale booking in the database
    const endHour = parseInt(body.timeSlot.split(":")[0], 10) + 1;
    const endTime = `${String(endHour).padStart(2, "0")}:00`;

    await supabase.from("appointments").insert({
      patient_name: body.patientName.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      date: body.date,
      start_time: body.timeSlot,
      end_time: endTime,
      status: "Pending",
      type: "Clinic",
      reason: `11.11 Sale Purchase — ${body.procedureName}`,
      service: body.procedureName,
      notes: `11.11 SALE: Original ₱${body.originalPrice.toLocaleString()} → Sale ₱${body.salePrice.toLocaleString()} (11% OFF). PayMongo Session: ${sessionId}`,
      source: "online",
    });

    return ok({ checkoutUrl, sessionId }, 201);
  } catch (e) {
    return httpError(e);
  }
}
