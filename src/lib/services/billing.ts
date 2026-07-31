import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { HttpError, type Actor, isStaff } from "@/src/lib/http";
import type {
  Billing,
  BillingStatus,
  BillingItem,
  DiscountKind,
  Payment,
  PaymentMethod,
} from "@/src/lib/db/types";
import { getAppointment, getDoctor } from "@/src/lib/services/booking";
import { enqueueNotification } from "@/src/lib/services/notification";
import {
  FOLLOW_UP_CLINIC_CONSULTATION_FEE,
  NEW_PATIENT_CLINIC_CONSULTATION_FEE,
  formatDurationLabel,
  normalizeConfiguredClinicConsultationRate,
  resolveClinicConsultationFee,
} from "@/src/lib/consultation-pricing";
import { createPayMongoCheckoutSession, mapCheckoutMethods } from "@/src/lib/services/paymongo";

export type BillingItemInput = {
  pricing_id?: string | null;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

const ALLOWED_BILLING_STATUSES = new Set<BillingStatus>(["Draft", "Issued", "Paid", "Void"]);
const ALLOWED_DISCOUNT_KINDS = new Set<DiscountKind>(["None", "Manual", "SeniorCitizen", "PWD"]);

const POS_ALLOWED_CATEGORIES = new Set(["Consultation", "Lab", "Medicine", "Procedure", "Other"]);
const POS_ALLOWED_METHODS = new Set<PaymentMethod>(["Cash", "QR", "Card", "BankTransfer"]);

export type PosCheckoutOption = "paymongo_qr" | "paymongo_card" | "paymongo_bank";

const ENABLED_POS_CHECKOUT_OPTIONS: ReadonlySet<PosCheckoutOption> = new Set([
  "paymongo_qr",
]);

// RA 9994 / RA 10754: Senior Citizens and PWDs receive a 20% discount and
// are exempt from VAT on the same transaction. We round to centavos.
const SC_PWD_DISCOUNT_RATE = 0.2;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function posMethodFromCheckoutOption(option: PosCheckoutOption): PaymentMethod {
  if (option === "paymongo_card") return "Card";
  if (option === "paymongo_bank") return "BankTransfer";
  return "QR";
}

function posPaymongoMethodGroup(option: PosCheckoutOption): "gcash" | "card" | "bank" {
  if (option === "paymongo_card") return "card";
  if (option === "paymongo_bank") return "bank";
  return "gcash";
}

export async function finalizeInventorySaleForBilling(billingId: string, actorId: string | null) {
  const supabase = getSupabaseAdmin();
  const { data: saleItems, error: saleItemsError } = await supabase
    .from("billing_items")
    .select("id, product_id, quantity")
    .eq("billing_id", billingId)
    .not("product_id", "is", null);
  if (saleItemsError) throw saleItemsError;

  for (const item of saleItems ?? []) {
    if (!item.product_id) continue;

    const { data: existingMovement, error: existingMovementError } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("reference_table", "billing_items")
      .eq("reference_id", item.id as string)
      .eq("movement_type", "Sale")
      .maybeSingle<{ id: string }>();
    if (existingMovementError) throw existingMovementError;
    if (existingMovement) continue;

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("stock_qty")
      .eq("id", item.product_id)
      .single<{ stock_qty: number }>();
    if (productError) throw productError;

    const quantity = Number(item.quantity ?? 0);
    const currentStock = Number(product.stock_qty ?? 0);
    const nextStock = currentStock - quantity;
    if (nextStock < 0) {
      throw new HttpError(400, "One or more products no longer have enough stock for this POS sale.");
    }

    const { error: movementError } = await supabase.from("inventory_movements").insert({
      product_id: item.product_id,
      movement_type: "Sale",
      quantity,
      reference_table: "billing_items",
      reference_id: item.id as string,
      notes: `POS billing ${billingId.slice(0, 8).toUpperCase()}`,
      created_by: actorId,
    });
    if (movementError) throw movementError;

    const { error: updateStockError } = await supabase
      .from("inventory_products")
      .update({ stock_qty: nextStock })
      .eq("id", item.product_id);
    if (updateStockError) throw updateStockError;
  }
}

async function restockInventoryFromBilling(billingId: string, actorId: string | null) {
  const supabase = getSupabaseAdmin();
  const { data: saleMovements, error: saleMovementsError } = await supabase
    .from("inventory_movements")
    .select("id, product_id, quantity")
    .eq("movement_type", "Sale")
    .eq("reference_table", "billing_items")
    .like("notes", `POS billing ${billingId.slice(0, 8).toUpperCase()}%`);
  if (saleMovementsError) throw saleMovementsError;

  for (const movement of saleMovements ?? []) {
    if (!movement.product_id) continue;

    const { data: existingReturn, error: existingReturnError } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("movement_type", "Return")
      .eq("reference_table", "inventory_movements")
      .eq("reference_id", movement.id as string)
      .maybeSingle<{ id: string }>();
    if (existingReturnError) throw existingReturnError;
    if (existingReturn) continue;

    const { data: product, error: productError } = await supabase
      .from("inventory_products")
      .select("stock_qty")
      .eq("id", movement.product_id)
      .single<{ stock_qty: number }>();
    if (productError) throw productError;

    const quantity = Number(movement.quantity ?? 0);
    const nextStock = Number(product.stock_qty ?? 0) + quantity;

    const { error: movementError } = await supabase.from("inventory_movements").insert({
      product_id: movement.product_id,
      movement_type: "Return",
      quantity,
      reference_table: "inventory_movements",
      reference_id: movement.id as string,
      notes: `POS billing ${billingId.slice(0, 8).toUpperCase()} voided`,
      created_by: actorId,
    });
    if (movementError) throw movementError;

    const { error: updateStockError } = await supabase
      .from("inventory_products")
      .update({ stock_qty: nextStock })
      .eq("id", movement.product_id);
    if (updateStockError) throw updateStockError;
  }
}

export async function issueBilling(input: {
  appointment_id: string;
  items: BillingItemInput[];
  discount?: number;
  tax?: number;
  discount_kind?: DiscountKind;
  discount_id_number?: string | null;
}, actor: Actor): Promise<{ billing: Billing; items: BillingItem[] }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
    throw new HttpError(403, "Forbidden");

  const appt = await getAppointment(input.appointment_id);
  if (appt.appointment_type !== "Clinic")
    throw new HttpError(400, "POS billing is clinic-only");
  if (appt.status !== "InProgress" && appt.status !== "Completed")
    throw new HttpError(400, "Generate the clinic bill after consultation starts.");

  const supabase = getSupabaseAdmin();
  const { data: existingBilling } = await supabase
    .from("billings")
    .select("id, status")
    .eq("appointment_id", appt.id)
    .in("status", ["Draft", "Issued", "Paid"])
    .maybeSingle<{ id: string; status: BillingStatus }>();
  if (existingBilling) {
    throw new HttpError(400, "A clinic POS bill already exists for this appointment.");
  }

  const pricingIds = [...new Set(input.items.map((item) => item.pricing_id).filter((value): value is string => !!value))];
  const productIds = [...new Set(input.items.map((item) => item.product_id).filter((value): value is string => !!value))];
  if (input.items.some((item) => Number(Boolean(item.pricing_id)) + Number(Boolean(item.product_id)) !== 1)) {
    throw new HttpError(400, "Each POS line must use either one pricing item or one inventory product.");
  }

  const { data: pricingRows, error: pricingError } = await supabase
    .from("pricing")
    .select("id, name, category, price, is_active")
    .in("id", pricingIds);
  if (pricingError) throw pricingError;

  const { data: productRows, error: productError } = await supabase
    .from("inventory_products")
    .select("id, name, brand_name, dosage, category, selling_price, stock_qty, is_active")
    .in("id", productIds);
  if (productError) throw productError;

  const pricingById = new Map(
    (pricingRows ?? []).map((row) => [
      row.id as string,
      row as { id: string; name: string; category: string; price: number; is_active: boolean },
    ]),
  );
  const productById = new Map(
    (productRows ?? []).map((row) => [
      row.id as string,
      row as {
        id: string;
        name: string;
        brand_name: string | null;
        dosage: string | null;
        category: string;
        selling_price: number;
        stock_qty: number;
        is_active: boolean;
      },
    ]),
  );

  const normalizedItems = input.items.map((item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than zero.");
    }

    if (item.pricing_id) {
      const pricingItem = pricingById.get(item.pricing_id);
      if (!pricingItem || !pricingItem.is_active) {
        throw new HttpError(400, "One or more POS services are unavailable.");
      }
      if (!POS_ALLOWED_CATEGORIES.has(pricingItem.category)) {
        throw new HttpError(400, "POS only allows active clinic services and inventory products.");
      }

      return {
        pricing_id: pricingItem.id,
        product_id: null,
        description: pricingItem.name,
        quantity: item.quantity,
        unit_price: Number(pricingItem.price),
      };
    }

    if (!item.product_id) throw new HttpError(400, "Each POS line must use a clinic pricing item or inventory product.");
    const product = productById.get(item.product_id);
    if (!product || !product.is_active) {
      throw new HttpError(400, "One or more POS products are unavailable.");
    }
    if (Number(product.stock_qty ?? 0) < Number(item.quantity)) {
      throw new HttpError(400, `Not enough stock for ${product.brand_name ?? product.name}.`);
    }

    return {
      pricing_id: null,
      product_id: product.id,
      description: [product.brand_name ?? product.name, product.dosage].filter(Boolean).join(" - "),
      quantity: item.quantity,
      unit_price: Number(product.selling_price),
    };
  });
  const doctor = await getDoctor(appt.doctor_id);
  const { data: patientProfile, error: patientProfileError } = await supabase
    .from("patients")
    .select("patient_category")
    .eq("id", appt.patient_id)
    .maybeSingle<{ patient_category: "New" | "Regular" | "OldRecord" | null }>();
  if (patientProfileError) throw patientProfileError;
  const { data: priorClinicAppointments, error: priorClinicAppointmentsError } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", appt.patient_id)
    .eq("appointment_type", "Clinic")
    .not("status", "in", '("Cancelled","NoShow")')
    .neq("id", appt.id)
    .limit(1);
  if (priorClinicAppointmentsError) throw priorClinicAppointmentsError;

  const newPatientClinicRate = normalizeConfiguredClinicConsultationRate(
    Number(doctor.consultation_fee_clinic),
  );
  const consultationFee = resolveClinicConsultationFee({
    patientCategory: patientProfile?.patient_category ?? "New",
    hasPriorClinicConsultation: (priorClinicAppointments?.length ?? 0) > 0,
  }) === NEW_PATIENT_CLINIC_CONSULTATION_FEE
    ? newPatientClinicRate
    : FOLLOW_UP_CLINIC_CONSULTATION_FEE;
  const consultationLabel = consultationFee === FOLLOW_UP_CLINIC_CONSULTATION_FEE
    ? "Clinic consultation - Follow-up for returning new patient"
    : "Clinic consultation - First-time / new patient";
  const consultationLine = {
    pricing_id: null,
    product_id: null,
    description: `${consultationLabel} (${formatDurationLabel(appt.start_time, appt.end_time)})`,
    quantity: 1,
    unit_price: consultationFee,
  };

  const allItems = [consultationLine, ...normalizedItems];
  const subtotal = round2(allItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));

  // Resolve discount + tax from the discount_kind. SC/PWD overrides any
  // typed-in numbers so the cashier can't accidentally undercharge or
  // forget the VAT exemption.
  const discountKind: DiscountKind = input.discount_kind ?? "None";
  if (!ALLOWED_DISCOUNT_KINDS.has(discountKind)) {
    throw new HttpError(400, "Unknown discount kind.");
  }
  const discountIdNumber = (input.discount_id_number ?? "").trim() || null;
  if ((discountKind === "SeniorCitizen" || discountKind === "PWD") && !discountIdNumber) {
    throw new HttpError(400, `${discountKind === "PWD" ? "PWD" : "Senior Citizen"} ID number is required.`);
  }

  let resolvedDiscount = Number(input.discount ?? 0);
  let resolvedTax = Number(input.tax ?? 0);
  if (discountKind === "SeniorCitizen" || discountKind === "PWD") {
    resolvedDiscount = round2(subtotal * SC_PWD_DISCOUNT_RATE);
    resolvedTax = 0; // VAT-exempt
  } else {
    if (!Number.isFinite(resolvedDiscount) || resolvedDiscount < 0) {
      throw new HttpError(400, "Discount must be zero or greater.");
    }
    if (!Number.isFinite(resolvedTax) || resolvedTax < 0) {
      throw new HttpError(400, "Tax must be zero or greater.");
    }
    if (resolvedDiscount > subtotal) {
      throw new HttpError(400, "Discount cannot exceed the subtotal.");
    }
  }

  const { data: billing, error: billErr } = await supabase
    .from("billings")
    .insert({
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      subtotal,
      discount: resolvedDiscount,
      tax: resolvedTax,
      status: "Issued",
      issued_at: new Date().toISOString(),
      discount_kind: discountKind,
      discount_id_number: discountIdNumber,
    })
    .select()
    .single<Billing>();
  if (billErr) throw billErr;

  const { data: items, error: itemsErr } = await supabase
    .from("billing_items")
    .insert(
      allItems.map((i) => ({
        billing_id: billing.id,
        pricing_id: i.pricing_id ?? null,
        product_id: i.product_id ?? null,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    )
    .select();
  if (itemsErr) throw itemsErr;

  await enqueueNotification({
    user_id: appt.patient_id,
    template: "billing_issued",
    channels: ["email"],
    payload: { billing_id: billing.id, appointment_id: appt.id },
  });

  return { billing, items: items as BillingItem[] };
}

export async function recordBillingPayment(
  billingId: string,
  method: PaymentMethod,
  providerRef: string | null,
  actor: Actor,
  tenderedAmount: number | null = null,
): Promise<{ billing: Billing; payment: Payment }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor")
    throw new HttpError(403, "Only clinic staff or doctors can record POS payments");
  if (!POS_ALLOWED_METHODS.has(method))
    throw new HttpError(400, "POS only accepts Cash, QR, Transfer, or Card payments");

  const supabase = getSupabaseAdmin();
  const { data: billing, error } = await supabase
    .from("billings")
    .select("*")
    .eq("id", billingId)
    .single<Billing>();
  if (error) throw new HttpError(404, "Billing not found");
  if (billing.status === "Paid") throw new HttpError(400, "Billing already paid");
  if (billing.status === "Void") throw new HttpError(400, "Billing is void");
  if (!billing.appointment_id) throw new HttpError(400, "POS payment requires a clinic appointment billing.");

  const appt = await getAppointment(billing.appointment_id);
  if (appt.appointment_type !== "Clinic") {
    throw new HttpError(400, "POS payment is clinic-only.");
  }

  const normalizedProviderRef = providerRef?.trim() || null;
  if (method !== "Cash" && !normalizedProviderRef) {
    throw new HttpError(400, `${method === "Card" ? "Card" : "Transfer"} reference is required.`);
  }

  // Tendered amount only applies to cash. For Card/Transfer the patient
  // tendered exactly the total — anything else would be a card mistake.
  let normalizedTendered: number | null = null;
  if (method === "Cash" && tenderedAmount != null) {
    if (!Number.isFinite(tenderedAmount) || tenderedAmount < billing.total) {
      throw new HttpError(400, `Tendered amount must be at least ${billing.total.toFixed(2)}.`);
    }
    normalizedTendered = round2(tenderedAmount);
  }

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      billing_id: billing.id,
      appointment_id: billing.appointment_id,
      amount: billing.total,
      method,
      status: "Paid",
      paid_at: new Date().toISOString(),
      provider: "manual",
      provider_ref: normalizedProviderRef,
      tendered_amount: normalizedTendered,
    })
    .select()
    .single<Payment>();
  if (payErr) throw payErr;

  const { data: updated, error: updErr } = await supabase
    .from("billings")
    .update({ status: "Paid" })
    .eq("id", billing.id)
    .select()
    .single<Billing>();
  if (updErr) throw updErr;

  if (appt.status !== "Completed") {
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "Completed" })
      .eq("id", appt.id);
    if (apptUpdateError) throw apptUpdateError;
  }

  await finalizeInventorySaleForBilling(billing.id, actor.id);

  return { billing: updated, payment };
}

