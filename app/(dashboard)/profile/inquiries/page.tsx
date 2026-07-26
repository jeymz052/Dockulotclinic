"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaPaperPlane, FaRegMessage } from "react-icons/fa6";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { useRole } from "@/src/components/layout/RoleProvider";
import { formatDisplayDate, formatRange } from "@/src/lib/appointments";

type FollowUpInquiry = {
  id: string;
  appointment_id: string | null;
  message: string;
  reply: string | null;
  status: "Pending" | "Replied" | "Closed";
  created_at: string;
  updated_at: string;
};

export default function PatientFollowUpInquiriesPage() {
  const { accessToken } = useRole();
  const { appointments } = useAppointments();
  const [inquiries, setInquiries] = useState<FollowUpInquiry[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completedAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === "Completed"),
    [appointments],
  );

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function load() {
      const res = await fetch("/api/v2/follow-up-inquiries", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await res.json().catch(() => ({}))) as { inquiries?: FollowUpInquiry[] };
      if (active && res.ok) {
        setInquiries(payload.inquiries ?? []);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function submitInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/v2/follow-up-inquiries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appointment_id: appointmentId || null,
          message,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { inquiry?: FollowUpInquiry; message?: string };
      if (!res.ok) throw new Error(payload.message ?? "Unable to send follow-up inquiry.");
      setInquiries((current) => [payload.inquiry!, ...current]);
      setMessage("");
      setAppointmentId("");
      setFeedback("Follow-up inquiry sent.");
    } catch (submitError) {
      setFeedback(submitError instanceof Error ? submitError.message : "Unable to send follow-up inquiry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-yellow-100 bg-linear-to-br from-amber-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-700">Patient Portal</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Follow-up Inquiries</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Send questions after your visit and keep track of clinic replies in one place.
        </p>
      </section>

      <form onSubmit={submitInquiry} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-black">Send a follow-up message</h2>
        <div className="mt-4 grid gap-3">
          <select
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          >
            <option value="">Select a completed appointment (optional)</option>
            {completedAppointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {formatDisplayDate(appointment.date)} • {formatRange(appointment.start, appointment.end)}
              </option>
            ))}
          </select>
          <textarea
            required
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-32 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            placeholder="Ask about your recovery, prescription, next steps, or any follow-up concern."
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-white disabled:bg-slate-400"
            >
              <FaPaperPlane className="h-3.5 w-3.5" />
              {isSubmitting ? "Sending..." : "Send inquiry"}
            </button>
            <Link href="/appointments/my" className="rounded-full border border-yellow-200 bg-white px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50">
              My Appointments
            </Link>
          </div>
        </div>
      </form>

      {feedback ? <div className="rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-700">{feedback}</div> : null}

      <section className="grid gap-4">
        {inquiries.length ? (
          inquiries.map((inquiry) => (
            <article key={inquiry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-bold text-black">
                    <FaRegMessage className="text-amber-400" />
                    {inquiry.status}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">Sent {new Date(inquiry.created_at).toLocaleString("en-US")}</p>
                </div>
                <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">{inquiry.status}</span>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{inquiry.message}</div>
              <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Clinic reply</p>
                <p className="mt-2">{inquiry.reply || "No reply yet."}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            No follow-up inquiries yet.
          </div>
        )}
      </section>
    </div>
  );
}
