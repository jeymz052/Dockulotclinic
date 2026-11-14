"use client";

import { useState, useRef } from "react";
import { FaMoneyBillWave, FaXmark, FaReceipt, FaImage, FaTrash } from "react-icons/fa6";
import Image from "next/image";

export type ExistingPaymentToEdit = {
  paymentId?: string;
  billingId?: string | null;
  fileId?: string | null;
  amount: number;
  method: string;
  description?: string;
  reference?: string | null;
  receiptUrl?: string | null;
};

type PaymentModalProps = {
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  accessToken: string | null;
  initialPayment?: ExistingPaymentToEdit | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function PatientPaymentModal({
  patientId,
  patientName,
  appointmentId,
  accessToken,
  initialPayment,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const isEditing = Boolean(initialPayment);
  const receiptFileRef = useRef<HTMLInputElement | null>(null);
  const [amount, setAmount] = useState<string>(initialPayment?.amount ? String(initialPayment.amount) : "");
  const [method, setMethod] = useState<string>(initialPayment?.method || "Cash");
  const [description, setDescription] = useState<string>(initialPayment?.description || "Clinical / Procedure Fee");
  const [reference, setReference] = useState<string>(initialPayment?.reference || "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(initialPayment?.receiptUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, WEBP) for the receipt.");
      return;
    }
    setError(null);
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  }

  function removeReceipt() {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (receiptFileRef.current) receiptFileRef.current.value = "";
  }

  async function handleDeletePayment() {
    if (!initialPayment) return;
    if (!confirm(`Are you sure you want to remove this payment of ₱${initialPayment.amount}?`)) return;
    if (!accessToken) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (initialPayment.paymentId) params.set("paymentId", initialPayment.paymentId);
      if (initialPayment.billingId) params.set("billingId", initialPayment.billingId);
      if (initialPayment.fileId) params.set("fileId", initialPayment.fileId);

      const res = await fetch(`/api/v2/patient-payments?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to remove payment.");
      onSuccess("Payment removed successfully.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!accessToken) {
      setError("Session expired. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (initialPayment?.paymentId) formData.append("paymentId", initialPayment.paymentId);
      if (initialPayment?.billingId) formData.append("billingId", initialPayment.billingId);
      if (initialPayment?.fileId) formData.append("fileId", initialPayment.fileId);
      formData.append("patientId", patientId);
      if (appointmentId) formData.append("appointmentId", appointmentId);
      formData.append("amount", amount);
      formData.append("method", method);
      formData.append("description", description);
      formData.append("reference", reference.trim());
      if (receiptFile) {
        formData.append("receiptFile", receiptFile);
      }

      const res = await fetch("/api/v2/patient-payments", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || (isEditing ? "Failed to update payment." : "Failed to record payment."));
      }

      if (isEditing) {
        onSuccess(data?.message || `Payment updated to ₱${Number(amount).toLocaleString()} (${method}) successfully!`);
      } else {
        onSuccess(`Payment of ₱${Number(amount).toLocaleString()} (${method}) recorded successfully!`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditing ? "Error updating payment." : "Error recording payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              {isEditing ? "Edit Payment Record" : "EHR Billing & POS"}
            </span>
            <h3 className="text-lg font-black text-neutral-900">
              {isEditing ? "Edit Payment Record" : "Record Patient Payment"}
            </h3>
            <p className="text-xs text-neutral-500">For patient: <strong className="text-neutral-700">{patientName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <FaXmark className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Amount (₱ PHP) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-neutral-400">₱</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-neutral-300 py-2 pl-8 pr-3 text-sm font-bold text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Payment Method *
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 py-2 px-3 text-xs font-bold text-neutral-800 outline-none focus:border-neutral-900"
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash / E-Wallet</option>
              <option value="QR">QR Ph</option>
              <option value="BankTransfer">Bank Transfer</option>
              <option value="Card">Debit / Credit Card</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Service / Procedure Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Laser Procedure, Consultation Fee, Medication..."
              className="w-full rounded-lg border border-neutral-300 py-2 px-3 text-xs text-neutral-800 outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Reference / OR Number (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. GCash Ref No., Receipt #10294"
              className="w-full rounded-lg border border-neutral-300 py-2 px-3 text-xs text-neutral-800 outline-none focus:border-neutral-900"
            />
          </div>

          {/* Receipt Image Upload */}
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3.5">
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Proof of Payment / Receipt Photo (Optional)
            </label>
            <input
              ref={receiptFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {receiptPreview ? (
              <div className="relative mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="relative h-32 w-full">
                  <Image
                    src={receiptPreview}
                    alt="Receipt preview"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-neutral-100 p-2 text-xs">
                  <span className="truncate font-medium text-neutral-600">{receiptFile?.name}</span>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline"
                  >
                    <FaTrash className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => receiptFileRef.current?.click()}
                className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white py-4 text-center transition hover:border-emerald-500 hover:bg-emerald-50/20"
              >
                <FaReceipt className="h-6 w-6 text-emerald-600" />
                <p className="mt-1.5 text-xs font-bold text-neutral-700">Attach receipt / transfer screenshot</p>
                <p className="text-[10px] text-neutral-400">PNG, JPG up to 10MB</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDeletePayment}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <FaTrash className="h-3 w-3" />
                Remove Payment
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !amount}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <FaMoneyBillWave className="h-3.5 w-3.5" />
                {isSubmitting ? (isEditing ? "Updating..." : "Recording...") : isEditing ? "Update Payment" : "Record Payment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
