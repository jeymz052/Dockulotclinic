"use client";

import Link from "next/link";
import {
  FaCalendarDays,
  FaCreditCard,
  FaFileSignature,
  FaReceipt,
  FaVideo,
} from "react-icons/fa6";
import { DashboardHero, MetricCard, SectionCard, ActionCard } from "@/src/components/dashboard/dashboard-ui";

export default function PaymentsPage() {
  return (
    <div className="space-y-6 pb-8">
      <DashboardHero
        eyebrow="Payments"
        title="Online Payments"
        description="Use this page to reach the payment steps for virtual consults and procedure downpayments. Completed transactions and receipts stay in Payment History."
        summary="Pay before your visit"
        accent="sky"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          href="/appointments"
          label="Virtual Consult"
          value="Pay"
          helper="Start the booking flow for a paid online consultation"
          tone="sky"
          icon={<FaVideo className="text-2xl" />}
        />
        <MetricCard
          href="/appointments"
          label="Procedure Downpayment"
          value="Pay"
          helper="Complete the required downpayment during booking"
          tone="teal"
          icon={<FaFileSignature className="text-2xl" />}
        />
        <MetricCard
          href="/payments/history"
          label="Receipts"
          value="Open"
          helper="Review paid transactions and download receipts"
          tone="cyan"
          icon={<FaReceipt className="text-2xl" />}
        />
      </div>

      <SectionCard
        title="Choose a payment path"
        description="The clinic collects online payments through the booking flow, so this page points you to the right starting point instead of repeating the same history table twice."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ActionCard
            href="/appointments"
            title="Pay for Virtual Consult"
            description="Book the online consult, then complete payment in the same flow."
            tone="sky"
            icon={<FaVideo className="text-lg" />}
          />
          <ActionCard
            href="/appointments"
            title="Pay Procedure Downpayment"
            description="Start the procedure booking and settle the downpayment there."
            tone="teal"
            icon={<FaFileSignature className="text-lg" />}
          />
          <ActionCard
            href="/payments/history"
            title="Open Receipts"
            description="See your payment history, posted balances, and receipt downloads."
            tone="cyan"
            icon={<FaCreditCard className="text-lg" />}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="What counts here"
        description="This area is for paid online consults and procedure downpayments only. It is not a monthly bill or subscription screen."
        actionLabel="View payment history"
        actionHref="/payments/history"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Virtual consult</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Pay for telemedicine visits before the consultation begins.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Procedure downpayment</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Settle the required downpayment when a procedure booking is created.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Receipts</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Open your paid transaction records from the receipt ledger.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Payment history</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Review past payment status, balances, and posted clinic receipts.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/appointments"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          <FaCalendarDays className="h-4 w-4" aria-hidden="true" />
          Start booking
        </Link>
        <Link
          href="/payments/history"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          <FaCreditCard className="h-4 w-4" aria-hidden="true" />
          View history
        </Link>
      </div>
    </div>
  );
}
