import { createHmac } from "node:crypto";
import { HttpError } from "@/src/lib/http";

const PAYMONGO_API = "https://api.paymongo.com/v1";

// Full list of PayMongo Checkout `payment_method_types` we may request.
// `dob` = Direct Online Banking (BPI, UnionBank, RCBC, Chinabank via Brankas).
// `qrph` = QR Ph standard, scannable by any InstaPay/Pesonet wallet or bank app.
export type PayMongoMethod =
  | "card"
  | "gcash"
  | "paymaya"
  | "grab_pay"
  | "qrph"
  | "dob"
  | "dob_ubp"
  | "billease"
  | "atome";

// Maps our high-level booking option to the PayMongo methods we send in
// `payment_method_types`. CRITICAL: PayMongo's Checkout API rejects the entire
// session creation with a 400 if ANY listed method is not activated on the
// merchant account. So we send a single, conservative primary method per group
// and let the user opt into extras once PayMongo finishes activation. The
// extras can be enabled via PAYMONGO_EXTRA_METHODS_GCASH / _CARD / _BANK
// env vars (comma-separated) — no code change needed when activation lands.
//
// CURRENT ACTIVATION STATUS (as of 2026-05):
//   - qrph         ✅ activated  (only method live on the merchant account)
//   - gcash        ⏳ pending
//   - card         ⏳ pending
//   - dob (bank)   ⏳ pending
//
// While only QR Ph is activated, every group falls back to `qrph` as the
// primary — QR Ph is universally scannable by GCash, Maya, and any
// InstaPay / Pesonet-enabled wallet or banking app, so the booking flow can
// always complete online payments without relying on the clinic's manual
// payment settings.
//
// When PayMongo activates the others, two things flip the experience back on:
//   1. Set the env vars to add the native method as an extra:
//        PAYMONGO_EXTRA_METHODS_GCASH = gcash
//        PAYMONGO_EXTRA_METHODS_CARD  = card
//        PAYMONGO_EXTRA_METHODS_BANK  = dob,dob_ubp
//   2. Optionally restore the native primary below (`gcash: "gcash"`, etc.)
//      so PayMongo highlights the dedicated button instead of the QR.
//   3. If the public booking flow ever exposes a method picker again,
//      reintroduce the native labels there.
export type CheckoutMethodGroup = "gcash" | "card" | "bank";

const PRIMARY_BY_GROUP: Record<CheckoutMethodGroup, PayMongoMethod> = {
  // While activation is pending, every group's primary is `qrph`. The native
  // PayMongo method names are kept in this file's type union so `extras` env
  // vars (and a simple primary swap) flip them on without a refactor.
  gcash: "qrph",
  card: "qrph",
  bank: "qrph",
};

function readExtraMethods(envName: string): PayMongoMethod[] {
  const raw = process.env[envName];
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is PayMongoMethod =>
      value.length > 0
      && (
        value === "card" || value === "gcash" || value === "paymaya"
        || value === "grab_pay" || value === "qrph" || value === "dob"
        || value === "dob_ubp" || value === "billease" || value === "atome"
      ),
    );
}

export function mapCheckoutMethods(group: CheckoutMethodGroup): PayMongoMethod[] {
  const primary = PRIMARY_BY_GROUP[group];
  const extras = readExtraMethods(`PAYMONGO_EXTRA_METHODS_${group.toUpperCase()}`);
  // De-dupe while preserving order; primary first so PayMongo highlights it.
  return Array.from(new Set([primary, ...extras]));
}

// Resolve the public app URL we hand to PayMongo for `success_url`. In
// development we prefer APP_URL_DEV (typically http://localhost:3000) so the
// post-payment bounce stays on the developer's machine — without this,
// localhost bookings would redirect to the production domain after paying
// and the local DB would never see the confirmation. In production
// (NODE_ENV=production on Vercel) we always use APP_URL.
function appUrl() {
  if (process.env.NODE_ENV !== "production" && process.env.APP_URL_DEV) {
    return process.env.APP_URL_DEV;
  }
  return process.env.APP_URL ?? "http://localhost:3000";
}

function getSecretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new HttpError(500, "PAYMONGO_SECRET_KEY not configured");
  return key;
}

function getBasicAuthHeader() {
  const token = Buffer.from(`${getSecretKey()}:`).toString("base64");
  return `Basic ${token}`;
}

function paymongoHeaders() {
  return {
    Authorization: getBasicAuthHeader(),
    "Content-Type": "application/json",
  };
}

export async function createPayMongoCheckoutSession(input: {
  description: string;
  amount: number;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethods: PayMongoMethod[];
  successPath: string;
  metadata?: Record<string, string>;
  lineItemName?: string;
}) {
  const response = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: paymongoHeaders(),
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            email: input.customerEmail,
            name: input.customerName ?? "Clinic Patient",
            phone: input.customerPhone ?? undefined,
          },
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: input.description,
          line_items: [
            {
              currency: "PHP",
              amount: Math.round(input.amount * 100),
              description: input.description,
              name: input.lineItemName ?? "Virtual Consult",
              quantity: 1,
            },
          ],
          payment_method_types: input.paymentMethods,
          success_url: `${appUrl()}${input.successPath}`,
          metadata: input.metadata ?? {},
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    // PayMongo error bodies look like:
    //   { "errors": [ { "code": "...", "detail": "human readable" } ] }
    // Pull the first detail so the patient sees "Payment method qrph is not
    // enabled on this account" instead of a 200-character JSON blob.
    let detail = message;
    try {
      const parsed = JSON.parse(message) as {
        errors?: Array<{ code?: string; detail?: string }>;
      };
      const firstDetail = parsed.errors?.[0]?.detail;
      if (firstDetail) detail = firstDetail;
    } catch {
      // Not JSON — fall back to raw text.
    }
    console.error("[paymongo] checkout-session error", {
      status: response.status,
      methods: input.paymentMethods,
      raw: message,
    });
    throw new HttpError(
      response.status === 400 ? 400 : 502,
      `PayMongo: ${detail || `HTTP ${response.status}`}`,
    );
  }

  const body = (await response.json()) as {
    data?: {
      id: string;
      attributes?: {
        checkout_url?: string;
      };
    };
  };

  const sessionId = body.data?.id;
  const checkoutUrl = body.data?.attributes?.checkout_url;
  if (!sessionId || !checkoutUrl) {
    throw new HttpError(500, "PayMongo checkout session response was incomplete.");
  }

  return { sessionId, checkoutUrl };
}

export function verifyPayMongoSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(500, "PAYMONGO_WEBHOOK_SECRET not configured");
  if (!signatureHeader) throw new HttpError(401, "Missing Paymongo-Signature header");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((piece) => {
      const [key, value] = piece.split("=");
      return [key.trim(), value?.trim() ?? ""];
    }),
  );

  const timestamp = parts.t;
  const provided = parts.li || parts.te;
  if (!timestamp || !provided) throw new HttpError(401, "Malformed Paymongo-Signature header");

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (expected !== provided) throw new HttpError(401, "Invalid PayMongo signature");
}
