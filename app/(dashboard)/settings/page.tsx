"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FaCircleCheck, FaTriangleExclamation, FaUpRightFromSquare, FaVideo } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { SystemSettings } from "@/src/lib/clinic";

const EMPTY: SystemSettings = {
  clinicName: "",
  email: "",
  phone: "",
  address: "",
  onlineConsultationFee: 800,
  maxPatientsPerHour: 5,
  clinicOpenTime: "08:00",
  clinicCloseTime: "17:00",
  defaultMeetingLink: "",
};

// Light validation: accept anything that parses as an https URL. Warn (don't
// block) when the host isn't a recognised meeting provider so the doctor can
// still use Jitsi / Whereby / Zoom if she ever wants to.
const RECOGNISED_MEETING_HOSTS = [
  "meet.google.com",
  "meet.jit.si",
  "zoom.us",
  "us02web.zoom.us",
  "us04web.zoom.us",
  "us05web.zoom.us",
  "whereby.com",
  "teams.microsoft.com",
  "teams.live.com",
];

function classifyMeetingLink(raw: string): {
  state: "empty" | "valid-known" | "valid-unknown" | "invalid";
  host?: string;
} {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { state: "empty" };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return { state: "invalid" };
    const host = url.host.toLowerCase();
    const known = RECOGNISED_MEETING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return { state: known ? "valid-known" : "valid-unknown", host };
  } catch {
    return { state: "invalid" };
  }
}

export default function SettingsPage() {
  const { role, accessToken, isLoading: authLoading } = useRole();
  const [settings, setSettings] = useState<SystemSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSaving, startTransition] = useTransition();

  const canEdit = role === "SUPER_ADMIN" || role === "DOCTOR";
  const meetingLinkClass = useMemo(
    () => classifyMeetingLink(settings.defaultMeetingLink),
    [settings.defaultMeetingLink],
  );

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to load settings");
        const payload = (await res.json()) as { data: SystemSettings };
        if (active) setSettings(payload.data);
      } catch (e) {
        if (active) setFeedback({ message: e instanceof Error ? e.message : "Failed to load settings", type: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  function updateField<K extends keyof SystemSettings>(field: K, value: SystemSettings[K]) {
    setSettings((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        setFeedback({ message: "Failed to save settings.", type: "error" });
        return;
      }
      const payload = (await res.json()) as { data: SystemSettings };
      setSettings(payload.data);
      setFeedback({ message: "Settings saved.", type: "success" });
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.16),transparent_34%),linear-gradient(135deg,#f5f5f5_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">Settings</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Manage clinic details and hours</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Update the clinic profile, hours, and consultation fee settings.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Shortcut href="/schedules" label="Schedules" />
            <Shortcut href="/pricing" label="Pricing" />
            <Shortcut href="/payments" label="Payments" />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-neutral-200 bg-neutral-50 text-neutral-700"
              : "border border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Read-only view. Only Super Admin and Doctor can modify system settings.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-4xl border border-neutral-100 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-fade-in-up stagger-1">
        <h2 className="text-lg font-bold text-slate-900">General</h2>
        <fieldset disabled={loading || !canEdit || isSaving} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Clinic Name</label>
              <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => updateField("clinicName", e.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Clinic Opens</label>
              <input
                type="time"
                value={settings.clinicOpenTime}
                onChange={(e) => updateField("clinicOpenTime", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Clinic Closes</label>
              <input
                type="time"
                value={settings.clinicCloseTime}
                onChange={(e) => updateField("clinicCloseTime", e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-100 px-3 py-3 outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Online Consultation Fee</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.onlineConsultationFee}
                onChange={(e) => updateField("onlineConsultationFee", Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-100 focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Max Patients per Hour</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settings.maxPatientsPerHour}
                onChange={(e) => updateField("maxPatientsPerHour", Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-100 focus:border-neutral-400"
              />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Online Consultation</h3>
                <p className="text-xs text-slate-500">
                  Used as the meeting link for every Online appointment by default.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Default Meeting Link
              </label>
              <input
                type="url"
                placeholder="https://meet.google.com/abc-defg-hij"
                value={settings.defaultMeetingLink}
                onChange={(e) => updateField("defaultMeetingLink", e.target.value)}
                className={`mt-2 w-full rounded-2xl border px-3 py-3 outline-none transition focus:ring-4 ${
                  meetingLinkClass.state === "invalid"
                    ? "border-neutral-300 focus:border-neutral-400 focus:ring-neutral-100"
                    : "border-neutral-100 focus:border-neutral-400 focus:ring-neutral-100"
                }`}
              />

              <div className="mt-2 space-y-2 text-xs">
                {meetingLinkClass.state === "empty" ? (
                  <p className="inline-flex items-center gap-1.5 text-neutral-700">
                    <FaTriangleExclamation className="h-3 w-3" aria-hidden="true" />
                    No link saved. Online bookings will be confirmed without a meeting link until you add one.
                  </p>
                ) : null}
                {meetingLinkClass.state === "invalid" ? (
                  <p className="inline-flex items-center gap-1.5 text-neutral-700">
                    <FaTriangleExclamation className="h-3 w-3" aria-hidden="true" />
                    That doesn&apos;t look like a valid <code className="rounded bg-neutral-50 px-1">https://</code> URL.
                  </p>
                ) : null}
                  {meetingLinkClass.state === "valid-known" ? (
                    <p className="inline-flex items-center gap-1.5 text-neutral-700">
                      <FaCircleCheck className="h-3 w-3 text-neutral-400" aria-hidden="true" />
                      Looks good — host detected: <span className="font-semibold">{meetingLinkClass.host}</span>
                    </p>
                  ) : null}
                {meetingLinkClass.state === "valid-unknown" ? (
                    <p className="inline-flex items-center gap-1.5 text-slate-600">
                    <FaCircleCheck className="h-3 w-3 text-neutral-400" aria-hidden="true" />
                    Saved as-is. Host <span className="font-semibold">{meetingLinkClass.host}</span> isn&apos;t a recognised meeting provider — double-check it works.
                  </p>
                ) : null}

                <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    How to get a Google Meet / Zoom link
                  </summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">
                    <li>
                      For Google Meet, open <a href="https://meet.new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-neutral-700 hover:underline">meet.new <FaUpRightFromSquare className="h-2.5 w-2.5" aria-hidden="true" /></a> while signed in to the doctor&apos;s Google account.
                    </li>
                    <li>
                      Copy the URL from the address bar for Google Meet, or paste your Zoom meeting URL directly.
                    </li>
                    <li>Paste it above and save. Patients will receive this link in email and the patient portal; SMS reminders stay short to save credits.</li>
                    <li>
                      <span className="font-semibold">Privacy tip:</span> if your platform uses a waiting room or lobby, only admit the patient whose slot is active.
                    </li>
                  </ol>
                </details>

                {meetingLinkClass.state === "valid-known"
                  || meetingLinkClass.state === "valid-unknown" ? (
                    <a
                      href={settings.defaultMeetingLink.trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      <FaUpRightFromSquare className="h-2.5 w-2.5" aria-hidden="true" />
                      Test the link
                    </a>
                  ) : null}
              </div>
            </div>
          </div>

          {canEdit ? (
            <button
              type="submit"
              disabled={isSaving || loading || meetingLinkClass.state === "invalid"}
              className="rounded-full bg-black px-6 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(17,17,17,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-100 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}

