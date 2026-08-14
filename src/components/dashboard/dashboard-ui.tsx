"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "emerald" | "teal" | "sky" | "amber" | "slate" | "rose" | "indigo" | "violet" | "cyan" | "gold";

const panelToneClasses: Record<Tone, string> = {
  emerald: "border-emerald-100 bg-linear-to-br from-emerald-50 to-white shadow-[0_16px_34px_rgba(16,185,129,0.12)]",
  teal: "border-teal-100 bg-linear-to-br from-teal-50 to-white shadow-[0_16px_34px_rgba(20,184,166,0.12)]",
  sky: "border-sky-100 bg-linear-to-br from-sky-50 to-white shadow-[0_16px_34px_rgba(14,165,233,0.12)]",
  amber: "border-amber-100 bg-linear-to-br from-amber-50 to-white shadow-[0_16px_34px_rgba(245,158,11,0.14)]",
  slate: "border-neutral-200 bg-linear-to-br from-neutral-50 to-neutral-50/30 shadow-[0_16px_34px_rgba(15,23,42,0.08)]",
  rose: "border-rose-100 bg-linear-to-br from-rose-50 to-white shadow-[0_16px_34px_rgba(244,63,94,0.12)]",
  indigo: "border-indigo-100 bg-linear-to-br from-indigo-50 to-white shadow-[0_16px_34px_rgba(99,102,241,0.12)]",
  violet: "border-violet-100 bg-linear-to-br from-violet-50 to-white shadow-[0_16px_34px_rgba(139,92,246,0.12)]",
  cyan: "border-cyan-100 bg-linear-to-br from-cyan-50 to-white shadow-[0_16px_34px_rgba(6,182,212,0.12)]",
  gold: "border-gold-200 bg-linear-to-br from-gold-50/40 to-neutral-50/30 shadow-[0_16px_34px_rgba(17,17,17,0.12)]",
};

const accentClasses: Record<Tone, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  teal: "from-teal-400 to-teal-600",
  sky: "from-sky-400 to-blue-600",
  amber: "from-amber-300 to-orange-500",
  slate: "from-neutral-400 to-neutral-500",
  rose: "from-rose-400 to-red-600",
  indigo: "from-indigo-400 to-indigo-600",
  violet: "from-violet-400 to-purple-600",
  cyan: "from-cyan-400 to-cyan-600",
  gold: "from-gold-300 to-gold-400",
};

const textColorClasses: Record<Tone, string> = {
  emerald: "text-emerald-700",
  teal: "text-teal-700",
  sky: "text-sky-700",
  amber: "text-amber-700",
  slate: "text-neutral-700",
  rose: "text-rose-700",
  indigo: "text-indigo-700",
  violet: "text-violet-700",
  cyan: "text-cyan-700",
  gold: "text-gold-700",
};

