"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { IconType } from "react-icons";
import {
  FaBuildingColumns,
  FaCircleCheck,
  FaCreditCard,
  FaGear,
  FaPlus,
  FaQrcode,
  FaShieldHalved,
  FaTrash,
  FaTriangleExclamation,
  FaUpRightFromSquare,
  FaVideo,
  FaWallet,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { DoctorSignaturePad } from "@/src/components/settings/DoctorSignaturePad";
import PricingSettingsPanel from "@/src/components/settings/PricingSettingsPanel";
import SecuritySettingsPanel from "@/src/components/settings/SecuritySettingsPanel";
import type { OnlinePaymentAccount, OnlinePaymentAccountKind, SystemSettings } from "@/src/lib/clinic";
import { MAX_BOOKINGS_PER_SLOT, STANDARD_BOOKING_END, STANDARD_BOOKING_START } from "@/src/lib/clinic-schedule";

type SettingsSection = "general" | "pricing" | "security";

type SettingsSectionOption = {
  id: SettingsSection;
  label: string;
  summary: string;
  icon: IconType;
};

const EMPTY: SystemSettings = {
  clinicName: "",
  email: "",
  phone: "",
  address: "",
  onlineConsultationFee: 800,
  maxPatientsPerHour: MAX_BOOKINGS_PER_SLOT,
  clinicOpenTime: STANDARD_BOOKING_START,
  clinicCloseTime: STANDARD_BOOKING_END,
  defaultMeetingLink: "",
  doctorSignatureDataUrl: "",
  onlinePaymentAccounts: [],
};

const PAYMENT_KIND_OPTIONS: OnlinePaymentAccountKind[] = ["GCash", "Maya", "Bank", "Other"];

const SETTINGS_SECTIONS: SettingsSectionOption[] = [
  {
    id: "general",
    label: "General",
    summary: "Clinic details, hours, online consults, and payment instructions",
    icon: FaGear,
  },
  {
    id: "pricing",
    label: "Pricing",
    summary: "Consultation fees and service catalog",
    icon: FaCreditCard,
  },
  {
    id: "security",
    label: "Security",
    summary: "Access controls, audit logs, and backup export",
    icon: FaShieldHalved,
  },
];

function isSettingsSection(value: string | null): value is SettingsSection {
  return value === "general" || value === "pricing" || value === "security";
}

function createPaymentAccount(kind: OnlinePaymentAccountKind = "GCash"): OnlinePaymentAccount {
  return {
    id: crypto.randomUUID(),
    kind,
    label: kind === "Bank" ? "Bank account" : kind,
    accountName: "",
    accountNumber: "",
    bankName: "",
    qrCodeUrl: "",
    isActive: true,
  };
}

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
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [settings, setSettings] = useState<SystemSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [qrUploadingId, setQrUploadingId] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();
  const signatureDraftRef = useRef(EMPTY.doctorSignatureDataUrl);

  const canEdit = role === "SUPER_ADMIN" || role === "DOCTOR";
  const meetingLinkClass = useMemo(
    () => classifyMeetingLink(settings.defaultMeetingLink),
    [settings.defaultMeetingLink],
  );
  const activeSectionOption = SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");

    if (isSettingsSection(section)) {
      setActiveSection(section);
    }
  }, []);

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
        if (active) {
          signatureDraftRef.current = payload.data.doctorSignatureDataUrl ?? "";
          setSettings(payload.data);
        }
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
    if (field === "doctorSignatureDataUrl") {
      signatureDraftRef.current = String(value ?? "");
    }
    setSettings((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  }

  function addPaymentAccount(kind: OnlinePaymentAccountKind = "GCash") {
    updateField("onlinePaymentAccounts", [...settings.onlinePaymentAccounts, createPaymentAccount(kind)]);
  }

  function updatePaymentAccount(id: string, patch: Partial<OnlinePaymentAccount>) {
    updateField(
      "onlinePaymentAccounts",
      settings.onlinePaymentAccounts.map((account) =>
        account.id === id ? { ...account, ...patch } : account,
      ),
    );
  }

  function removePaymentAccount(id: string) {
    updateField(
      "onlinePaymentAccounts",
      settings.onlinePaymentAccounts.filter((account) => account.id !== id),
    );
  }

  async function uploadPaymentQr(accountId: string, file: File | null) {
    if (!file || !accessToken) return;
    setQrUploadingId(accountId);
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v2/settings/online-payment-qr", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload.url) {
        throw new Error(payload.message ?? "Failed to upload QR code.");
      }
      updatePaymentAccount(accountId, { qrCodeUrl: payload.url });
      setFeedback({ message: "QR uploaded. Save changes to publish this payment option.", type: "success" });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Failed to upload QR code.",
        type: "error",
      });
    } finally {
      setQrUploadingId(null);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    startTransition(async () => {
      const nextSettings = {
        ...settings,
        doctorSignatureDataUrl: signatureDraftRef.current,
        maxPatientsPerHour: MAX_BOOKINGS_PER_SLOT,
      };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(nextSettings),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFeedback({ message: body.message ?? "Failed to save settings.", type: "error" });
        return;
      }
      const payload = (await res.json()) as { data: SystemSettings };
      signatureDraftRef.current = payload.data.doctorSignatureDataUrl ?? "";
      setSettings(payload.data);
      setFeedback({ message: "Settings saved.", type: "success" });
    });
  }

  function selectSection(section: SettingsSection) {
    setActiveSection(section);

    const url = new URL(window.location.href);
    if (section === "general") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", section);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2.25rem] border border-neutral-100 bg-[radial-gradient(circle_at_top_left,rgba(17,17,17,0.16),transparent_34%),linear-gradient(135deg,#f5f5f5_0%,#ffffff_100%)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.10)] animate-fade-in-down">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-700">Settings</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              Manage clinic configuration
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{activeSectionOption.summary}.</p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          {SETTINGS_SECTIONS.map((section) => (
            <SettingsSectionButton
              key={section.id}
              active={activeSection === section.id}
              icon={section.icon}
              label={section.label}
              onClick={() => selectSection(section.id)}
            />
          ))}
        </div>
      </div>

      {activeSection === "general" ? (
        <>
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
              <label className="block text-sm font-medium text-slate-700">Virtual Consult Fee</label>
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
              <label className="block text-sm font-medium text-slate-700">Slot Capacity</label>
              <input
                type="number"
                min={MAX_BOOKINGS_PER_SLOT}
                max={MAX_BOOKINGS_PER_SLOT}
                value={MAX_BOOKINGS_PER_SLOT}
                readOnly
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 focus:outline-none"
              />
              <p className="mt-2 text-xs text-slate-500">Booking is fixed to one patient per time slot.</p>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                <FaVideo className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Virtual Consult</h3>
                <p className="text-xs text-slate-500">
                  Used as the meeting link for every virtual consult by default.
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

          <DoctorSignaturePad
            value={settings.doctorSignatureDataUrl}
            onChange={(value) => updateField("doctorSignatureDataUrl", value)}
            disabled={loading || !canEdit || isSaving}
          />

          <div className="border-t border-neutral-100 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <FaWallet className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Online Payment Configure</h3>
                  <p className="text-xs text-slate-500">
                    GCash, Maya, and bank details shown for manual online payment instructions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => addPaymentAccount()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <FaPlus className="h-3 w-3" aria-hidden="true" />
                Add Account
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {settings.onlinePaymentAccounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-slate-500">
                  No online payment accounts yet.
                </div>
              ) : null}

              {settings.onlinePaymentAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Type
                        </label>
                        <select
                          value={account.kind}
                          onChange={(e) => {
                            const nextKind = e.target.value as OnlinePaymentAccountKind;
                            updatePaymentAccount(account.id, {
                              kind: nextKind,
                              label: account.label || (nextKind === "Bank" ? "Bank account" : nextKind),
                            });
                          }}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        >
                          {PAYMENT_KIND_OPTIONS.map((kind) => (
                            <option key={kind} value={kind}>{kind}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Display Label
                        </label>
                        <input
                          type="text"
                          value={account.label}
                          onChange={(e) => updatePaymentAccount(account.id, { label: e.target.value })}
                          placeholder="GCash, Maya, BDO, BPI"
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Account Name
                        </label>
                        <input
                          type="text"
                          value={account.accountName}
                          onChange={(e) => updatePaymentAccount(account.id, { accountName: e.target.value })}
                          placeholder="Doc Kulot Clinic"
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Number / Account No.
                        </label>
                        <input
                          type="text"
                          inputMode="text"
                          value={account.accountNumber}
                          onChange={(e) => updatePaymentAccount(account.id, { accountNumber: e.target.value })}
                          placeholder="09xx xxx xxxx or bank account number"
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                        />
                      </div>

                      {account.kind === "Bank" || account.kind === "Other" ? (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Bank / Provider Name
                          </label>
                          <input
                            type="text"
                            value={account.bankName}
                            onChange={(e) => updatePaymentAccount(account.id, { bankName: e.target.value })}
                            placeholder="BDO, BPI, Metrobank, UnionBank"
                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full lg:w-48">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">QR Code</span>
                        <button
                          type="button"
                          onClick={() => updatePaymentAccount(account.id, { isActive: !account.isActive })}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            account.isActive
                              ? "bg-neutral-900 text-white"
                              : "bg-white text-slate-500 ring-1 ring-neutral-200"
                          }`}
                        >
                          {account.isActive ? "Active" : "Hidden"}
                        </button>
                      </div>

                      <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {account.qrCodeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={account.qrCodeUrl} alt={`${account.label || account.kind} QR code`} className="aspect-square w-full object-cover" />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center bg-neutral-50 text-neutral-400">
                            <FaQrcode className="h-10 w-10" aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50">
                        <FaQrcode className="h-3 w-3" aria-hidden="true" />
                        {qrUploadingId === account.id ? "Uploading..." : "Upload QR"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            void uploadPaymentQr(account.id, e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removePaymentAccount(account.id)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <FaTrash className="h-3 w-3" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {account.kind === "Bank" ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <FaBuildingColumns className="h-3 w-3" aria-hidden="true" />
                      Bank accounts can use the provider name and uploaded QR for the patient payment instructions.
                    </p>
                  ) : null}
                </div>
              ))}
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
        </>
      ) : null}

      {activeSection === "pricing" ? <PricingSettingsPanel /> : null}
      {activeSection === "security" ? <SecuritySettingsPanel /> : null}
    </div>
  );
}

function SettingsSectionButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center transition ${
        active
          ? "border-black bg-black text-white shadow-sm"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <span className={`rounded-lg p-1.5 ${active ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-800"}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-black tracking-tight">{label}</span>
    </button>
  );
}
