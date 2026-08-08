"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

type OnlinePaymentRecord = {
  id: string;
  appointment_id: string | null;
  amount: number;
  method: "GCash" | "QR" | "Card" | "BankTransfer";
  status: "Pending" | "Paid" | "Failed";
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  paid_at: string | null;
};

function peso(amount: number) {
  return `PHP ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMethod(method: OnlinePaymentRecord["method"]) {
  if (method === "BankTransfer") return "Transfer";
  if (method === "GCash") return "GCash";
  return method;
}

function statusTone(status: OnlinePaymentRecord["status"]) {
  if (status === "Paid") return "bg-neutral-50 text-neutral-700";
  if (status === "Failed") return "bg-neutral-50 text-neutral-700";
  return "bg-neutral-50 text-neutral-700";
}

export default function OnlinePaymentPage() {
  const { accessToken } = useRole();
  const { appointments, error } = useAppointments();
  const [payments, setPayments] = useState<OnlinePaymentRecord[]>([]);

  const onlineAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.type === "Online"),
    [appointments],
  );

  const appointmentById = useMemo(
    () => new Map(onlineAppointments.map((appointment) => [appointment.id, appointment])),
    [onlineAppointments],
  );

  const paidCount = payments.filter((payment) => payment.status === "Paid").length;
  const pendingCount = payments.filter((payment) => payment.status === "Pending").length;
  const failedCount = payments.filter((payment) => payment.status === "Failed").length;

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadPayments() {
      const url = new URL("/api/v2/payments", window.location.origin);
      onlineAppointments.forEach((appointment) => {
        url.searchParams.append("appointment_id", appointment.id);
      });

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;

      const payload = (await res.json()) as { payments: OnlinePaymentRecord[] };
      if (active) {
        setPayments(payload.payments);
      }
    }

    void loadPayments();
    return () => {
      active = false;
    };
  }, [accessToken, onlineAppointments]);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-200 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),linear-gradient(135deg,#111111_0%,#1f1f1f_46%,#111111_100%)] p-6 text-white shadow-[0_28px_70px_rgba(17,17,17,0.18)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-100">Payments</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Online Payment Records</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-50/85">
              Quickly review payment status and move to history, POS billing, or the appointment queue.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Shortcut href="/payments/history" label="History" />
              <Shortcut href="/payments/pos" label="POS Billing" />
              <Shortcut href="/appointments/list" label="Appointments" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Paid" value={String(paidCount)} />
            <HeroMetric label="Pending" value={String(pendingCount)} />
            <HeroMetric label="Failed" value={String(failedCount)} />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{error}</div>
      ) : null}

      <section className="rounded-4xl border border-neutral-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Recent online payments</h2>
          </div>
          <Link
            href="/payments/history"
            className="rounded-full bg-[linear-gradient(135deg,#111111,#111111)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(17,17,17,0.22)] transition hover:-translate-y-0.5"
          >
            View Payment History
          </Link>
        </div>

        <div className="space-y-4">
          {payments.length > 0 ? (
            payments.map((payment) => {
              const appointment = payment.appointment_id ? appointmentById.get(payment.appointment_id) ?? null : null;
              const doctor = appointment ? getDoctorById(appointment.doctorId) : null;

              return (
                <div key={payment.id} className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {appointment?.patientName ?? "Online consultation"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {appointment
                          ? `${doctor?.name ?? "Assigned doctor"} | ${formatDisplayDate(appointment.date)} | ${formatRange(appointment.start, appointment.end)}`
                          : "Reservation payment"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                      <p className="mt-1 font-semibold text-slate-900">{peso(payment.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Method</p>
                      <p className="mt-1">{formatMethod(payment.method)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Created</p>
                      <p className="mt-1">{new Date(payment.created_at).toLocaleString("en-US")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Paid At</p>
                      <p className="mt-1">{payment.paid_at ? new Date(payment.paid_at).toLocaleString("en-US") : "Not paid"}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No online payment records yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-100">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
    >
      {label}
    </Link>
  );
}


