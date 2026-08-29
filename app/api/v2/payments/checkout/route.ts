import { HttpError, httpError, ok, requireActor } from "@/src/lib/http";
import {
  createOnlineCheckoutSession,
  type OnlineCheckoutOption,
} from "@/src/lib/services/payment";
import type { ProcedureConsentPayload } from "@/src/lib/services/procedure-consent";

type BookingCheckoutBody = {
  patientName?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffixName?: string;
  dateOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  address?: string;
  religion?: string;
  occupation?: string;
  guardianName?: string;
  doctorId?: string;
  date?: string;
  start?: string;
  reason?: string;
  medical_certificate_requested?: boolean;
  type?: "Online" | "Clinic";
  patientStatus?: "New" | "Existing";
  service?: string;
  reservation_id?: string;
  payment_option?: OnlineCheckoutOption;
  payment_account_id?: string;
  procedure_consent?: ProcedureConsentPayload;
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
      firstName: body.firstName,
      middleName: body.middleName,
      lastName: body.lastName,
      suffixName: body.suffixName,
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
      civilStatus: body.civilStatus,
      address: body.address,
      religion: body.religion,
      occupation: body.occupation,
      guardianName: body.guardianName,
      doctorId: body.doctorId,
      date: body.date,
      start: body.start,
      reason: body.reason ?? "",
      medicalCertificateRequested: body.medical_certificate_requested ?? false,
      type: body.type,
      patientStatus: body.patientStatus,
      service: body.service,
      reservationId: body.reservation_id,
      checkoutOption: body.payment_option,
      paymentAccountId: body.payment_account_id,
      procedureConsent: body.procedure_consent,
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
