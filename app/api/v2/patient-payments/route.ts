import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/src/lib/supabase/server";
import { requireAuthenticatedUser } from "@/src/lib/auth/server-auth";
import { hasPermission } from "@/src/lib/auth/permissions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const user = token ? await requireAuthenticatedUser(token) : null;

    if (!user || !hasPermission(user.role, "patients.manage")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const patientId = form.get("patientId") as string;
    const amount = form.get("amount") as string;
    const method = (form.get("method") as string) || "Cash";
    const description = (form.get("description") as string) || "Clinical / Procedure Fee";
    const reference = (form.get("reference") as string) || "";
    const appointmentId = (form.get("appointmentId") as string) || null;
    const receiptFile = form.get("receiptFile");

    if (!patientId || !amount) {
      return NextResponse.json({ message: "patientId and amount are required." }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ message: "Amount must be a positive number." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    let receiptUrl: string | null = null;

    // Optional receipt image upload
    if (receiptFile instanceof File && receiptFile.size > 0) {
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `payment-receipts/${patientId}/${Date.now()}-receipt.${ext}`;
      const buffer = Buffer.from(await receiptFile.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from("landing-assets")
        .upload(path, buffer, {
          contentType: receiptFile.type || `image/${ext}`,
          upsert: true,
        });

      if (!uploadError) {
        const { data: pub } = admin.storage.from("landing-assets").getPublicUrl(path);
        receiptUrl = pub.publicUrl;
      }
    }

    const noteText = description ? `${description.trim()} (Ref: ${reference || "N/A"})` : `Manual Payment recorded. Ref: ${reference || "N/A"}`;

    // 1. Create a billing entry for this patient
    const { data: billing, error: billingError } = await admin
      .from("billings")
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId || null,
        subtotal: numAmount,
        discount: 0,
        tax: 0,
        total: numAmount,
        status: "Paid",
        issued_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (billingError) {
      return NextResponse.json({ message: billingError.message }, { status: 500 });
    }

    // 2. Add billing item
    await admin.from("billing_items").insert({
      billing_id: billing.id,
      description: description || "Clinical / Procedure Fee",
      quantity: 1,
      unit_price: numAmount,
      total_price: numAmount,
      item_type: "procedure",
    });

    // 3. Record payment
    const { data: payment, error: payError } = await admin
      .from("payments")
      .insert({
        billing_id: billing.id,
        appointment_id: appointmentId || null,
        amount: numAmount,
        method: method || "Cash",
        status: "Paid",
        provider: "Clinic POS / Manual",
        provider_ref: reference || null,
        tendered_amount: numAmount,
        paid_at: new Date().toISOString(),
      })
      .select("id, amount, method, status, paid_at, provider_ref")
      .single();

    if (payError) {
      return NextResponse.json({ message: payError.message }, { status: 500 });
    }

    // 4. If a receipt image was uploaded, also register it in patient_files so it's visible in EHR
    if (receiptUrl) {
      await admin.from("patient_files").insert({
        patient_id: patientId,
        appointment_id: appointmentId || null,
        file_name: `Payment Receipt - ₱${numAmount.toLocaleString()} (${method})`,
        file_url: receiptUrl,
        file_type: "Payment Receipt",
        document_metadata: {
          amount: numAmount,
          method,
          reference: reference || null,
          billing_id: billing.id,
          payment_id: payment.id,
          description,
        },
        visible_to_patient: true,
      });
    }

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        billingId: billing.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paid_at,
        reference: payment.provider_ref,
        receiptUrl,
        note: noteText,
      },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Error recording payment" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const user = token ? await requireAuthenticatedUser(token) : null;

    if (!user || !hasPermission(user.role, "patients.manage")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const paymentId = form.get("paymentId") as string | null;
    const billingId = form.get("billingId") as string | null;
    const patientId = form.get("patientId") as string | null;
    const fileId = form.get("fileId") as string | null;
    const amount = form.get("amount") as string;
    const method = (form.get("method") as string) || "Cash";
    const description = (form.get("description") as string) || "Clinical / Procedure Fee";
    const reference = (form.get("reference") as string) || "";
    const receiptFile = form.get("receiptFile");

    if (!amount) {
      return NextResponse.json({ message: "Amount is required." }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ message: "Amount must be a positive number." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    let newReceiptUrl: string | null = null;

    // Optional receipt image upload
    if (receiptFile instanceof File && receiptFile.size > 0 && patientId) {
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `payment-receipts/${patientId}/${Date.now()}-receipt.${ext}`;
      const buffer = Buffer.from(await receiptFile.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from("landing-assets")
        .upload(path, buffer, {
          contentType: receiptFile.type || `image/${ext}`,
          upsert: true,
        });

      if (!uploadError) {
        const { data: pub } = admin.storage.from("landing-assets").getPublicUrl(path);
        newReceiptUrl = pub.publicUrl;
      }
    }

    // 1. Update payment record if paymentId exists
    if (paymentId) {
      await admin
        .from("payments")
        .update({
          amount: numAmount,
          method,
          provider_ref: reference || null,
          tendered_amount: numAmount,
        })
        .eq("id", paymentId);
    }

    // 2. Update billing and billing_items if billingId exists
    if (billingId) {
      await admin
        .from("billings")
        .update({
          subtotal: numAmount,
          total: numAmount,
        })
        .eq("id", billingId);

      await admin
        .from("billing_items")
        .update({
          description,
          unit_price: numAmount,
          total_price: numAmount,
        })
        .eq("billing_id", billingId);
    }

    // 3. Update patient_files if fileId or (paymentId / billingId)
    if (fileId) {
      const updateData: Record<string, unknown> = {
        file_name: `Payment Receipt - ₱${numAmount.toLocaleString()} (${method})`,
        document_metadata: {
          amount: numAmount,
          method,
          reference: reference || null,
          description,
          payment_id: paymentId,
          billing_id: billingId,
        },
      };
      if (newReceiptUrl) {
        updateData.file_url = newReceiptUrl;
      }
      await admin.from("patient_files").update(updateData).eq("id", fileId);
    } else if (newReceiptUrl && patientId) {
      // If a new receipt was uploaded without existing fileId, insert it
      await admin.from("patient_files").insert({
        patient_id: patientId,
        file_name: `Payment Receipt - ₱${numAmount.toLocaleString()} (${method})`,
        file_url: newReceiptUrl,
        file_type: "Payment Receipt",
        document_metadata: {
          amount: numAmount,
          method,
          reference: reference || null,
          billing_id: billingId || null,
          payment_id: paymentId || null,
          description,
        },
        visible_to_patient: true,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Payment updated to ₱${numAmount.toLocaleString()} (${method}) successfully.`,
    });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "Error updating payment" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const user = token ? await requireAuthenticatedUser(token) : null;

    if (!user || !hasPermission(user.role, "patients.manage")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId") || searchParams.get("id");
    const billingId = searchParams.get("billingId");
    const fileId = searchParams.get("fileId");

    if (!paymentId && !billingId && !fileId) {
      return NextResponse.json({ message: "Missing paymentId, billingId, or fileId" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Delete associated patient_files (receipts)
    if (fileId) {
      await admin.from("patient_files").delete().eq("id", fileId);
    }
    if (paymentId) {
      await admin.from("patient_files").delete().contains("document_metadata", { payment_id: paymentId });
    }
    if (billingId) {
      await admin.from("patient_files").delete().contains("document_metadata", { billing_id: billingId });
    }

    // 2. Delete payment
    if (paymentId) {
      await admin.from("payments").delete().eq("id", paymentId);
    }

    // 3. Delete billing item & billing if no other payments exist
    if (billingId) {
      const { data: remainingPayments } = await admin
        .from("payments")
        .select("id")
        .eq("billing_id", billingId);

      if (!remainingPayments || remainingPayments.length === 0) {
        await admin.from("billing_items").delete().eq("billing_id", billingId);
        await admin.from("billings").delete().eq("id", billingId);
      }
    }

    return NextResponse.json({ ok: true, message: "Payment removed successfully." });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error deleting payment" },
      { status: 500 }
    );
  }
}
