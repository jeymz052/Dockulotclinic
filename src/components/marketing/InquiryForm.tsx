"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const inquiryTypes = [
  "Ask about appointment",
  "Ask about services",
  "Ask about consultation",
  "Ask about vlog/content collaboration",
  "Ask general questions",
];

export default function InquiryForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    type: inquiryTypes[0],
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setFeedback("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          inquiry_type: form.type,
          message: form.message,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to send inquiry.");
      setStatus("sent");
      setFeedback("Inquiry sent. The clinic team can review and reply shortly.");
      setForm({ name: "", email: "", type: inquiryTypes[0], message: "" });
    } catch (err) {
      setStatus("error");
      setFeedback(err instanceof Error ? err.message : "Failed to send inquiry.");
    }
  }

  return (
    <form className="rounded-3xl border border-slate-200 bg-yellow-50/60 p-6 shadow-sm" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          required
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
        />
        <input
          required
          type="email"
          className="rounded-xl border border-slate-200 px-4 py-3"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
        />
      </div>
      <select
        className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3"
        value={form.type}
        onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
      >
        {inquiryTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <textarea
        required
        className="mt-4 min-h-40 w-full rounded-xl border border-slate-200 px-4 py-3"
        placeholder="Message"
        value={form.message}
        onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-4 w-full rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      >
        {status === "sending" ? "Sending..." : "Submit inquiry"}
      </button>
      {feedback ? (
        <p className={`mt-4 text-sm font-semibold ${status === "error" ? "text-yellow-600" : "text-yellow-700"}`}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
