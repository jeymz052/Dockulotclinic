"use client";

import Link from "next/link";
import { PaymentHistoryModule } from "@/src/components/payments/PaymentHistoryModule";

export default function PaymentHistoryPage() {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-700">Payments</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Payment History</h1>
        </div>
        <Link
          href="/payments"
          className="rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50"
        >
          Back to Payments
        </Link>
      </div>

      <PaymentHistoryModule />
    </div>
  );
}

