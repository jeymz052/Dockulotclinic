import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, isStaff, type Actor } from "@/src/lib/http";
import { isProcedureServiceTitle, parseAppointmentContext } from "@/src/lib/appointment-context";
import type {
  Appointment,
  OnlineBookingReservation,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import {
  enqueueAppointmentTeamNotifications,
  enqueueNotification,
} from "@/src/lib/services/notification";
import {
  linkProcedureConsentToAppointment,
  upsertProcedureConsentForReservation,
  validateProcedureConsentPayload,
  type ProcedureConsentPayload,
} from "@/src/lib/services/procedure-consent";
import { ONLINE_CONSULTATION_FEE, PROCEDURE_DOWNPAYMENT_AMOUNT } from "@/src/lib/consultation-pricing";
import { createPayMongoCheckoutSession, mapCheckoutMethods } from "@/src/lib/services/paymongo";
import { finalizeInventorySaleForBilling } from "@/src/lib/services/billing";
import { createStripeCheckoutSessionForReservation } from "@/src/lib/services/stripe";
import { readSystemSettings } from "@/src/lib/server/clinic-store";
import {
  resolveBookingPatientId,
  resolveAssignedDoctorUuid,
  validateSharedSlotOrThrow,
  type AppointmentCreatePayload,
} from "@/src/lib/server/appointments-store";
import { addOneHourSql, normalizeSqlTime } from "@/src/lib/server/legacy-bridge";

const DEFAULT_MANUAL_TRANSFER_INSTRUCTIONS =
  "Send the transfer to the clinic's bank account, then wait for staff verification. Your appointment stays unconfirmed until payment is marked as paid.";
const FINALIZATION_WAIT_ATTEMPTS = 12;
const FINALIZATION_WAIT_MS = 250;

// All online consultation payments are processed by PayMongo:
//   - paymongo_gcash → QR Ph (currently routes everything via QR Ph; once
//                      PayMongo activates GCash on the merchant account it
//                      adds GCash alongside QR Ph — see paymongo.ts)
//   - paymongo_card  → Visa / Mastercard / JCB                  (pending activation)
//   - paymongo_bank  → Direct Online Banking (BPI, UBP, RCBC…)  (pending activation)
// `stripe_card` and `bank_transfer` (manual) remain in the union for backward
// compatibility with reservations created before the migration. New bookings
// from the UI must use a paymongo_* option.
export type OnlineCheckoutOption =
  | "paymongo_gcash"
  | "paymongo_card"
  | "paymongo_bank"
  | "stripe_card"
  | "bank_transfer";

// Source-of-truth list of checkout options patients can pick from the booking
// flow today. The UI hides the rest behind a "Not yet available" badge — this
// constant lets the server reject hand-crafted requests early with a clear
// 400 instead of bubbling a PayMongo 400 ("payment method is not enabled on
// this account"). Add an option back here once the corresponding PayMongo
// method is activated on the merchant account.
const ENABLED_NEW_BOOKING_OPTIONS: ReadonlySet<OnlineCheckoutOption> = new Set([
  "paymongo_gcash",
]);

export type OnlineCheckoutBookingInput = Pick<
  AppointmentCreatePayload,
  "patientName" | "email" | "phone" | "doctorId" | "date" | "start" | "reason" | "patientStatus" | "type"
>;

function resolveCheckoutAmount(input: OnlineCheckoutBookingInput & { service?: string }) {
  if (input.type === "Online") return ONLINE_CONSULTATION_FEE;
  if (input.type === "Clinic" && isProcedureServiceTitle(input.service)) {
    return PROCEDURE_DOWNPAYMENT_AMOUNT;
  }
  throw new HttpError(400, "Only online consultations or clinic procedure bookings can use online checkout.");
}

function describeCheckout(input: OnlineCheckoutBookingInput & { service?: string }) {
  if (input.type === "Online") {
    return {
      description: `Online consultation on ${input.date}`,
      lineItemName: "Online Consultation",
    };
  }

  const procedureName = input.service?.trim() || "Clinic procedure";
  return {
    description: `${procedureName} downpayment on ${input.date}`,
    lineItemName: `${procedureName} Downpayment`,
  };
}

// Resolve the meeting link for a freshly confirmed Online consultation.
// Strategy: read the clinic-wide default meeting link saved in
// system_settings.default_meeting_link. If the doctor hasn't configured one
// yet, return null — the appointment is still created, but the UI surfaces a
// "meeting link not set" hint and notifications gently tell the patient the
// link will arrive shortly.
//
// When we later swap to per-appointment auto-generated links (e.g. via the
// Google Calendar API), accept the Appointment as a parameter again.
async function resolveDefaultMeetingLink(): Promise<string | null> {
  const settings = await readSystemSettings();
  const link = settings.defaultMeetingLink?.trim() ?? "";
  return link.length > 0 ? link : null;
}

function paymentMethodFromProvider(provider: string): PaymentMethod {
  if (provider === "paymongo_card" || provider === "stripe" || provider === "stripe_card") return "Card";
  if (provider === "paymongo_gcash" || provider === "gcash" || provider === "qr") return "QR";
  // paymongo_bank (Direct Online Banking) and the legacy manual `bank_transfer`
  // both surface to staff/patients as a bank transfer record.
  return "BankTransfer";
}

function paymongoMethodGroup(option: OnlineCheckoutOption): "gcash" | "card" | "bank" {
  if (option === "paymongo_card" || option === "stripe_card") return "card";
  if (option === "paymongo_bank") return "bank";
  return "gcash";
}

function paymongoProviderTag(option: OnlineCheckoutOption): string {
  if (option === "paymongo_card") return "paymongo_card";
  if (option === "paymongo_bank") return "paymongo_bank";
  return "paymongo_gcash";
}

function isMissingReservationTypeColumn(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "PGRST204" && /appointment_type/i.test(error.message ?? "");
}

function coerceReservationType(
  reservation: OnlineBookingReservation,
  fallbackType: "Online" | "Clinic" = "Online",
): OnlineBookingReservation {
  return {
    ...reservation,
    appointment_type: reservation.appointment_type ?? fallbackType,
  };
}

function getManualTransferInstructions() {
  return process.env.ONLINE_BANK_TRANSFER_INSTRUCTIONS ?? DEFAULT_MANUAL_TRANSFER_INSTRUCTIONS;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPaymentByProviderRef(provider: string, providerRef: string): Promise<Payment | null> {
  const supabase = getSupabaseAdmin();
  const { data: exact, error: exactError } = await supabase
    .from("payments")
    .select("*")
    .eq("provider", provider)
    .eq("provider_ref", providerRef)
    .maybeSingle<Payment>();
  if (exactError) throw exactError;
  if (exact) return exact;

  if (provider !== "paymongo") return null;

  const { data: fallback, error: fallbackError } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_ref", providerRef)
    .maybeSingle<Payment>();
  if (fallbackError) throw fallbackError;
  return fallback ?? null;
}

function buildManualTransferReference(reservationId: string) {
  return `BT-${reservationId.slice(0, 8).toUpperCase()}`;
}

async function findReservationByPaymentRef(
  provider: string,
  provider_ref: string,
): Promise<OnlineBookingReservation | null> {
  const supabase = getSupabaseAdmin();

  const { data: exact, error: exactError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (exactError) throw exactError;
  if (exact) return coerceReservationType(exact);

  const { data: fallback, error: fallbackError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (fallbackError) throw fallbackError;
  return fallback ? coerceReservationType(fallback) : null;
}

function buildPaidBookingNotificationPayload(
  reservation: OnlineBookingReservation,
  appointment: Appointment,
  meetingLink: string | null,
) {
  const context = parseAppointmentContext(reservation.reason);
  const service = context.service || (reservation.appointment_type === "Online" ? "Telemedicine Services" : "Medical Procedure");
  const isProcedureReservation =
    reservation.appointment_type === "Clinic" && isProcedureServiceTitle(service);

  return {
    appointment_id: appointment.id,
    appointment_type: appointment.appointment_type,
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time,
    service,
    amount: reservation.amount,
    meeting_link: meetingLink,
    payment_purpose: isProcedureReservation ? "procedure_downpayment" : "online_consultation",
  };
}

async function notifyPaidBookingConfirmed(
  reservation: OnlineBookingReservation,
  appt: Appointment,
  meetingLink: string | null,
) {
  await enqueueNotification({
    user_id: appt.patient_id,
    template: "appointment_paid_and_confirmed",
    channels: ["email", "sms"],
    payload: buildPaidBookingNotificationPayload(reservation, appt, meetingLink),
  });
}

export async function createOnlineCheckoutSession(
  input: OnlineCheckoutBookingInput & {
    reservationId?: string;
    checkoutOption?: OnlineCheckoutOption;
    service?: string;
    procedureConsent?: ProcedureConsentPayload;
  },
  actor: Actor,
): Promise<{
  url: string | null;
  reservation: OnlineBookingReservation;
  checkoutMode: "redirect" | "manual";
  instructions?: string;
  paymentReference?: string;
}> {
  if (actor.profile.role !== "patient" && actor.profile.role !== "staff" && actor.profile.role !== "secretary" && actor.profile.role !== "super_admin" && actor.profile.role !== "admin") {
    throw new HttpError(403, "Forbidden");
  }

  // Stage logs make failures grep-able in production logs and turn the
  // generic "Internal error" the patient sees into a precise stack-of-stages
  // for the developer. Each line is prefixed `[online-checkout]` so it can
  // be filtered cleanly in Vercel.
  const logCtx = {
    actorId: actor.id,
    actorRole: actor.profile.role,
    date: input.date,
    start: input.start,
    type: input.type,
    checkoutOption: input.checkoutOption ?? "paymongo_gcash",
    reservationId: input.reservationId ?? null,
  };
  const stage = (name: string, extra: Record<string, unknown> = {}) => {
    console.info(`[online-checkout] ${name}`, { ...logCtx, ...extra });
  };
  stage("start");

  const doctorId = await resolveAssignedDoctorUuid(input.doctorId);
  stage("resolved-doctor", { doctorId });
  const patientId = await resolveBookingPatientId(input, {
    actorRole: actor.profile.role === "patient" ? "PATIENT" : undefined,
    actorUserId: actor.profile.role === "patient" ? actor.id : undefined,
  });
  stage("resolved-patient", { patientId });
  const start_time = normalizeSqlTime(input.start);
  const end_time = addOneHourSql(input.start);
  await getDoctor(doctorId);
  const amount = resolveCheckoutAmount(input);
  const { description, lineItemName } = describeCheckout(input);
  const procedureConsent = input.type === "Clinic" && isProcedureServiceTitle(input.service)
    ? validateProcedureConsentPayload(input.procedureConsent, input.patientName)
    : null;
  stage("computed-amount", { amount });

  const supabase = getSupabaseAdmin();
  const checkoutOption = input.checkoutOption ?? "paymongo_gcash";

  // Belt-and-suspenders for the activation rollout: the UI already disables
  // every option but `paymongo_gcash`, but a hand-crafted POST could still
  // smuggle in `paymongo_card` / `paymongo_bank` and would then 400 with a
  // confusing message from PayMongo. Reject early with a clear, user-facing
  // error and let the booking page show the "use QR Ph" hint.
  if (!ENABLED_NEW_BOOKING_OPTIONS.has(checkoutOption)) {
    throw new HttpError(
      400,
      "That payment method isn't available yet. Please choose QR Ph (it accepts GCash, Maya, and bank apps).",
    );
  }

  // If a reservationId was provided, reuse the existing reservation
  if (input.reservationId) {
    const { data: existing, error: existingErr } = await supabase
      .from("online_booking_reservations")
      .select("*")
      .eq("id", input.reservationId)
      .maybeSingle<OnlineBookingReservation>();
    if (existingErr) throw existingErr;
    if (!existing) throw new HttpError(404, "Reservation not found");
    const normalizedExisting = coerceReservationType(existing, input.type);
    if (normalizedExisting.status !== "Pending") throw new HttpError(409, "Reservation is not pending");
    const reservationMatchesBooking =
      normalizedExisting.patient_id === patientId
      && normalizedExisting.doctor_id === doctorId
      && normalizedExisting.appointment_date === input.date
      && normalizedExisting.start_time === start_time
      && normalizedExisting.end_time === end_time
      && normalizedExisting.appointment_type === input.type;
    if (!reservationMatchesBooking) {
      throw new HttpError(409, "Saved reservation no longer matches this booking. Please start over and choose the slot again.");
    }
    if (procedureConsent) {
      await upsertProcedureConsentForReservation({
        reservationId: existing.id,
        patientId,
        appointmentId: existing.appointment_id,
        consent: procedureConsent,
      });
    }

    try {
      if (checkoutOption === "bank_transfer") {
        const paymentReference = normalizedExisting.payment_ref ?? buildManualTransferReference(normalizedExisting.id);
        const { data: updated, error: updateError } = await supabase
          .from("online_booking_reservations")
          .update({
            payment_provider: "bank_transfer",
            payment_ref: paymentReference,
            status: "Pending",
          })
          .eq("id", normalizedExisting.id)
          .select()
          .single<OnlineBookingReservation>();
        if (updateError) throw updateError;

        return {
          url: null,
          reservation: coerceReservationType(updated, input.type),
          checkoutMode: "manual",
          instructions: getManualTransferInstructions(),
          paymentReference,
        };
      }

      if (checkoutOption === "stripe_card") {
        const checkout = await createStripeCheckoutSessionForReservation({
          reservation: existing,
          customerEmail: input.email,
        });

        const { data: updated, error: updateError } = await supabase
          .from("online_booking_reservations")
          .update({ payment_provider: "stripe", payment_ref: checkout.session.id })
          .eq("id", normalizedExisting.id)
          .select()
          .single<OnlineBookingReservation>();
        if (updateError) throw updateError;

        return {
          url: checkout.session.url,
          reservation: coerceReservationType(updated, input.type),
          checkoutMode: "redirect",
        };
      }

      const checkout = await createPayMongoCheckoutSession({
        description,
        amount: normalizedExisting.amount,
        customerEmail: input.email,
        customerName: input.patientName,
        customerPhone: input.phone,
        paymentMethods: mapCheckoutMethods(paymongoMethodGroup(checkoutOption)),
        successPath: `/appointments?reservation_paid=${encodeURIComponent(normalizedExisting.id)}`,
        metadata: { reservation_id: normalizedExisting.id },
        lineItemName,
      });

      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({
          payment_provider: paymongoProviderTag(checkoutOption),
          payment_ref: checkout.sessionId,
        })
        .eq("id", normalizedExisting.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: checkout.checkoutUrl,
        reservation: coerceReservationType(updated, input.type),
        checkoutMode: "redirect",
      };
    } catch (error) {
      if (checkoutOption !== "bank_transfer") {
        await supabase
          .from("online_booking_reservations")
          .update({ status: "Failed" })
          .eq("id", normalizedExisting.id);
      }
      throw error;
    }
  }

  // Otherwise create a new reservation as before
  stage("validating-slot");
  const { queueNumber } = await validateSharedSlotOrThrow({
    doctorUuid: doctorId,
    date: input.date,
    start_time,
    end_time,
    type: input.type,
    patientId,
  });
  stage("validated-slot", { queueNumber });

  const reservationInsert = {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_type: input.type,
      appointment_date: input.date,
      start_time,
      end_time,
      queue_number: queueNumber,
      reason: input.reason,
      amount,
      status: "Pending",
  };
  let { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .insert(reservationInsert)
    .select()
    .single<OnlineBookingReservation>();
  if (isMissingReservationTypeColumn(reservationError) && input.type === "Online") {
    const { appointment_type: _appointmentType, ...legacyReservationInsert } = reservationInsert;
    const retry = await supabase
      .from("online_booking_reservations")
      .insert(legacyReservationInsert)
      .select()
      .single<OnlineBookingReservation>();
    reservation = retry.data ? coerceReservationType(retry.data, "Online") : retry.data;
    reservationError = retry.error;
  }
  if (reservationError) {
    console.error("[online-checkout] reservation-insert-failed", {
      ...logCtx,
      error: reservationError.message,
      details: reservationError.details,
      hint: reservationError.hint,
      code: reservationError.code,
    });
    if (isMissingReservationTypeColumn(reservationError)) {
      throw new HttpError(
        500,
        "Medical procedure reservations need the latest database migration. Please apply the online_booking_reservations appointment_type migration in Supabase.",
      );
    }
    throw reservationError;
  }
  if (!reservation) throw new HttpError(500, "Reservation could not be created.");
  reservation = coerceReservationType(reservation, input.type);
  stage("inserted-reservation", { reservationId: reservation.id });
  if (procedureConsent) {
    await upsertProcedureConsentForReservation({
      reservationId: reservation.id,
      patientId,
      consent: procedureConsent,
    });
  }

  try {
    if (checkoutOption === "bank_transfer") {
      const paymentReference = buildManualTransferReference(reservation.id);
      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({
          payment_provider: "bank_transfer",
          payment_ref: paymentReference,
          status: "Pending",
        })
        .eq("id", reservation.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: null,
        reservation: updated,
        checkoutMode: "manual",
        instructions: getManualTransferInstructions(),
        paymentReference,
      };
    }

    if (checkoutOption === "stripe_card") {
      const checkout = await createStripeCheckoutSessionForReservation({
        reservation,
        customerEmail: input.email,
      });

      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({ payment_provider: "stripe", payment_ref: checkout.session.id })
        .eq("id", reservation.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;

      return {
        url: checkout.session.url,
        reservation: updated,
        checkoutMode: "redirect",
      };
    }

    const paymentMethods = mapCheckoutMethods(paymongoMethodGroup(checkoutOption));
    stage("calling-paymongo", { reservationId: reservation.id, paymentMethods });
    const checkout = await createPayMongoCheckoutSession({
      description,
      amount,
      customerEmail: input.email,
      customerName: input.patientName,
      customerPhone: input.phone,
      paymentMethods,
      successPath: `/appointments?reservation_paid=${encodeURIComponent(reservation.id)}`,
      metadata: { reservation_id: reservation.id },
      lineItemName,
    });
    stage("paymongo-session-created", { reservationId: reservation.id, sessionId: checkout.sessionId });

    const { data: updated, error: updateError } = await supabase
      .from("online_booking_reservations")
      .update({
        payment_provider: paymongoProviderTag(checkoutOption),
        payment_ref: checkout.sessionId,
      })
      .eq("id", reservation.id)
      .select()
      .single<OnlineBookingReservation>();
    if (updateError) throw updateError;

    return {
      url: checkout.checkoutUrl,
      reservation: updated,
      checkoutMode: "redirect",
    };
  } catch (error) {
    if (checkoutOption !== "bank_transfer") {
      await supabase.from("online_booking_reservations").update({ status: "Failed" }).eq("id", reservation.id);
    }
    throw error;
  }
}

export async function listOnlinePayments(
  actor: Actor,
  appointmentIds?: string[],
): Promise<Array<Payment & { appointment: Appointment | null }>> {
  const supabase = getSupabaseAdmin();
  let appointmentQuery = supabase
    .from("appointments")
    .select("*")
    .eq("appointment_type", "Online");

  if (actor.profile.role === "patient") {
    appointmentQuery = appointmentQuery.eq("patient_id", actor.id);
  }

  if (appointmentIds && appointmentIds.length > 0) {
    appointmentQuery = appointmentQuery.in("id", appointmentIds);
  }

  const { data: appointments, error: apptError } = await appointmentQuery;
  if (apptError) throw apptError;

  const onlineAppointments = (appointments ?? []) as Appointment[];
  const allowedIds = onlineAppointments.map((appointment) => appointment.id);
  if (allowedIds.length === 0) return [];

  const appointmentById = new Map(onlineAppointments.map((appointment) => [appointment.id, appointment]));
  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .in("appointment_id", allowedIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((payments ?? []) as Payment[]).map((payment) => ({
    ...payment,
    appointment: payment.appointment_id ? appointmentById.get(payment.appointment_id) ?? null : null,
  }));
}

async function confirmReservationPayment(
  reservation: OnlineBookingReservation,
): Promise<{ appointment: Appointment; payment: Payment }> {
  const supabase = getSupabaseAdmin();

  if (reservation.appointment_id) {
    const appt = await getAppointment(reservation.appointment_id);
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("appointment_id", reservation.appointment_id)
      .eq("provider", reservation.payment_provider ?? "paymongo")
      .eq("provider_ref", reservation.payment_ref ?? "")
      .maybeSingle<Payment>();
    if (!payment) throw new HttpError(404, "Payment not found");
    return { appointment: appt, payment };
  }

  await validateSharedSlotOrThrow({
    doctorUuid: reservation.doctor_id,
    date: reservation.appointment_date,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    type: reservation.appointment_type,
    patientId: reservation.patient_id,
    ignoreReservationId: reservation.id,
  });

  const { data: insertedAppointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      patient_id: reservation.patient_id,
      doctor_id: reservation.doctor_id,
      appointment_date: reservation.appointment_date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      appointment_type: reservation.appointment_type,
      status: "Confirmed",
      queue_number: reservation.queue_number,
      reason: reservation.reason,
    })
    .select()
    .single<Appointment>();
  if (appointmentError) throw appointmentError;
  await linkProcedureConsentToAppointment(reservation.id, insertedAppointment.id);

  const meetingLink = reservation.appointment_type === "Online"
    ? await resolveDefaultMeetingLink()
    : null;
  const updatedAppointment = meetingLink
    ? await (async () => {
      const { data, error: updateAppointmentError } = await supabase
        .from("appointments")
        .update({ meeting_link: meetingLink })
        .eq("id", insertedAppointment.id)
        .select()
        .single<Appointment>();
      if (updateAppointmentError) throw updateAppointmentError;
      return data;
    })()
    : insertedAppointment;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      appointment_id: updatedAppointment.id,
      amount: reservation.amount,
      method: paymentMethodFromProvider(reservation.payment_provider ?? "paymongo"),
      status: "Paid",
      provider: reservation.payment_provider ?? "paymongo",
      provider_ref: reservation.payment_ref,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single<Payment>();
  if (paymentError) throw paymentError;

  const { error: reservationError } = await supabase
    .from("online_booking_reservations")
    .update({
      status: "Converted",
      appointment_id: updatedAppointment.id,
    })
    .eq("id", reservation.id);
  if (reservationError) throw reservationError;

  await notifyPaidBookingConfirmed(reservation, updatedAppointment, meetingLink);
  await enqueueAppointmentTeamNotifications({
    appointment_id: updatedAppointment.id,
    appointment_type: updatedAppointment.appointment_type,
    patient_user_id: updatedAppointment.patient_id,
    appointment_date: updatedAppointment.appointment_date,
    start_time: updatedAppointment.start_time,
    doctor_user_id: updatedAppointment.doctor_id,
    excludeUserIds: [updatedAppointment.patient_id],
    template: "appointment_staff_confirmed",
  });

  return { appointment: updatedAppointment, payment };
}

async function findConvertedReservationPayment(
  reservationId: string,
  provider: string,
  providerRef: string,
): Promise<{ appointment: Appointment; payment: Payment } | null> {
  const supabase = getSupabaseAdmin();
  const { data: latest, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle<OnlineBookingReservation>();
  if (reservationError) throw reservationError;
  if (!latest?.appointment_id) return null;

  const payment = await findPaymentByProviderRef(provider, providerRef);
  if (!payment) return null;

  const appointment = await getAppointment(latest.appointment_id);
  return { appointment, payment };
}

async function waitForConvertedReservationPayment(
  reservationId: string,
  provider: string,
  providerRef: string,
): Promise<{ appointment: Appointment; payment: Payment } | null> {
  for (let attempt = 0; attempt < FINALIZATION_WAIT_ATTEMPTS; attempt += 1) {
    const result = await findConvertedReservationPayment(reservationId, provider, providerRef);
    if (result) return result;
    await sleep(FINALIZATION_WAIT_MS);
  }
  return null;
}

async function finalizeClinicBillingPayment(payment: Payment): Promise<Appointment | null> {
  if (!payment.billing_id) {
    return payment.appointment_id ? await getAppointment(payment.appointment_id) : null;
  }

  const supabase = getSupabaseAdmin();
  const { data: billing, error: billingError } = await supabase
    .from("billings")
    .select("id, appointment_id, status")
    .eq("id", payment.billing_id)
    .single<{ id: string; appointment_id: string | null; status: "Draft" | "Issued" | "Paid" | "Void" }>();
  if (billingError) throw billingError;

  if (billing.status !== "Paid") {
    const { error: updateBillingError } = await supabase
      .from("billings")
      .update({ status: "Paid" })
      .eq("id", billing.id);
    if (updateBillingError) throw updateBillingError;
  }

  await finalizeInventorySaleForBilling(billing.id, null);

  const appointmentId = payment.appointment_id ?? billing.appointment_id;
  if (!appointmentId) return null;

  const appt = await getAppointment(appointmentId);
  if (appt.status !== "Completed") {
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "Completed" })
      .eq("id", appt.id);
    if (apptUpdateError) throw apptUpdateError;
    return { ...appt, status: "Completed" };
  }

  return appt;
}

export async function confirmPaymentByRef(
  provider: string,
  provider_ref: string,
): Promise<{ appointment: Appointment | null; payment: Payment }> {
  const supabase = getSupabaseAdmin();
  const payment = await findPaymentByProviderRef(provider, provider_ref);
  if (payment) {
    if (payment.status === "Paid") {
      const appt = await finalizeClinicBillingPayment(payment);
      if (!appt) {
        const reservation = await findReservationByPaymentRef(provider, provider_ref);
        if (reservation) {
          const converted = await waitForConvertedReservationPayment(reservation.id, provider, provider_ref);
          if (converted) return converted;
        }
        throw new HttpError(409, "Payment is already being finalized. Please refresh your appointments in a few seconds.");
      }
      return { payment, appointment: appt };
    }

    const { data: paid, error: updateErr } = await supabase
      .from("payments")
      .update({ status: "Paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id)
      .select()
      .single<Payment>();
    if (updateErr) throw updateErr;

    const appt = await finalizeClinicBillingPayment(paid);
    if (!appt) {
      const reservation = await findReservationByPaymentRef(provider, provider_ref);
      if (reservation) {
        const converted = await waitForConvertedReservationPayment(reservation.id, provider, provider_ref);
        if (converted) return converted;
      }
      throw new HttpError(409, "Payment is already being finalized. Please refresh your appointments in a few seconds.");
    }
    return { payment: paid, appointment: appt };
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .maybeSingle<OnlineBookingReservation>();
  if (reservationError) throw reservationError;
  const resolvedReservation = reservation
    ? coerceReservationType(reservation)
    : await findReservationByPaymentRef(provider, provider_ref);
  if (!resolvedReservation) throw new HttpError(404, "Payment not found");

  if (resolvedReservation.appointment_id || resolvedReservation.status === "Converted") {
    return confirmReservationPayment(resolvedReservation);
  }

  if (resolvedReservation.status !== "Pending") {
    const converted = await waitForConvertedReservationPayment(resolvedReservation.id, provider, provider_ref);
    if (converted) return converted;
    throw new HttpError(409, "Payment is already being finalized. Please refresh your appointments in a few seconds.");
  }

  const { data: claimedReservation, error: claimError } = await supabase
    .from("online_booking_reservations")
    .update({ status: "Paid" })
    .eq("id", resolvedReservation.id)
    .eq("status", "Pending")
    .select()
    .maybeSingle<OnlineBookingReservation>();
  if (claimError) throw claimError;

  if (!claimedReservation) {
    const converted = await waitForConvertedReservationPayment(resolvedReservation.id, provider, provider_ref);
    if (converted) return converted;
    throw new HttpError(409, "Payment is already being finalized. Please refresh your appointments in a few seconds.");
  }

  return confirmReservationPayment(coerceReservationType(claimedReservation, resolvedReservation.appointment_type));
}

export async function failPaymentByRef(provider: string, provider_ref: string): Promise<Payment> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("provider", provider)
    .eq("provider_ref", provider_ref)
    .select()
    .maybeSingle<Payment>();
  if (error) throw error;

  if (data) {
    if (data.billing_id) {
      return data;
    }
    if (data.appointment_id) {
      const appt = await getAppointment(data.appointment_id);
      await enqueueNotification({
        user_id: appt.patient_id,
        template: "appointment_payment_failed",
        channels: ["email"],
        payload: { appointment_id: appt.id },
      });
      await enqueueAppointmentTeamNotifications({
        appointment_id: appt.id,
        appointment_type: appt.appointment_type,
        patient_user_id: appt.patient_id,
        appointment_date: appt.appointment_date,
        start_time: appt.start_time,
        doctor_user_id: appt.doctor_id,
        excludeUserIds: [appt.patient_id],
        template: "appointment_staff_payment_failed",
      });
    }
    return data;
  }

  const { data: reservation, error: reservationError } = await supabase
    .from("online_booking_reservations")
    .update({ status: "Failed" })
    .eq("payment_provider", provider)
    .eq("payment_ref", provider_ref)
    .select()
    .maybeSingle<OnlineBookingReservation>();
  if (reservationError) throw reservationError;

  const resolvedReservation = reservation
    ?? await (async () => {
      const fallback = await findReservationByPaymentRef(provider, provider_ref);
      if (!fallback) return null;
      const { data: updated, error: updateError } = await supabase
        .from("online_booking_reservations")
        .update({ status: "Failed" })
        .eq("id", fallback.id)
        .select()
        .single<OnlineBookingReservation>();
      if (updateError) throw updateError;
      return updated;
    })();
  if (!resolvedReservation) throw new HttpError(404, "Payment not found");

  await enqueueNotification({
    user_id: resolvedReservation.patient_id,
    template: "appointment_payment_failed",
    channels: ["email"],
    payload: {
      reservation_id: resolvedReservation.id,
      appointment_type: resolvedReservation.appointment_type,
      appointment_date: resolvedReservation.appointment_date,
      start_time: resolvedReservation.start_time,
      amount: resolvedReservation.amount,
      service: parseAppointmentContext(resolvedReservation.reason).service,
      payment_purpose:
        resolvedReservation.appointment_type === "Clinic"
        && isProcedureServiceTitle(parseAppointmentContext(resolvedReservation.reason).service)
          ? "procedure_downpayment"
          : "online_consultation",
    },
  });
  await enqueueAppointmentTeamNotifications({
    appointment_id: resolvedReservation.appointment_id ?? resolvedReservation.id,
    appointment_type: "Online",
    patient_user_id: resolvedReservation.patient_id,
    appointment_date: resolvedReservation.appointment_date,
    start_time: resolvedReservation.start_time,
    doctor_user_id: resolvedReservation.doctor_id,
    excludeUserIds: [resolvedReservation.patient_id],
    template: "appointment_staff_payment_failed",
  });

  if (!resolvedReservation.appointment_id) {
    return {
      id: `failed-${resolvedReservation.id}`,
      appointment_id: null,
      billing_id: null,
      amount: resolvedReservation.amount,
      method: paymentMethodFromProvider(resolvedReservation.payment_provider ?? provider),
      status: "Failed",
      provider: resolvedReservation.payment_provider ?? provider,
      provider_ref,
      paid_at: null,
      created_at: new Date().toISOString(),
      tendered_amount: null,
    };
  }

  const { data: syntheticPayment, error: syntheticError } = await supabase
    .from("payments")
    .insert({
      appointment_id: resolvedReservation.appointment_id,
      amount: resolvedReservation.amount,
      method: paymentMethodFromProvider(resolvedReservation.payment_provider ?? provider),
      status: "Failed",
      provider: resolvedReservation.payment_provider ?? provider,
      provider_ref,
    })
    .select()
    .single<Payment>();
  if (syntheticError) throw syntheticError;

  return syntheticPayment;
}

export async function confirmManualBankTransferReservation(
  reservationId: string,
  actor: Actor,
) {
  if (!isStaff(actor.profile.role)) {
    throw new HttpError(403, "Only clinic staff can confirm bank transfers.");
  }

  const supabase = getSupabaseAdmin();
  const { data: reservation, error } = await supabase
    .from("online_booking_reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle<OnlineBookingReservation>();
  if (error) throw error;
  if (!reservation) throw new HttpError(404, "Reservation not found");
  if (reservation.payment_provider !== "bank_transfer") {
    throw new HttpError(400, "Reservation is not awaiting bank transfer verification.");
  }
  if (!reservation.payment_ref) {
    throw new HttpError(400, "Reservation has no bank transfer reference.");
  }

  return confirmPaymentByRef("bank_transfer", reservation.payment_ref);
}

export async function reapUnpaidOnline(minutes = 30) {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("online_booking_reservations")
    .update({ status: "Expired" })
    .eq("status", "Pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export function verifyWebhookSignature(req: Request, rawBody: string): void {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(500, "PAYMENT_WEBHOOK_SECRET not configured");
  const signature = req.headers.get("x-webhook-signature");
  if (!signature) throw new HttpError(401, "Missing signature");

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature !== expected) throw new HttpError(401, "Invalid signature");
}
