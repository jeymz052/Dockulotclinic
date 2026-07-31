import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import {
  createOnlineCheckoutSession,
  type OnlineCheckoutOption,
} from "@/src/lib/services/payment";

type BookingCheckoutBody = {
  patientName?: string;
  email?: string;
  phone?: string;
  doctorId?: string;
  date?: string;
  start?: string;
  reason?: string;
  type?: "Online" | "Clinic";
  patientStatus?: "New" | "Existing";
  service?: string;
  reservation_id?: string;
  payment_option?: OnlineCheckoutOption;
};

export async function POST(req: Request) {
  try {
    const actor = await requireActor(req);
    const body = (await req.json()) as BookingCheckoutBody;

    if (
      !body.type
      || !body.patientName
      || !body.email
      || !body.phone
      || !body.doctorId
      || !body.date
      || !body.start
    ) {
      throw new HttpError(400, "Booking payment details are required");
    }

    const result = await createOnlineCheckoutSession({
      patientName: body.patientName,
      email: body.email,
      phone: body.phone,
      doctorId: body.doctorId,
      date: body.date,
      start: body.start,
      reason: body.reason ?? "",
      type: body.type,
      patientStatus: body.patientStatus,
      service: body.service,
      reservationId: body.reservation_id,
      checkoutOption: body.payment_option,
    }, actor);

    return ok({
      url: result.url,
      reservation_id: result.reservation.id,
      checkout_mode: result.checkoutMode,
      instructions: result.instructions,
      payment_reference: result.paymentReference,
    }, 201);
  } catch (e) {
    return httpError(e);
  }
}
