"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  FaCircleCheck,
  FaEnvelope,
  FaIdBadge,
  FaKey,
  FaPenToSquare,
  FaLock,
  FaPhone,
  FaRegUser,
  FaShieldHeart,
} from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";
import { getRoleProfile } from "@/src/lib/roles";

type DetailsForm = {
  fullName: string;
  email: string;
  phone: string;
};

function getInitials(name: string | null | undefined) {
  const value = name?.trim();
  if (!value) return "DK";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getProfileCompletion(fields: Array<string | null | undefined>) {
  const completed = fields.filter((field) => Boolean(field?.trim())).length;
  return Math.round((completed / fields.length) * 100);
}

export default function ProfilePage() {
  const { role, profile, user, isLoading, refreshProfile, accessToken } = useRole();
  const roleProfile = getRoleProfile(role);
  const settingsHref = role === "PATIENT" ? "/profile/settings" : "/settings";
  const helpHref = role === "PATIENT" ? "/profile/help" : "/help";

  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? "Doc Kulot User";
  const email = profile?.email ?? user?.email ?? "";
  const phone = profile?.phone ?? "";

  const [detailsForm, setDetailsForm] = useState<DetailsForm>({
    fullName,
    email,
    phone,
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [detailsFeedback, setDetailsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSavingDetails, startSavingDetails] = useTransition();
  const [isSavingPassword, startSavingPassword] = useTransition();

  useEffect(() => {
    setDetailsForm({
      fullName,
      email,
      phone,
    });
  }, [email, fullName, phone]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-80 animate-pulse rounded-3xl bg-yellow-100/70" />
        <div className="h-80 animate-pulse rounded-[2rem] bg-yellow-100/70" />
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[27rem] animate-pulse rounded-[2rem] bg-slate-100" />
          <div className="h-[27rem] animate-pulse rounded-[2rem] bg-slate-100" />
        </div>
      </div>
    );
  }

  const initials = getInitials(detailsForm.fullName);
  const accountState = profile?.is_active ? "Active account" : "Inactive account";
  const profileCompletion = getProfileCompletion([
    detailsForm.fullName,
    roleProfile.label,
    detailsForm.email,
    detailsForm.phone,
  ]);

  function handleDetailsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setDetailsFeedback({ type: "error", message: "You need to be signed in to update your profile." });
      return;
    }

    startSavingDetails(() => {
      void (async () => {
        try {
          const response = await fetch("/api/v2/me", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              full_name: detailsForm.fullName,
              phone: detailsForm.phone,
              email: detailsForm.email,
            }),
          });

          const payload = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(payload.message ?? "Unable to save your profile.");
          }

          await refreshProfile();
          setDetailsFeedback({
            type: "success",
            message:
              "Your account details were updated. If you changed your email, use the new address on your next sign in.",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to save your profile.";
          setDetailsFeedback({ type: "error", message });
        }
      })();
    });
  }

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setPasswordFeedback({ type: "error", message: "You need to be signed in to update your password." });
      return;
    }

    if (passwordForm.password.length < 8) {
      setPasswordFeedback({ type: "error", message: "Password must be at least 8 characters long." });
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }

    startSavingPassword(() => {
      void (async () => {
        try {
          const response = await fetch("/api/v2/me", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              new_password: passwordForm.password,
            }),
          });

          const payload = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(payload.message ?? "Unable to update your password.");
          }

          setPasswordForm({ password: "", confirmPassword: "" });
          setPasswordFeedback({
            type: "success",
            message: "Your password was updated successfully.",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update your password.";
          setPasswordFeedback({ type: "error", message });
        }
      })();
    });
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-yellow-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.25),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(184,134,11,0.2),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_38%,#fef3c7_100%)] p-6 text-black shadow-[0_24px_80px_rgba(184,134,11,0.15)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.22),transparent_66%)] lg:block" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-yellow-300/70 bg-white/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-700 backdrop-blur">
              Doc Kulot Workspace
            </div>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/70 bg-[linear-gradient(145deg,rgba(133,77,14,0.95),rgba(120,53,15,0.96))] text-3xl font-bold text-white shadow-[0_18px_40px_rgba(120,53,15,0.22)]">
                {initials}
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-yellow-800">Account Profile</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-black sm:text-4xl">{detailsForm.fullName}</h1>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-yellow-300/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-black">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  {roleProfile.label}
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-900/80 sm:text-base">
              A calmer blue profile view for the Doc Kulot system. You can review your account identity, edit contact details, and update your password without leaving the profile area.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[30rem] xl:grid-cols-1">
            <HeroMetric
              eyebrow="Status"
              title={accountState}
              detail={profile?.is_active ? "Your access is enabled across the dashboard." : "Ask an administrator to reactivate this account."}
            />
            <HeroMetric
              eyebrow="Profile completion"
              title={`${profileCompletion}% ready`}
              detail="Complete contact details help patients and staff reach you faster."
            />
            <div className="rounded-[1.6rem] border border-white/40 bg-white/18 p-4 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/75">Quick actions</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Shortcut href={settingsHref} label="My Settings" />
                <Shortcut href={helpHref} label="Help Center" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[2rem] border border-yellow-100 bg-white/95 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700">
                <FaRegUser className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Personal details</h2>
                <p className="text-sm text-slate-500">Edit the account information shown across the Doc Kulot workspace.</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-100 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700">
              <FaCircleCheck className="h-3.5 w-3.5" />
              Synced with your account
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleDetailsSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field icon={<FaIdBadge className="h-4 w-4" />} label="Full name">
                <input
                  value={detailsForm.fullName}
                  onChange={(event) => setDetailsForm((current) => ({ ...current, fullName: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="Enter your full name"
                />
              </Field>
              <Field icon={<FaShieldHeart className="h-4 w-4" />} label="Role">
                <input
                  value={roleProfile.label}
                  disabled
                  className={`${INPUT_CLASS} bg-slate-50 text-slate-500`}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field icon={<FaEnvelope className="h-4 w-4" />} label="Email address">
                <input
                  type="email"
                  value={detailsForm.email}
                  onChange={(event) => setDetailsForm((current) => ({ ...current, email: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="name@clinic.com"
                />
              </Field>
              <Field icon={<FaPhone className="h-4 w-4" />} label="Phone number">
                <input
                  value={detailsForm.phone}
                  onChange={(event) => setDetailsForm((current) => ({ ...current, phone: event.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="+63 9XX XXX XXXX"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSavingDetails}
                className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaPenToSquare className="h-4 w-4" />
                {isSavingDetails ? "Saving..." : "Save Details"}
              </button>
              <button
                type="button"
                className="rounded-full border border-yellow-200 bg-white px-5 py-2.5 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50"
                onClick={() => {
                  setDetailsForm({ fullName, email, phone });
                  setDetailsFeedback(null);
                }}
              >
                Reset
              </button>
            </div>

            {detailsFeedback ? (
              <Feedback tone={detailsFeedback.type} message={detailsFeedback.message} />
            ) : null}
          </form>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard icon={<FaIdBadge className="h-4 w-4" />} label="Full name" value={detailsForm.fullName || "—"} />
            <InfoCard icon={<FaEnvelope className="h-4 w-4" />} label="Email" value={detailsForm.email || "—"} />
            <InfoCard icon={<FaPhone className="h-4 w-4" />} label="Phone" value={detailsForm.phone || "No phone number saved"} />
            <InfoCard icon={<FaShieldHeart className="h-4 w-4" />} label="Role access" value={roleProfile.label} />
          </div>
        </section>

        <section className="space-y-6">
          <aside className="rounded-[2rem] border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#f1f8ff_100%)] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-700">Account overview</p>
            <div className="mt-5 space-y-4">
              <SummaryRow label="Primary email" value={detailsForm.email || "—"} />
              <SummaryRow label="Role access" value={roleProfile.label} />
              <SummaryRow label="Phone status" value={detailsForm.phone ? "Available" : "Needs update"} />
              <SummaryRow label="Account state" value={accountState} />
            </div>
          </aside>

          <aside className="rounded-[2rem] border border-yellow-100 bg-black p-6 text-white shadow-[0_22px_50px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-3">
              <FaShieldHeart className="h-5 w-5 text-amber-300" />
              <h2 className="text-lg font-bold">Profile security</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-50/80">
              You can change your password from here without touching the clinic settings page.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
              <Field dark label="New password">
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className={DARK_INPUT_CLASS}
                  placeholder="Enter a new password"
                />
              </Field>
              <Field dark label="Confirm password">
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  className={DARK_INPUT_CLASS}
                  placeholder="Re-enter the new password"
                />
              </Field>
              <button
                type="submit"
                disabled={isSavingPassword}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-yellow-300 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaKey className="h-4 w-4" />
                {isSavingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
            {passwordFeedback ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  passwordFeedback.type === "success"
                    ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                    : "border-yellow-200 bg-yellow-50 text-yellow-700"
                }`}
              >
                {passwordFeedback.message}
              </div>
            ) : null}
          </aside>
        </section>
      </div>

      <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50/70 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-yellow-700">
              <FaCircleCheck className="h-4 w-4" />
              <p className="text-sm font-semibold">Need to update your details?</p>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Keep your email and password current so notifications, appointment updates, and billing references stay accurate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Shortcut href={helpHref} label="Open Help Center" />
            <Shortcut href={settingsHref} label="View Settings" />
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <FaLock className="h-4 w-4 text-yellow-700" />
          <span>This page is your Doc Kulot account profile, not the clinic&apos;s system settings panel.</span>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/40 bg-white/90 px-3.5 py-2 text-xs font-semibold text-yellow-800 transition hover:border-white hover:bg-white"
    >
      {label}
    </Link>
  );
}

function HeroMetric({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/40 bg-white/18 p-4 text-black backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/75">{eyebrow}</p>
      <p className="mt-2 text-lg font-semibold text-black">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900/75">{detail}</p>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fefce8_100%)] p-5">
      <div className="flex items-center gap-2 text-yellow-700">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-yellow-100 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
  dark = false,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${dark ? "text-amber-50/80" : "text-slate-500"}`}>
        {icon ? <span className={dark ? "text-amber-300" : "text-yellow-700"}>{icon}</span> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

function Feedback({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-yellow-200 bg-yellow-50 text-yellow-700"
          : "border-yellow-200 bg-yellow-50 text-yellow-700"
      }`}
    >
      {message}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-yellow-100 bg-[linear-gradient(180deg,#ffffff_0%,#fefce8_100%)] px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-100";

const DARK_INPUT_CLASS =
  "w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white placeholder:text-white/55 outline-none transition focus:border-yellow-300 focus:ring-4 focus:ring-amber-400/20";