export function DashboardHero({
  eyebrow,
  title,
  description,
  summary,
  accent = "emerald",
}: {
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  accent?: Tone;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-neutral-100 bg-white p-8 shadow-[0_28px_58px_rgba(17,17,17,0.12)] animate-fade-in-down">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl flex-1">
          <p className={`text-xs font-bold uppercase tracking-[0.35em] ${textColorClasses[accent]} opacity-80`}>{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl leading-tight">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 font-medium">{description}</p>
        </div>
        <div className={`inline-flex w-fit shrink-0 items-center gap-3 rounded-full border-2 px-5 py-3 text-sm font-bold backdrop-blur-sm ${panelToneClasses[accent]}`}>
          <span className={`h-3 w-3 rounded-full bg-linear-to-r ${accentClasses[accent]} animate-soft-pulse`} />
          <span className={textColorClasses[accent]}>{summary}</span>
        </div>
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone,
  href,
  icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: Tone;
  href?: string;
  icon?: ReactNode;
}) {
  const content = (
    <div className={`relative overflow-hidden rounded-[1.75rem] border bg-white px-6 py-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_28px_50px_rgba(17,17,17,0.18)] ${panelToneClasses[tone]} group`}>
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-linear-to-br ${accentClasses[tone]} opacity-[0.15] transition-transform group-hover:scale-110`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">{label}</p>
            <p className="mt-4 text-4xl font-black tracking-tighter text-neutral-900">{value}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{helper}</p>
          </div>
          {icon && <div className={`mt-1 shrink-0 opacity-75 transition-opacity group-hover:opacity-100 ${textColorClasses[tone]}`}>{icon}</div>}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline" aria-label={`${label} - open`}>
        {content}
      </Link>
    );
  }

  return content;
}

export function SectionCard({
  title,
  actionLabel,
  actionHref,
  children,
  description,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className="rounded-4xl border border-white/90 bg-white/60 p-7 shadow-[0_24px_54px_rgba(15,23,42,0.10)] backdrop-blur-sm animate-fade-in-up hover:shadow-[0_28px_64px_rgba(15,23,42,0.12)] transition-shadow duration-300">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p> : null}
        </div>
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="text-xs font-bold text-neutral-700 transition-all hover:text-neutral-700 hover:gap-2 inline-flex items-center gap-1 whitespace-nowrap">
            {actionLabel} <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ActionCard({
  href,
  title,
  description,
  tone,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  tone: Tone;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-3xl border bg-white px-5 py-5 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(17,17,17,0.15)] ${panelToneClasses[tone]}`}>
      <div className={`absolute -right-12 -top-12 h-28 w-28 rounded-full bg-linear-to-br ${accentClasses[tone]} opacity-0 transition-all group-hover:opacity-20`} />
      <div className="relative flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-linear-to-br ${accentClasses[tone]} text-white shadow-[0_8px_16px_rgba(17,17,17,0.20)] group-hover:scale-110 transition-transform`}>
          {icon ? icon : <span className="text-lg font-bold">→</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900 group-hover:text-neutral-900 transition-colors">{title}</p>
          <p className="mt-1.5 text-xs leading-5 text-neutral-600">{description}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-neutral-500 group-hover:text-neutral-700 transition-colors">
            <span>Go to</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function StatusPill({ tone, children, variant = "filled" }: { tone: Tone; children: ReactNode; variant?: "filled" | "outline" }) {
  if (variant === "outline") {
    const borderClasses: Record<Tone, string> = {
      emerald: "border-emerald-200 text-emerald-700 bg-emerald-50",
      teal: "border-teal-200 text-teal-700 bg-teal-50",
      sky: "border-sky-200 text-sky-700 bg-sky-50",
      amber: "border-amber-200 text-amber-700 bg-amber-50",
      slate: "border-neutral-300 text-neutral-700 bg-neutral-50",
      rose: "border-rose-200 text-rose-700 bg-rose-50",
      indigo: "border-indigo-200 text-indigo-700 bg-indigo-50",
      violet: "border-violet-200 text-violet-700 bg-violet-50",
      cyan: "border-cyan-200 text-cyan-700 bg-cyan-50",
      gold: "border-gold-300 text-gold-700 bg-gold-50",
    };
    return (
      <span className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-bold ${borderClasses[tone]}`}>
        {children}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${panelToneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function StatBadge({
  label,
  value,
  tone,
  trend,
}: {
  label: string;
  value: string | number;
  tone: Tone;
  trend?: "up" | "down" | "neutral";
}) {
  const trendColors: Record<string, string> = {
    up: "text-neutral-400",
    down: "text-neutral-600",
    neutral: "text-neutral-600",
  };

  return (
    <div className={`rounded-[1.25rem] border px-4 py-3 text-center ${panelToneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-neutral-900">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-semibold ${trendColors[trend]}`}>
          {trend === "up" ? "↗ Trending up" : trend === "down" ? "↘ Trending down" : "→ Stable"}
        </p>
      )}
    </div>
  );
}