export async function startPosPayMongoCheckout(
  billingId: string,
  checkoutOption: PosCheckoutOption,
  actor: Actor,
): Promise<{ billing: Billing; payment: Payment; checkoutUrl: string }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor") {
    throw new HttpError(403, "Only clinic staff or doctors can start POS PayMongo checkout.");
  }
  if (!ENABLED_POS_CHECKOUT_OPTIONS.has(checkoutOption)) {
    throw new HttpError(
      400,
      checkoutOption === "paymongo_card"
        ? "Card payments are not yet activated on PayMongo. Please use QR Ph for now."
        : checkoutOption === "paymongo_bank"
          ? "Bank transfer is not yet activated on PayMongo. Please use QR Ph for now."
          : "This PayMongo POS option is not available yet.",
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: billing, error } = await supabase
    .from("billings")
    .select("*")
    .eq("id", billingId)
    .single<Billing>();
  if (error) throw new HttpError(404, "Billing not found");
  if (billing.status === "Paid") throw new HttpError(400, "Billing already paid");
  if (billing.status === "Void") throw new HttpError(400, "Billing is void");
  if (billing.status !== "Issued") throw new HttpError(400, "Issue the bill before starting PayMongo checkout.");
  if (!billing.appointment_id) throw new HttpError(400, "POS payment requires a clinic appointment billing.");

  const appt = await getAppointment(billing.appointment_id);
  if (appt.appointment_type !== "Clinic") {
    throw new HttpError(400, "POS PayMongo checkout is clinic-only.");
  }

  const { data: patient, error: patientError } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", billing.patient_id)
    .single<{ full_name: string; email: string; phone: string | null }>();
  if (patientError || !patient) {
    throw new HttpError(404, "Patient profile not found.");
  }

  await supabase
    .from("payments")
    .update({ status: "Failed" })
    .eq("billing_id", billing.id)
    .eq("provider", "paymongo")
    .eq("status", "Pending");

  const checkout = await createPayMongoCheckoutSession({
    description: `Clinic POS billing ${billing.id.slice(0, 8).toUpperCase()}`,
    amount: billing.total,
    customerEmail: patient.email,
    customerName: patient.full_name,
    customerPhone: patient.phone ?? undefined,
    paymentMethods: mapCheckoutMethods(posPaymongoMethodGroup(checkoutOption)),
    successPath: `/payments/pos?billing_paid=${encodeURIComponent(billing.id)}`,
    lineItemName: "Clinic POS Billing",
    metadata: {
      scope: "clinic_pos",
      billing_id: billing.id,
      appointment_id: billing.appointment_id,
      checkout_option: checkoutOption,
      intended_method: posMethodFromCheckoutOption(checkoutOption),
    },
  });

  const method = posMethodFromCheckoutOption(checkoutOption);
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      billing_id: billing.id,
      appointment_id: billing.appointment_id,
      amount: billing.total,
      method,
      status: "Pending",
      provider: "paymongo",
      provider_ref: checkout.sessionId,
    })
    .select()
    .single<Payment>();
  if (paymentError) throw paymentError;

  return {
    billing,
    payment,
    checkoutUrl: checkout.checkoutUrl,
  };
}

