"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { FaBell, FaCircleCheck, FaLock, FaRegUser, FaShieldHeart } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

export default function PatientProfileSettingsPage() {
  const { profile, user, accessToken, refreshProfile } = useRole();
  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? "Patient";
  const email = profile?.email ?? user?.email ?? "No email saved";
  const [form, setForm] = useState({
    fullName,
    phone: profile?.phone ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setFeedback({ type: "error", message: "You need to be signed in to update your profile." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/v2/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to save your profile.");
      }

      await refreshProfile();
      setFeedback({ type: "success", message: "Your account details were updated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save your profile.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[2.25rem] border border-yellow-200 bg-[radial-gradient(circle_at_top_left,rgba(186,230,253,0.92),transparent_34%),linear-gradient(135deg,#fafafa_0%,#e6f4ff_42%,#cbe7ff_100%)] p-6 shadow-[0_24px_80px_rgba(17,17,17,0.10)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-700">Patient Settings</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-black">Your account settings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
          This patient version keeps account guidance simple and avoids sending you into system-wide clinic configuration.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-yellow-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
              <FaRegUser className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Edit profile information</h2>
              <p className="text-sm text-slate-500">Update the personal details tied to your patient account.</p>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <Field label="Full name">
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-2xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                placeholder="Enter your full name"
              />
            </Field>

            <Field label="Email address">
              <input
                value={email}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"
              />
            </Field>

            <Field label="Phone number">
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-2xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100"
                placeholder="Enter your phone number"
              />
            </Field>

            <div className="rounded-[1.5rem] border border-yellow-100 bg-yellow-50/70 p-4 text-sm text-slate-700">
              Your email stays locked here because it is used as your sign-in identity. Contact the clinic if that needs to change.
            </div>

            {feedback ? (
              <div
                className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
                  feedback.type === "success"
                    ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                    : "border-yellow-200 bg-yellow-50 text-yellow-700"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="rounded-full border border-yellow-200 bg-white px-5 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50"
                onClick={() => {
                  setForm({
                    fullName: profile?.full_name ?? user?.user_metadata?.full_name ?? "Patient",
                    phone: profile?.phone ?? "",
                  });
                  setFeedback(null);
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-yellow-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
                <FaBell className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Patient notifications</h2>
                <p className="text-sm text-slate-500">You can expect updates related to appointments and payments.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Pill label="Appointment confirmations" />
              <Pill label="Schedule reminders" />
              <Pill label="Payment receipts" />
              <Pill label="Consultation links" />
            </div>
          </div>

          <div className="rounded-[2rem] border border-yellow-100 bg-black p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-3">
              <FaShieldHeart className="h-5 w-5 text-amber-300" />
              <h2 className="text-lg font-bold">Safety and privacy</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-50/85">
              <li>Use the same email address you use for bookings to avoid missed updates.</li>
              <li>Review your appointment details before joining an online consultation.</li>
              <li>Contact clinic staff if your name, email, or mobile number needs to be corrected.</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-yellow-700">
              <FaCircleCheck className="h-4 w-4" />
              <p className="text-sm font-semibold">Need to update your details?</p>
            </div>
            <p className="mt-2 text-sm text-slate-700">For patient accounts, profile changes are usually handled by the clinic to keep records accurate.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/profile/help" label="Open Patient Help" />
            <QuickLink href="/appointments/my" label="View Appointments" />
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <FaLock className="h-4 w-4 text-yellow-700" />
          <span>This page is a patient-friendly account overview, not the clinic&apos;s system settings panel.</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-700">
      {label}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-yellow-200 bg-white px-4 py-2 text-sm font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-50"
    >
      {label}
    </Link>
  );
}
