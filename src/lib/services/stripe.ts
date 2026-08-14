import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import type { Appointment, OnlineBookingReservation, Payment } from "@/src/lib/db/types";
import { HttpError } from "@/src/lib/http";
import { formatDurationLabel } from "@/src/lib/consultation-pricing";

/**
 * Thin wrapper around Stripe Checkout Sessions.
 * We call the REST API directly (no SDK) to keep dependencies minimal.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       - sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET   - whsec_... (set in the Stripe webhook config)
 *   APP_URL                 - base URL (e.g. https://clinic.example.com)
 */

const STRIPE_API = "https://api.stripe.com/v1";

function requireKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new HttpError(500, "STRIPE_SECRET_KEY not configured");
  return key;
}

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

type StripeCheckoutSession = {
  id: string;
  url: string;
  payment_intent: string | null;
};

export async function createStripeCheckoutSession(input: {
  appointment: Appointment;
  amount: number;
  customerEmail: string;
}): Promise<{ session: StripeCheckoutSession; payment: Payment }> {
  const key = requireKey();
  const base = appUrl();

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${base}/appointments?paid=${input.appointment.id}`);
  body.set("cancel_url", `${base}/appointments?cancelled=${input.appointment.id}`);
  body.set("customer_email", input.customerEmail);
  body.set("client_reference_id", input.appointment.id);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "php");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amount * 100)));
  body.set(
    "line_items[0][price_data][product_data][name]",
    `Virtual Consult (${formatDurationLabel(input.appointment.start_time, input.appointment.end_time)}) - ${input.appointment.appointment_date}`,
  );
  body.set("metadata[appointment_id]", input.appointment.id);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new HttpError(500, `Stripe error: ${res.status} ${msg}`);
  }

  const session = (await res.json()) as StripeCheckoutSession;

  // Record the intent in our DB
  const supabase = getSupabaseAdmin();
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      appointment_id: input.appointment.id,
      amount: input.amount,
      method: "Card",
      status: "Pending",
      provider: "stripe",
      provider_ref: session.id,
    })
    .select()
    .single<Payment>();
  if (error) throw error;

  return { session, payment };
}

export async function createStripeCheckoutSessionForReservation(input: {
  reservation: OnlineBookingReservation;
  customerEmail: string;
}): Promise<{ session: StripeCheckoutSession }> {
  const key = requireKey();
  const base = appUrl();

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${base}/appointments?reservation_paid=${input.reservation.id}`);
  body.set("cancel_url", `${base}/appointments?reservation_cancelled=${input.reservation.id}`);
  body.set("customer_email", input.customerEmail);
  body.set("client_reference_id", input.reservation.id);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "php");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(input.reservation.amount * 100)));
  body.set(
    "line_items[0][price_data][product_data][name]",
    `Virtual Consult (${formatDurationLabel(input.reservation.start_time, input.reservation.end_time)}) - ${input.reservation.appointment_date}`,
  );
  body.set("metadata[reservation_id]", input.reservation.id);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new HttpError(500, `Stripe error: ${res.status} ${msg}`);
  }

  const session = (await res.json()) as StripeCheckoutSession;
  return { session };
}

/**
 * Verify a Stripe webhook using raw body + signature header.
 * Returns the parsed event or throws.
 * Uses manual HMAC verification (no SDK).
 */
export async function verifyStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(500, "STRIPE_WEBHOOK_SECRET not configured");
  if (!signatureHeader) throw new HttpError(401, "Missing Stripe-Signature");

  const parts = signatureHeader.split(",").map((s) => s.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sig = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !sig) throw new HttpError(401, "Malformed Stripe-Signature");

  const crypto = await import("node:crypto");
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (expected !== sig) throw new HttpError(401, "Invalid Stripe signature");

  return JSON.parse(rawBody);
}

export function idempotencyKey() {
  return randomUUID();
}