export async function listBillings(actor: Actor, filters: { patient_id?: string; status?: string }) {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("billings").select("*");
  if (actor.profile.role === "patient") q = q.eq("patient_id", actor.id);
  else if (filters.patient_id) q = q.eq("patient_id", filters.patient_id);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return data as Billing[];
}

export async function getBilling(id: string, actor: Actor) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("billings")
    .select("*, billing_items(*), payments(*)")
    .eq("id", id)
    .single();
  if (error) throw new HttpError(404, "Billing not found");
  const b = data as Billing & { billing_items: BillingItem[]; payments: Payment[] };
  if (actor.profile.role === "patient" && b.patient_id !== actor.id)
    throw new HttpError(403, "Forbidden");

  // Receipts need the patient's display name. patients.id is a 1:1 FK to
  // profiles.id, so we can resolve the name with a single profile lookup.
  const { data: patient } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", b.patient_id)
    .maybeSingle<{ full_name: string; email: string | null; phone: string | null }>();

  // Doctor info, derived through the linked appointment. Only present if the
  // billing is attached to an appointment (which clinic POS bills always are).
  // doctors.id is a 1:1 FK to profiles.id, so we can fetch the doctor row
  // and the corresponding profile in parallel using the same id.
  let doctor: { full_name: string; specialty: string } | null = null;
  if (b.appointment_id) {
    const { data: appt } = await supabase
      .from("appointments")
      .select("doctor_id")
      .eq("id", b.appointment_id)
      .maybeSingle<{ doctor_id: string }>();
    if (appt?.doctor_id) {
      const [{ data: doc }, { data: docProfile }] = await Promise.all([
        supabase
          .from("doctors")
          .select("specialty")
          .eq("id", appt.doctor_id)
          .maybeSingle<{ specialty: string }>(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", appt.doctor_id)
          .maybeSingle<{ full_name: string }>(),
      ]);
      if (docProfile) {
        doctor = {
          full_name: docProfile.full_name,
          specialty: doc?.specialty ?? "",
        };
      }
    }
  }

  return { ...b, patient: patient ?? null, doctor };
}

