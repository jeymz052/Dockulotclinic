"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FaArrowRight, FaEnvelopeOpenText, FaReply, FaUserPlus } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type InquiryStatus = "Pending" | "Replied" | "Closed";
type AppointmentType = "Clinic" | "Online";

type Inquiry = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  inquiry_type: string;
  message: string;
  status: InquiryStatus;
  reply: string | null;
  created_at: string;
  converted_appointment_id: string | null;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
};

type ConvertDraft = {
  doctorId: string;
  date: string;
  startTime: string;
  appointmentType: AppointmentType;
  reason: string;
};

const STATUS_OPTIONS: InquiryStatus[] = ["Pending", "Replied", "Closed"];

export default function InquiriesPage() {
  const { accessToken } = useRole();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [replyById, setReplyById] = useState<Record<string, string>>({});
  const [statusById, setStatusById] = useState<Record<string, InquiryStatus>>({});
  const [convertDraftById, setConvertDraftById] = useState<Record<string, ConvertDraft>>({});
  const [feedback, setFeedback] = useState("");

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken],
  );

  function localDateInput(daysFromToday = 1) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function inferAppointmentType(inquiryType: string): AppointmentType {
    return inquiryType.toLowerCase().includes("consultation") ? "Online" : "Clinic";
  }

  function buildDefaultDraft(inquiry: Inquiry): ConvertDraft {
    return {
      doctorId: doctors[0]?.id ?? "",
      date: localDateInput(1),
      startTime: "09:00",
      appointmentType: inferAppointmentType(inquiry.inquiry_type),
      reason: inquiry.message,
    };
  }

  async function load() {
    if (!accessToken) return;

    const [inquiriesRes, doctorsRes] = await Promise.all([
      fetch("/api/v2/inquiries?status=all", { headers, cache: "no-store" }),
      fetch("/api/v2/doctors", { headers, cache: "no-store" }),
    ]);

    if (inquiriesRes.ok) {
      const payload = (await inquiriesRes.json()) as { inquiries?: Inquiry[] };
      const rows = payload.inquiries ?? [];
      setInquiries(rows);
      setStatusById(Object.fromEntries(rows.map((item) => [item.id, item.status])));
      setReplyById((current) => {
        const next = { ...current };
        for (const item of rows) {
          if (!(item.id in next) && item.reply) next[item.id] = item.reply;
        }
        return next;
      });
      setConvertDraftById((current) => {
        const next = { ...current };
        for (const item of rows) {
          if (!(item.id in next)) next[item.id] = buildDefaultDraft(item);
        }
        return next;
      });
    }

    if (doctorsRes.ok) {
      const payload = (await doctorsRes.json()) as {
        doctors?: Array<{ id: string; name?: string; full_name?: string; specialty?: string }>;
      };
      setDoctors(
        (payload.doctors ?? []).map((doctor) => ({
          id: doctor.id,
          name: doctor.name ?? doctor.full_name ?? "Doctor",
          specialty: doctor.specialty ?? "Family Medicine and Aesthetic Medicine",
        })),
      );
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateInquiry(id: string, payload: Record<string, unknown>) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/inquiries/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setFeedback(body.message ?? "Unable to update inquiry");
      return;
    }
    setFeedback("Inquiry updated.");
    await load();
  }

  async function convertInquiry(item: Inquiry) {
    if (!accessToken) return;
    const draft = convertDraftById[item.id] ?? buildDefaultDraft(item);
    const res = await fetch(`/api/v2/inquiries/${item.id}/convert`, {
      method: "POST",
      headers,
      body: JSON.stringify(draft),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setFeedback(body.message ?? "Unable to convert inquiry");
      return;
    }
    setFeedback("Inquiry converted to an appointment.");
    await load();
  }

  const pending = inquiries.filter((i) => i.status === "Pending").length;
  const replied = inquiries.filter((i) => i.status === "Replied").length;
  const closed = inquiries.filter((i) => i.status === "Closed").length;

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[2rem] border border-neutral-100 bg-linear-to-br from-neutral-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-700">Inquiry System</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">Visitor and patient inquiries</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Reply, close, and convert qualified inquiries into appointments from one inbox.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={<FaEnvelopeOpenText />} title="Pending" value={pending} />
        <Metric icon={<FaReply />} title="Replied" value={replied} />
        <Metric icon={<FaUserPlus />} title="Closed" value={closed} />
      </div>

      {feedback ? <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700">{feedback}</p> : null}

      <div className="grid gap-4">
        {inquiries.map((item) => {
          const draft = convertDraftById[item.id] ?? buildDefaultDraft(item);

          return (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status} />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.inquiry_type}</span>
                    <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                    {item.converted_appointment_id ? (
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700">Converted</span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-black">{item.name}</h2>
                  <p className="text-sm text-slate-500">
                    {item.email ?? "No email"} {item.phone ? `- ${item.phone}` : ""}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
                  {item.reply ? (
                    <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                      <strong>Reply:</strong> {item.reply}
                    </p>
                  ) : null}
                  {item.converted_appointment_id ? (
                    <p className="mt-3 text-sm font-medium text-neutral-700">
                      Converted appointment ID: <span className="font-semibold text-neutral-800">{item.converted_appointment_id}</span>
                    </p>
                  ) : null}
                </div>

                <div className="w-full max-w-md space-y-3">
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    placeholder="Write reply"
                    value={replyById[item.id] ?? ""}
                    onChange={(e) => setReplyById((current) => ({ ...current, [item.id]: e.target.value }))}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Status
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        value={statusById[item.id] ?? item.status}
                        onChange={(e) =>
                          setStatusById((current) => ({
                            ...current,
                            [item.id]: e.target.value as InquiryStatus,
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Doctor
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        value={draft.doctorId}
                        onChange={(e) =>
                          setConvertDraftById((current) => ({
                            ...current,
                            [item.id]: { ...draft, doctorId: e.target.value },
                          }))
                        }
                      >
                        {doctors.length === 0 ? <option value="">No doctors available</option> : null}
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.name} - {doctor.specialty}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Date
                      <input
                        type="date"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        value={draft.date}
                        onChange={(e) =>
                          setConvertDraftById((current) => ({
                            ...current,
                            [item.id]: { ...draft, date: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Start Time
                      <input
                        type="time"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        value={draft.startTime}
                        onChange={(e) =>
                          setConvertDraftById((current) => ({
                            ...current,
                            [item.id]: { ...draft, startTime: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Type
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        value={draft.appointmentType}
                        onChange={(e) =>
                          setConvertDraftById((current) => ({
                            ...current,
                            [item.id]: { ...draft, appointmentType: e.target.value as AppointmentType },
                          }))
                        }
                      >
                        <option value="Clinic">Clinic</option>
                        <option value="Online">Online</option>
                      </select>
                    </label>
                  </div>

                  <textarea
                    className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                    placeholder="Reason for appointment"
                    value={draft.reason}
                    onChange={(e) =>
                      setConvertDraftById((current) => ({
                        ...current,
                        [item.id]: { ...draft, reason: e.target.value },
                      }))
                    }
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateInquiry(item.id, { reply: replyById[item.id] ?? "", status: "Replied" })}
                      className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white"
                    >
                      Save reply
                    </button>
                    <button
                      onClick={() => updateInquiry(item.id, { status: statusById[item.id] ?? item.status })}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                    >
                      Save status
                    </button>
                    <button
                      onClick={() => convertInquiry(item)}
                      disabled={Boolean(item.converted_appointment_id) || doctors.length === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Convert to appointment <FaArrowRight />
                    </button>
                    <button
                      onClick={() => updateInquiry(item.id, { status: "Closed" })}
                      className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500">
          No inquiries yet.
          <div className="mt-3">
            <Link href="/contact" className="font-semibold text-neutral-700 underline underline-offset-4">
              View the public contact form
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: InquiryStatus }) {
  const tone =
    status === "Pending"
      ? "bg-neutral-100 text-neutral-700"
      : status === "Replied"
        ? "bg-neutral-100 text-neutral-700"
        : "bg-neutral-100 text-neutral-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}

function Metric({ icon, title, value }: { icon: ReactNode; title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-2xl text-neutral-400">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black text-black">{value}</p>
    </div>
  );
}