export async function updateBilling(
  id: string,
  input: {
    discount?: number;
    tax?: number;
    status?: BillingStatus;
    items?: BillingItemInput[];
  },
  actor: Actor,
) {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor") {
    throw new HttpError(403, "Forbidden");
  }

  const current = await getBilling(id, actor);
  const supabase = getSupabaseAdmin();
  if (current.status === "Paid") {
    throw new HttpError(400, "Paid bills can no longer be edited.");
  }

  const nextItems = (input.items ?? current.billing_items).map((item) => {
    const description = item.description.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);

    if (!description) throw new HttpError(400, "Each billing item needs a description.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new HttpError(400, "Quantity must be greater than zero.");
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new HttpError(400, "Unit price must be zero or greater.");
    }

    return {
      pricing_id: "pricing_id" in item ? item.pricing_id ?? null : null,
      product_id: "product_id" in item ? item.product_id ?? null : null,
      description,
      quantity,
      unit_price: unitPrice,
    };
  });

  const discount = input.discount != null ? Number(input.discount) : Number(current.discount);
  const tax = input.tax != null ? Number(input.tax) : Number(current.tax);
  if (!Number.isFinite(discount) || discount < 0) throw new HttpError(400, "Discount must be zero or greater.");
  if (!Number.isFinite(tax) || tax < 0) throw new HttpError(400, "Tax must be zero or greater.");

  const status = input.status ?? current.status;
  if (!ALLOWED_BILLING_STATUSES.has(status)) {
    throw new HttpError(400, "Invalid billing status.");
  }

  const subtotal = nextItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const { error: updateError } = await supabase
    .from("billings")
    .update({
      subtotal,
      discount,
      tax,
      status,
    })
    .eq("id", id);
  if (updateError) throw updateError;

  if (input.items) {
    const { error: deleteError } = await supabase.from("billing_items").delete().eq("billing_id", id);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("billing_items").insert(
      nextItems.map((item) => ({
        billing_id: id,
        pricing_id: item.pricing_id,
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    );
    if (insertError) throw insertError;
  }

  return getBilling(id, actor);
}

/**
 * Void a billing. Permitted for super_admin, admin, secretary (POS desk),
 * and the doctor on the appointment. If the bill is already Paid we also
 * record a `Refunded` payment so the books balance — same provider/method
 * as the most recent paid payment.
 *
 * The appointment is left as-is: the consultation already happened. If the
 * cashier needs the appointment status reversed, that's a separate concern.
 */
export async function voidBilling(
  id: string,
  reason: string,
  actor: Actor,
): Promise<{ billing: Billing; refundPayment: Payment | null }> {
  if (!isStaff(actor.profile.role) && actor.profile.role !== "doctor") {
    throw new HttpError(403, "Only clinic staff or doctors can void POS bills.");
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 4) {
    throw new HttpError(400, "Provide a void reason (at least 4 characters).");
  }

  const supabase = getSupabaseAdmin();
  const { data: billing, error } = await supabase
    .from("billings")
    .select("*")
    .eq("id", id)
    .single<Billing>();
  if (error) throw new HttpError(404, "Billing not found");
  if (billing.status === "Void") throw new HttpError(400, "Billing is already voided.");

  // If paid, insert a Refunded payment row mirroring the original tender so
  // the books reconcile. We pick the most recent Paid payment for method.
  let refundPayment: Payment | null = null;
  if (billing.status === "Paid") {
    const { data: lastPaid } = await supabase
      .from("payments")
      .select("*")
      .eq("billing_id", billing.id)
      .eq("status", "Paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle<Payment>();

    const { data: refunded, error: refundErr } = await supabase
      .from("payments")
      .insert({
        billing_id: billing.id,
        appointment_id: billing.appointment_id,
        amount: billing.total,
        method: lastPaid?.method ?? "Cash",
        status: "Refunded",
        paid_at: new Date().toISOString(),
        provider: "manual",
        provider_ref: `void:${id}`,
        tendered_amount: null,
    })
    .select()
    .single<Payment>();
    if (refundErr) throw refundErr;
    refundPayment = refunded;

    await restockInventoryFromBilling(billing.id, actor.id);
  }

  const { data: updated, error: updErr } = await supabase
    .from("billings")
    .update({
      status: "Void",
      voided_at: new Date().toISOString(),
      voided_by: actor.id,
      void_reason: trimmedReason,
    })
    .eq("id", billing.id)
    .select()
    .single<Billing>();
  if (updErr) throw updErr;

  return { billing: updated, refundPayment };
}
